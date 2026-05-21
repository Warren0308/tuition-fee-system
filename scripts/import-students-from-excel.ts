/**
 * 从 Excel「学生资料」表批量导入学生
 *
 * 用法：
 *   npx tsx scripts/import-students-from-excel.ts <excel路径>            # dry-run，只打印预览
 *   npx tsx scripts/import-students-from-excel.ts <excel路径> --commit   # 真正执行（会先删除所有现有学生）
 *
 * 操作策略：完全替换
 *   - 删除所有现有 Student（级联删除 StudentGuardian / StudentEnrollment / StudentExtraFee / StudentTermPayment）
 *   - 然后导入 Excel 中的所有学生
 *   - 自动创建缺失的字典（Grade / School / GuardianType / Course）
 *   - 功课班/补习班/写作 金额 > 0 → 创建 2026 Q1 选课记录（customPriceCents = 金额）
 *   - 停补 = TRUE 的学生 → 导入但 isActive = false
 */

import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

// 手动加载 .env
const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, "utf-8");
  for (const line of envContent.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx < 0) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  }
}

import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const filePath = process.argv[2];
const isCommit = process.argv.includes("--commit");

if (!filePath) {
  console.error("用法: npx tsx scripts/import-students-from-excel.ts <excel路径> [--commit]");
  process.exit(1);
}

// 导入 2026 年第 1 学期的选课
const TARGET_YEAR = 2026;
const TARGET_TERM_INDEX = 1;

// Excel 表头位置（0-indexed）
const COL = {
  fullName: 1,
  grade: 2,
  school: 3,
  fee_homework: 4, // 功课班
  fee_tuition: 5, // 补习班
  fee_writing: 6, // 写作
  guardian1_type: 7,
  guardian1_name: 8,
  guardian1_phone: 9,
  guardian2_type: 10,
  guardian2_name: 11,
  guardian2_phone: 12,
  address: 13,
  inactive_flag: 14, // TRUE = 停补
  reason: 15,
};

// 需要在系统里对应的课程（按 Excel 列）
const COURSE_COLUMNS = [
  { col: COL.fee_homework, courseName: "功课班", courseCode: "HOMEWORK_CLASS" },
  { col: COL.fee_tuition, courseName: "补习班", courseCode: "TUITION_CLASS" },
  { col: COL.fee_writing, courseName: "写作", courseCode: "WRITING_CLASS" },
];

interface ParsedRow {
  rowNum: number;
  fullName: string;
  gradeName: string;
  schoolName: string | null;
  feeHomework: number;
  feeTuition: number;
  feeWriting: number;
  guardians: Array<{ type: string | null; name: string | null; phone: string }>;
  address: string | null;
  isInactive: boolean;
  reason: string | null;
  errors: string[];
}

function cleanText(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}

function parseAmount(v: any): number {
  const s = cleanText(v);
  if (!s || s === "0" || s === "FALSE" || s === "TRUE" || s.startsWith("#")) return 0;
  const n = Number(s);
  return isNaN(n) ? 0 : Math.max(0, n);
}

function parseRow(row: any[], rowNum: number): ParsedRow | null {
  const fullName = cleanText(row[COL.fullName]);
  if (!fullName) return null;
  if (fullName.startsWith("#REF") || fullName.startsWith("#N/A")) return null;

  const errors: string[] = [];
  const gradeName = cleanText(row[COL.grade]);
  const schoolName = cleanText(row[COL.school]) || null;

  if (!gradeName) errors.push("缺少年级");

  const guardians: Array<{ type: string | null; name: string | null; phone: string }> = [];
  const g1Type = cleanText(row[COL.guardian1_type]) || null;
  const g1Name = cleanText(row[COL.guardian1_name]) || null;
  const g1Phone = cleanText(row[COL.guardian1_phone]);
  if (g1Phone || g1Name || g1Type) {
    guardians.push({ type: g1Type, name: g1Name, phone: g1Phone });
  }

  const g2Type = cleanText(row[COL.guardian2_type]) || null;
  const g2Name = cleanText(row[COL.guardian2_name]) || null;
  const g2Phone = cleanText(row[COL.guardian2_phone]);
  if (g2Phone || g2Name || g2Type) {
    guardians.push({ type: g2Type, name: g2Name, phone: g2Phone });
  }

  const inactiveRaw = cleanText(row[COL.inactive_flag]).toUpperCase();
  const isInactive = inactiveRaw === "TRUE";

  return {
    rowNum,
    fullName,
    gradeName,
    schoolName,
    feeHomework: parseAmount(row[COL.fee_homework]),
    feeTuition: parseAmount(row[COL.fee_tuition]),
    feeWriting: parseAmount(row[COL.fee_writing]),
    guardians,
    address: cleanText(row[COL.address]) || null,
    isInactive,
    reason: cleanText(row[COL.reason]) || null,
    errors,
  };
}

async function ensureTerm() {
  const term = await prisma.term.findUnique({
    where: { year_termIndex: { year: TARGET_YEAR, termIndex: TARGET_TERM_INDEX } },
  });
  if (!term) {
    throw new Error(
      `系统里没有 ${TARGET_YEAR} 年第 ${TARGET_TERM_INDEX} 学期，请先在「学期管理」创建后再导入。`
    );
  }
  return term;
}

async function ensureGrade(name: string, cache: Map<string, number>): Promise<number> {
  if (cache.has(name)) return cache.get(name)!;
  let g = await prisma.grade.findUnique({ where: { name } });
  if (!g) {
    // 推断 orderIndex：P1-P6 → 1-6, K1-K2 → -2,-1, F1-F6 → 7-12
    let orderIndex = 99;
    const m = name.match(/^([PKFkpf])(\d+)$/);
    if (m) {
      const prefix = m[1].toUpperCase();
      const num = parseInt(m[2], 10);
      if (prefix === "K") orderIndex = -3 + num;
      else if (prefix === "P") orderIndex = num;
      else if (prefix === "F") orderIndex = 6 + num;
    }
    g = await prisma.grade.create({ data: { name, orderIndex } });
    console.log(`  + 新建年级：${name} (orderIndex=${orderIndex})`);
  }
  cache.set(name, g.id);
  return g.id;
}

async function ensureSchool(
  name: string | null,
  cache: Map<string, number>
): Promise<number | null> {
  if (!name) return null;
  if (cache.has(name)) return cache.get(name)!;
  let s = await prisma.school.findUnique({ where: { name } });
  if (!s) {
    s = await prisma.school.create({ data: { name } });
    console.log(`  + 新建学校：${name}`);
  }
  cache.set(name, s.id);
  return s.id;
}

async function ensureGuardianType(
  name: string | null,
  cache: Map<string, number>
): Promise<number | null> {
  if (!name) return null;
  if (cache.has(name)) return cache.get(name)!;
  let gt = await prisma.guardianType.findUnique({ where: { name } });
  if (!gt) {
    gt = await prisma.guardianType.create({ data: { name } });
    console.log(`  + 新建监护人关系：${name}`);
  }
  cache.set(name, gt.id);
  return gt.id;
}

async function ensureCourse(courseName: string, courseCode: string): Promise<number> {
  let c = await prisma.course.findUnique({ where: { code: courseCode } });
  if (!c) {
    // 推断 group
    let group: any = "TUITION";
    if (courseCode === "HOMEWORK_CLASS") group = "HOMEWORK";
    else if (courseCode === "WRITING_CLASS") group = "WRITING";
    c = await prisma.course.create({
      data: { code: courseCode, name: courseName, group, isActive: true },
    });
    console.log(`  + 新建课程：${courseName} (${courseCode}, group=${group})`);
  }
  return c.id;
}

async function main() {
  console.log("================================================================");
  console.log(`📥 学生导入脚本 - ${isCommit ? "🚨 真正提交模式" : "🔍 Dry-Run 预览模式"}`);
  console.log("================================================================\n");

  // 1. 读取 Excel
  console.log(`📂 读取文件: ${filePath}`);
  const wb = XLSX.readFile(filePath);
  const sheet = wb.Sheets["学生资料"];
  if (!sheet) {
    console.error('❌ 找不到「学生资料」工作表');
    process.exit(1);
  }
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  console.log(`   总行数: ${rows.length}\n`);

  // 2. 解析所有行（跳过表头）
  const parsed: ParsedRow[] = [];
  let skippedEmpty = 0;
  let skippedInvalid = 0;
  const skippedDetails: string[] = [];
  for (let i = 1; i < rows.length; i++) {
    const r = parseRow(rows[i], i + 1);
    if (!r) {
      skippedEmpty++;
      continue;
    }
    if (r.errors.length > 0) {
      skippedInvalid++;
      skippedDetails.push(`行${r.rowNum} (${r.fullName}): ${r.errors.join(", ")}`);
      continue;
    }
    parsed.push(r);
  }

  // 3. 处理重名（在 Excel 内部）
  const nameMap = new Map<string, number>();
  for (const p of parsed) {
    const count = nameMap.get(p.fullName) || 0;
    nameMap.set(p.fullName, count + 1);
  }
  const duplicates = Array.from(nameMap.entries()).filter(([_, c]) => c > 1);

  // 4. 汇总
  const activeCount = parsed.filter((p) => !p.isInactive).length;
  const inactiveCount = parsed.filter((p) => p.isInactive).length;
  const withGuardian = parsed.filter((p) => p.guardians.length > 0).length;
  const enrollmentStats = {
    homework: parsed.filter((p) => p.feeHomework > 0).length,
    tuition: parsed.filter((p) => p.feeTuition > 0).length,
    writing: parsed.filter((p) => p.feeWriting > 0).length,
  };

  // 字典统计
  const gradesInExcel = new Set(parsed.map((p) => p.gradeName));
  const schoolsInExcel = new Set(parsed.map((p) => p.schoolName).filter((s) => s));
  const guardianTypesInExcel = new Set<string>();
  for (const p of parsed) {
    for (const g of p.guardians) {
      if (g.type) guardianTypesInExcel.add(g.type);
    }
  }

  console.log("================================================================");
  console.log("📊 解析结果");
  console.log("================================================================");
  console.log(`✅ 可导入学生：${parsed.length}`);
  console.log(`   - 活跃（在学）：${activeCount}`);
  console.log(`   - 停补：${inactiveCount}`);
  console.log(`   - 带监护人信息：${withGuardian}`);
  console.log(`⏭️  跳过空行：${skippedEmpty}`);
  console.log(`⚠️  跳过有错误行：${skippedInvalid}`);
  if (skippedDetails.length > 0 && skippedDetails.length <= 20) {
    skippedDetails.forEach((s) => console.log(`     ${s}`));
  } else if (skippedDetails.length > 20) {
    skippedDetails.slice(0, 10).forEach((s) => console.log(`     ${s}`));
    console.log(`     ... 还有 ${skippedDetails.length - 10} 条`);
  }
  if (duplicates.length > 0) {
    console.log(`\n⚠️  Excel 内有 ${duplicates.length} 个姓名重复：`);
    duplicates.slice(0, 10).forEach(([n, c]) => console.log(`     ${n} (${c} 次)`));
    console.log(`     重名会按出现顺序导入为不同学生`);
  }

  console.log(`\n📚 即将创建的选课（2026 第 1 学期）：`);
  console.log(`   - 功课班：${enrollmentStats.homework} 个`);
  console.log(`   - 补习班：${enrollmentStats.tuition} 个`);
  console.log(`   - 写作：${enrollmentStats.writing} 个`);
  console.log(`   - 合计：${enrollmentStats.homework + enrollmentStats.tuition + enrollmentStats.writing} 条`);

  console.log(`\n📖 Excel 出现的字典值：`);
  console.log(`   - 年级 (${gradesInExcel.size}): ${Array.from(gradesInExcel).join(", ")}`);
  console.log(`   - 学校 (${schoolsInExcel.size}): ${Array.from(schoolsInExcel).join(", ")}`);
  console.log(`   - 监护人关系 (${guardianTypesInExcel.size}): ${Array.from(guardianTypesInExcel).join(", ")}`);

  // 5. 当前数据库状态
  const existingCount = await prisma.student.count();
  const existingPayments = await prisma.studentTermPayment.count();
  const existingEnrollments = await prisma.studentEnrollment.count();
  const existingGuardians = await prisma.studentGuardian.count();
  const existingExtraFees = await prisma.studentExtraFee.count();

  console.log(`\n================================================================`);
  console.log(`🗄️  当前数据库状态（即将被全部删除）`);
  console.log(`================================================================`);
  console.log(`   现有学生：${existingCount}`);
  console.log(`   现有账单：${existingPayments}`);
  console.log(`   现有选课：${existingEnrollments}`);
  console.log(`   现有监护人：${existingGuardians}`);
  console.log(`   现有额外费用：${existingExtraFees}`);

  // 6. 实际写入
  if (!isCommit) {
    console.log(`\n================================================================`);
    console.log(`🔍 Dry-Run 完毕 — 不会写入任何数据`);
    console.log(`================================================================`);
    console.log(`\n如果确认要执行，请运行：`);
    console.log(`   npx tsx scripts/import-students-from-excel.ts "${filePath}" --commit\n`);
    await prisma.$disconnect();
    return;
  }

  // ===== 真正执行 =====
  console.log(`\n================================================================`);
  console.log(`🚨 5 秒后开始真正写入数据库...按 Ctrl+C 立即取消`);
  console.log(`================================================================`);
  for (let i = 5; i > 0; i--) {
    process.stdout.write(`\r   倒数 ${i} ...`);
    await new Promise((r) => setTimeout(r, 1000));
  }
  console.log("\n");

  // 6.1 确认目标学期存在
  const term = await ensureTerm();
  console.log(`✅ 目标学期：${term.year} 年第 ${term.termIndex} 学期 (id=${term.id})\n`);

  // 6.2 删除所有现有学生数据（级联）
  console.log("🗑️  删除现有学生数据...");
  const del = await prisma.student.deleteMany({});
  console.log(`   删除了 ${del.count} 个学生（含其所有选课/账单/监护人/额外费用）\n`);

  // 6.3 准备字典缓存
  const gradeCache = new Map<string, number>();
  const schoolCache = new Map<string, number>();
  const guardianTypeCache = new Map<string, number>();

  // 6.4 预创建所有课程
  console.log("📚 准备课程字典...");
  const courseIdMap = new Map<number, number>(); // colIdx → courseId
  for (const cc of COURSE_COLUMNS) {
    const cid = await ensureCourse(cc.courseName, cc.courseCode);
    courseIdMap.set(cc.col, cid);
  }
  console.log("");

  // 6.5 逐条导入
  console.log(`👥 开始导入 ${parsed.length} 个学生...\n`);
  let created = 0;
  let createdGuardians = 0;
  let createdEnrollments = 0;
  const failures: string[] = [];

  for (let i = 0; i < parsed.length; i++) {
    const p = parsed[i];
    try {
      const gradeId = await ensureGrade(p.gradeName, gradeCache);
      const schoolId = await ensureSchool(p.schoolName, schoolCache);

      const student = await prisma.student.create({
        data: {
          fullName: p.fullName,
          gradeId,
          schoolId,
          address: p.address,
          isActive: !p.isInactive,
        },
      });
      created++;

      // 监护人
      for (let gi = 0; gi < p.guardians.length; gi++) {
        const g = p.guardians[gi];
        const relTypeId = (await ensureGuardianType(g.type, guardianTypeCache)) || (await ensureGuardianType("其他", guardianTypeCache))!;
        await prisma.studentGuardian.create({
          data: {
            studentId: student.id,
            name: g.name || g.type || "未填写",
            phone: g.phone || "",
            relationTypeId: relTypeId,
            isPrimary: gi === 0,
          },
        });
        createdGuardians++;
      }

      // 选课
      for (const cc of COURSE_COLUMNS) {
        let fee = 0;
        if (cc.col === COL.fee_homework) fee = p.feeHomework;
        else if (cc.col === COL.fee_tuition) fee = p.feeTuition;
        else if (cc.col === COL.fee_writing) fee = p.feeWriting;

        if (fee > 0) {
          await prisma.studentEnrollment.create({
            data: {
              studentId: student.id,
              courseId: courseIdMap.get(cc.col)!,
              startTermId: term.id,
              customPriceCents: Math.round(fee * 100),
            },
          });
          createdEnrollments++;
        }
      }

      if ((i + 1) % 50 === 0) {
        console.log(`   已处理 ${i + 1} / ${parsed.length} ...`);
      }
    } catch (e: any) {
      failures.push(`行${p.rowNum} (${p.fullName}): ${e.message}`);
    }
  }

  console.log(`\n================================================================`);
  console.log(`✅ 导入完成`);
  console.log(`================================================================`);
  console.log(`   创建学生：${created}`);
  console.log(`   创建监护人：${createdGuardians}`);
  console.log(`   创建选课：${createdEnrollments}`);
  if (failures.length > 0) {
    console.log(`\n⚠️  ${failures.length} 条失败：`);
    failures.slice(0, 20).forEach((f) => console.log(`     ${f}`));
    if (failures.length > 20) console.log(`     ... 还有 ${failures.length - 20} 条`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error("\n❌ 致命错误:", e);
  await prisma.$disconnect();
  process.exit(1);
});
