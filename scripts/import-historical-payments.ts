/**
 * 导入历史付款记录 - 从 Excel 各月度明细表
 *
 * 用法:
 *   npx tsx scripts/import-historical-payments.ts <excel路径>            # dry-run
 *   npx tsx scripts/import-historical-payments.ts <excel路径> --commit   # 真正写入
 *
 * 逻辑:
 *   - 功课班/补习/写作 sheet 各 13 列 (29-Dec ~ 30-Nov), 对应 2025_T13 ~ 2026_T12
 *   - 国中/英文/交通/膳食 sheet 各 13 列 (JAN ~ DEC + "13")
 *     JAN = 2025 第13期（等同 29-Dec），FEB = 2026 第1期，以此类推
 *   - 每个有金额的单元格 = 该学期已付该项的款项
 *   - 自动:
 *     * 创建缺失的 Course (国中, 英文)
 *     * 创建缺失的 ExtraFeeType (交通, 膳食)
 *     * 为 国中/英文 报名学生创建 StudentEnrollment
 *     * 为 交通/膳食 报名学生创建 StudentExtraFee
 *     * 把 功课班/补习/写作 的 enrollment 起始期向前调整 (如果 2025_T13 已付)
 *     * 为每个 (学生, 学期) 创建合并账单
 */

import * as fs from "fs";
import * as path from "path";

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS } from "./excel-term-mapping";
const prisma = new PrismaClient();

const filePath = process.argv[2];
const isCommit = process.argv.includes("--commit");
if (!filePath) {
  console.error("用法: npx tsx scripts/import-historical-payments.ts <excel路径> [--commit]");
  process.exit(1);
}

// Sheet 配置：列范围 → (year, termIndex)
const SHEET_CONFIG: Record<
  string,
  { type: "COURSE" | "EXTRA_FEE"; itemKey: string; columns: Array<{ col: number; year: number; termIndex: number }> }
> = {
  功课班: {
    type: "COURSE",
    itemKey: "HOMEWORK_CLASS",
    columns: DEC_START_SHEET_COLS,
  },
  补习: {
    type: "COURSE",
    itemKey: "TUITION_CLASS",
    columns: DEC_START_SHEET_COLS,
  },
  写作: {
    type: "COURSE",
    itemKey: "WRITING_CLASS",
    columns: DEC_START_SHEET_COLS,
  },
  国中: {
    type: "COURSE",
    itemKey: "SECONDARY_TUITION",
    columns: JAN_START_SHEET_COLS,
  },
  英文: {
    type: "COURSE",
    itemKey: "ENGLISH_CLASS",
    columns: JAN_START_SHEET_COLS,
  },
  交通: {
    type: "EXTRA_FEE",
    itemKey: "TRANSPORT",
    columns: JAN_START_SHEET_COLS,
  },
  膳食: {
    type: "EXTRA_FEE",
    itemKey: "MEAL",
    columns: JAN_START_SHEET_COLS,
  },
};

function cleanText(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function parseAmount(v: any): number {
  const s = cleanText(v);
  if (!s || s === "0" || s.toUpperCase() === "FALSE" || s.toUpperCase() === "TRUE" || s.startsWith("#")) return 0;
  const cleaned = s.replace(/[,\s]/g, "");
  const n = Number(cleaned);
  return isNaN(n) ? 0 : Math.max(0, n);
}

interface PaymentItem {
  studentId: string;
  studentName: string;
  year: number;
  termIndex: number;
  itemKey: string; // e.g. HOMEWORK_CLASS, TRANSPORT
  itemType: "COURSE" | "EXTRA_FEE";
  amountCents: number;
  description: string;
}

async function main() {
  console.log("================================================================");
  console.log(`💰 历史付款导入 - ${isCommit ? "🚨 真正提交模式" : "🔍 Dry-Run 预览模式"}`);
  console.log("================================================================\n");

  const wb = XLSX.readFile(filePath);

  // 学生姓名 → studentId
  const students = await prisma.student.findMany({ select: { id: true, fullName: true } });
  const studentMap = new Map<string, string>();
  for (const s of students) studentMap.set(s.fullName, s.id);
  console.log(`✅ 系统现有学生：${students.length}\n`);

  // 学期 (year, termIndex) → termId
  const terms = await prisma.term.findMany({ select: { id: true, year: true, termIndex: true } });
  const termMap = new Map<string, number>();
  for (const t of terms) termMap.set(`${t.year}_${t.termIndex}`, t.id);

  // 收集所有付款明细
  const allItems: PaymentItem[] = [];
  const unmatchedStudents = new Set<string>();
  const stats: Record<string, { rows: number; paidCells: number; totalCents: number }> = {};

  for (const [sheetName, cfg] of Object.entries(SHEET_CONFIG)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) {
      console.log(`⚠️  跳过：找不到工作表「${sheetName}」`);
      continue;
    }
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    let rowCount = 0;
    let paidCells = 0;
    let total = 0;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      const name = cleanText(row[1]);
      if (!name || name.startsWith("#") || name.length > 50) continue;
      rowCount++;

      const studentId = studentMap.get(name);
      if (!studentId) {
        unmatchedStudents.add(name);
        continue;
      }

      for (const c of cfg.columns) {
        const amt = parseAmount(row[c.col]);
        if (amt > 0) {
          paidCells++;
          total += amt;
          allItems.push({
            studentId,
            studentName: name,
            year: c.year,
            termIndex: c.termIndex,
            itemKey: cfg.itemKey,
            itemType: cfg.type,
            amountCents: Math.round(amt * 100),
            description: `${sheetName}`,
          });
        }
      }
    }
    stats[sheetName] = { rows: rowCount, paidCells, totalCents: total * 100 };
  }

  // 汇总展示
  console.log("📊 各表统计：\n");
  let totalCells = 0;
  let totalCents = 0;
  for (const [name, s] of Object.entries(stats)) {
    console.log(
      `  ${name.padEnd(8)} | 学生 ${String(s.rows).padStart(3)} 行 | 已付 ${String(s.paidCells).padStart(4)} 笔 | 总额 RM ${(s.totalCents / 100).toFixed(2)}`
    );
    totalCells += s.paidCells;
    totalCents += s.totalCents;
  }
  console.log(`\n  合计：${totalCells} 笔付款，总额 RM ${(totalCents / 100).toFixed(2)}`);

  if (unmatchedStudents.size > 0) {
    console.log(`\n⚠️  ${unmatchedStudents.size} 个姓名在系统中找不到（应该不会发生，因为之前验证过）：`);
    Array.from(unmatchedStudents).slice(0, 10).forEach((n) => console.log(`     ${n}`));
  }

  // 按 (学生, 学期) 分组
  const byPayment = new Map<string, PaymentItem[]>();
  for (const it of allItems) {
    const key = `${it.studentId}_${it.year}_${it.termIndex}`;
    if (!byPayment.has(key)) byPayment.set(key, []);
    byPayment.get(key)!.push(it);
  }
  console.log(`\n📑 将创建 ${byPayment.size} 张账单（每张 = 一个学生 × 一个学期）`);

  // 按学期分布
  const byTerm = new Map<string, { items: number; cents: number; students: Set<string> }>();
  for (const it of allItems) {
    const k = `${it.year}_${it.termIndex}`;
    if (!byTerm.has(k)) byTerm.set(k, { items: 0, cents: 0, students: new Set() });
    const e = byTerm.get(k)!;
    e.items++;
    e.cents += it.amountCents;
    e.students.add(it.studentId);
  }
  console.log(`\n📅 按学期分布：`);
  const sortedTerms = Array.from(byTerm.entries()).sort();
  for (const [k, v] of sortedTerms) {
    const [y, t] = k.split("_");
    console.log(`   ${y}年第${t}学期: ${v.items} 笔, ${v.students.size} 人, RM ${(v.cents / 100).toFixed(2)}`);
  }

  // 按项目类型分布
  const byItem = new Map<string, { count: number; cents: number }>();
  for (const it of allItems) {
    if (!byItem.has(it.itemKey)) byItem.set(it.itemKey, { count: 0, cents: 0 });
    const e = byItem.get(it.itemKey)!;
    e.count++;
    e.cents += it.amountCents;
  }
  console.log(`\n📦 按项目分布：`);
  for (const [k, v] of byItem) {
    console.log(`   ${k.padEnd(20)} : ${v.count} 笔, RM ${(v.cents / 100).toFixed(2)}`);
  }

  if (!isCommit) {
    console.log(`\n================================================================`);
    console.log(`🔍 Dry-Run 完毕 — 不会写入任何数据`);
    console.log(`================================================================`);
    console.log(`\n确认无误后请运行:`);
    console.log(`   npx tsx scripts/import-historical-payments.ts "${filePath}" --commit\n`);
    await prisma.$disconnect();
    return;
  }

  // ===== 真正写入 =====
  console.log(`\n🚨 5 秒后开始写入...按 Ctrl+C 取消`);
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r   倒数 ${i}...`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n");

  // 1. 准备新课程 (国中, 英文)
  console.log("📚 准备课程...");
  const courseIdMap = new Map<string, number>(); // itemKey → courseId
  const COURSE_DEFS = [
    { code: "HOMEWORK_CLASS", name: "功课班", group: "HOMEWORK" as const },
    { code: "TUITION_CLASS", name: "补习班", group: "TUITION" as const },
    { code: "WRITING_CLASS", name: "写作", group: "WRITING" as const },
    { code: "SECONDARY_TUITION", name: "国中", group: "SEC_MALAY" as const },
    { code: "ENGLISH_CLASS", name: "英文", group: "SEC_ENGLISH" as const },
  ];
  for (const cd of COURSE_DEFS) {
    let c = await prisma.course.findUnique({ where: { code: cd.code } });
    if (!c) {
      c = await prisma.course.create({ data: cd });
      console.log(`   + 新建课程: ${cd.name} (${cd.code})`);
    }
    courseIdMap.set(cd.code, c.id);
  }

  // 2. 准备额外费用类型 (交通, 膳食)
  console.log("\n💸 准备额外费用类型...");
  const extraFeeIdMap = new Map<string, number>(); // itemKey → extraFeeTypeId
  const EXTRA_DEFS = [
    { code: "TRANSPORT", name: "交通" },
    { code: "MEAL", name: "膳食" },
  ];
  for (const ed of EXTRA_DEFS) {
    let e = await prisma.extraFeeType.findUnique({ where: { code: ed.code } });
    if (!e) {
      e = await prisma.extraFeeType.create({ data: ed });
      console.log(`   + 新建额外费用: ${ed.name} (${ed.code})`);
    }
    extraFeeIdMap.set(ed.code, e.id);
  }

  // 3. 为 国中/英文 创建 enrollment（如果还没有）
  // 4. 为 交通/膳食 创建 StudentExtraFee 注册（如果还没有）
  // 5. 调整 功课班/补习/写作 enrollment 起始期（如果 2025-13 已付）
  console.log("\n🎓 创建/调整选课和额外费用注册...");

  // 按学生汇总：每个学生每个项目的最早付款学期
  type StudentItemInfo = { earliestTermId: number; latestAmount: number };
  const studentItems = new Map<string, Map<string, StudentItemInfo>>();
  for (const it of allItems) {
    const termId = termMap.get(`${it.year}_${it.termIndex}`)!;
    if (!studentItems.has(it.studentId)) studentItems.set(it.studentId, new Map());
    const sm = studentItems.get(it.studentId)!;
    const cur = sm.get(it.itemKey);
    if (!cur || termId < cur.earliestTermId) {
      sm.set(it.itemKey, { earliestTermId: termId, latestAmount: it.amountCents });
    }
  }

  let newEnrollments = 0;
  let adjustedEnrollments = 0;
  let newExtraFees = 0;

  for (const [studentId, itemsMap] of studentItems) {
    for (const [itemKey, info] of itemsMap) {
      if (courseIdMap.has(itemKey)) {
        // 是课程
        const courseId = courseIdMap.get(itemKey)!;
        const existing = await prisma.studentEnrollment.findFirst({
          where: { studentId, courseId },
        });
        if (existing) {
          if (existing.startTermId > info.earliestTermId) {
            await prisma.studentEnrollment.update({
              where: { id: existing.id },
              data: { startTermId: info.earliestTermId },
            });
            adjustedEnrollments++;
          }
        } else {
          await prisma.studentEnrollment.create({
            data: {
              studentId,
              courseId,
              startTermId: info.earliestTermId,
              customPriceCents: info.latestAmount,
            },
          });
          newEnrollments++;
        }
      } else if (extraFeeIdMap.has(itemKey)) {
        // 是额外费用
        const extraFeeTypeId = extraFeeIdMap.get(itemKey)!;
        const existing = await prisma.studentExtraFee.findFirst({
          where: { studentId, extraFeeTypeId },
          orderBy: { startTermId: "asc" },
        });
        if (existing) {
          if (existing.startTermId > info.earliestTermId) {
            await prisma.studentExtraFee.update({
              where: { id: existing.id },
              data: { startTermId: info.earliestTermId },
            });
            adjustedEnrollments++;
          }
        } else {
          await prisma.studentExtraFee.create({
            data: {
              studentId,
              extraFeeTypeId,
              amountCents: info.latestAmount,
              startTermId: info.earliestTermId,
            },
          });
          newExtraFees++;
        }
      }
    }
  }
  console.log(`   新建选课: ${newEnrollments}`);
  console.log(`   调整选课/费用起始: ${adjustedEnrollments}`);
  console.log(`   新建额外费用注册: ${newExtraFees}`);

  // 6. 创建付款记录
  console.log("\n💰 创建付款记录...");
  let createdPayments = 0;
  let createdItems = 0;
  const failures: string[] = [];

  // 用 transaction batched 处理
  let i = 0;
  for (const [key, items] of byPayment) {
    i++;
    try {
      const first = items[0];
      const termId = termMap.get(`${first.year}_${first.termIndex}`)!;
      const total = items.reduce((s, x) => s + x.amountCents, 0);

      // 计算 paidAt: 该学期的 startDate
      const term = terms.find((t) => t.id === termId)!;

      // 先删除该学生该学期已有的账单（如果有，避免冲突）
      const existing = await prisma.studentTermPayment.findUnique({
        where: { studentId_year_termIndex: { studentId: first.studentId, year: first.year, termIndex: first.termIndex } },
      });
      if (existing) {
        await prisma.studentTermPaymentItem.deleteMany({ where: { paymentId: existing.id } });
        await prisma.studentTermPayment.delete({ where: { id: existing.id } });
      }

      const payment = await prisma.studentTermPayment.create({
        data: {
          studentId: first.studentId,
          year: first.year,
          termIndex: first.termIndex,
          totalCents: total,
          paidAt: new Date(`${first.year}-01-15`), // 用学期起始月份
          note: "Excel 历史数据导入",
          items: {
            create: items.map((it) => {
              const refId = courseIdMap.get(it.itemKey) ?? extraFeeIdMap.get(it.itemKey) ?? null;
              return {
                itemType: it.itemType,
                refId,
                description: it.description,
                unitCents: it.amountCents,
                quantity: 1,
                fraction: 1,
                finalCents: it.amountCents,
              };
            }),
          },
        },
      });
      createdPayments++;
      createdItems += items.length;

      if (i % 50 === 0) console.log(`   已处理 ${i} / ${byPayment.size} 张账单...`);
    } catch (e: any) {
      failures.push(`${key}: ${e.message}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`✅ 导入完成`);
  console.log(`================================================================`);
  console.log(`   创建付款账单: ${createdPayments} 张`);
  console.log(`   创建付款明细: ${createdItems} 条`);
  console.log(`   新建选课: ${newEnrollments}`);
  console.log(`   调整选课起始: ${adjustedEnrollments}`);
  console.log(`   新建额外费用注册: ${newExtraFees}`);
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} 条失败：`);
    failures.slice(0, 10).forEach((f) => console.log(`     ${f}`));
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n❌ 致命错误:", e);
  await prisma.$disconnect();
  process.exit(1);
});
