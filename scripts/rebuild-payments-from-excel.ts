/**
 * 从 Excel 重建全部历史付款 + 修正选课起始学期
 *
 * 修正点：
 *   1. 国中/英文/交通/膳食 的 JAN 列 = 2025 第13期（不是 2026 第1期）
 *   2. 国中+英文+补习 合并为一条「补习班」账单项
 *   3. 选课起始学期 = 该课程/费用的最早实际付款学期
 *
 * 用法:
 *   npx tsx scripts/rebuild-payments-from-excel.ts [--commit]
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS, termKey } from "./excel-term-mapping";

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

import { PrismaClient } from "@prisma/client";
import { findTermByPeriod, getAcademicYearTerms } from "../src/lib/academic-year";
import { FEE_BASELINE_PERIOD } from "../src/lib/fee-baseline";
const prisma = new PrismaClient();
const isCommit = process.argv.includes("--commit");

const EXCEL_PATH =
  process.argv.find((a) => a.endsWith(".xlsx")) ||
  "C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx";

function cleanText(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function parseAmount(v: any): number {
  const s = cleanText(v);
  if (!s || s === "0" || s.toUpperCase() === "FALSE" || s.toUpperCase() === "TRUE" || s.startsWith("#"))
    return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

type RawItem = {
  studentId: string;
  studentName: string;
  year: number;
  termIndex: number;
  itemKey: string;
  itemType: "COURSE" | "EXTRA_FEE";
  amountCents: number;
  description: string;
};

const SHEET_CONFIG: Record<
  string,
  { type: "COURSE" | "EXTRA_FEE"; itemKey: string; columns: typeof DEC_START_SHEET_COLS; mergeIntoTuition?: boolean }
> = {
  功课班: { type: "COURSE", itemKey: "HOMEWORK", columns: DEC_START_SHEET_COLS },
  补习: { type: "COURSE", itemKey: "TUITION_CLASS", columns: DEC_START_SHEET_COLS, mergeIntoTuition: true },
  写作: { type: "COURSE", itemKey: "WRITING", columns: DEC_START_SHEET_COLS },
  国中: { type: "COURSE", itemKey: "SEC_BM", columns: JAN_START_SHEET_COLS, mergeIntoTuition: true },
  英文: { type: "COURSE", itemKey: "SEC_EN", columns: JAN_START_SHEET_COLS, mergeIntoTuition: true },
  交通: { type: "EXTRA_FEE", itemKey: "TRANSPORT", columns: JAN_START_SHEET_COLS },
  膳食: { type: "EXTRA_FEE", itemKey: "MEAL", columns: JAN_START_SHEET_COLS },
};

async function main() {
  console.log(`==== ${isCommit ? "🚨 重建付款数据" : "🔍 Dry-Run"} ====\n`);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("找不到 Excel:", EXCEL_PATH);
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  const students = await prisma.student.findMany({ select: { id: true, fullName: true, gradeId: true } });
  const studentMap = new Map(students.map((s) => [s.fullName, s]));
  const terms = await prisma.term.findMany();
  const termMap = new Map(terms.map((t) => [termKey(t.year, t.termIndex), t]));
  const termIdMap = new Map(terms.map((t) => [termKey(t.year, t.termIndex), t.id]));

  const courses = await prisma.course.findMany();
  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const extraFees = await prisma.extraFeeType.findMany();
  const extraByCode = new Map(extraFees.map((e) => [e.code, e]));

  const tuitionCourse = courseByCode.get("TUITION_CLASS")!;
  const homeworkCourse = courseByCode.get("HOMEWORK")!;
  const writingCourse = courseByCode.get("WRITING")!;
  const secBmCourse = courseByCode.get("SEC_BM")!;
  const secEnCourse = courseByCode.get("SEC_EN")!;

  const refIdMap: Record<string, number> = {
    HOMEWORK: homeworkCourse.id,
    TUITION_CLASS: tuitionCourse.id,
    WRITING: writingCourse.id,
    TRANSPORT: extraByCode.get("TRANSPORT")!.id,
    MEAL: extraByCode.get("MEAL")!.id,
  };

  // 读取 学生资料 价格
  const studentInfo = new Map<string, { feeTuition: number; feeHomework: number; feeWriting: number }>();
  const infoRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["学生资料"], { header: 1, defval: "", raw: false });
  for (let i = 1; i < infoRows.length; i++) {
    const name = cleanText(infoRows[i][1]);
    if (!name) continue;
    studentInfo.set(name, {
      feeHomework: parseAmount(infoRows[i][4]),
      feeTuition: parseAmount(infoRows[i][5]),
      feeWriting: parseAmount(infoRows[i][6]),
    });
  }

  // 读取 Excel 原始付款
  const rawItems: RawItem[] = [];
  const sheetStats: Record<string, number> = {};

  for (const [sheetName, cfg] of Object.entries(SHEET_CONFIG)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      if (!name) continue;
      const student = studentMap.get(name);
      if (!student) continue;
      for (const c of cfg.columns) {
        const amt = parseAmount(rows[i][c.col]);
        if (amt <= 0) continue;
        count++;
        rawItems.push({
          studentId: student.id,
          studentName: name,
          year: c.year,
          termIndex: c.termIndex,
          itemKey: cfg.itemKey,
          itemType: cfg.type,
          amountCents: Math.round(amt * 100),
          description: sheetName,
        });
      }
    }
    sheetStats[sheetName] = count;
  }

  console.log("📊 Excel 读取统计:");
  for (const [k, v] of Object.entries(sheetStats)) console.log(`   ${k}: ${v} 笔`);

  // 按 (student, year, termIndex) 分组并合并
  type MergedItem = {
    itemType: "COURSE" | "EXTRA_FEE";
    refId: number;
    description: string;
    amountCents: number;
  };

  const byPayment = new Map<string, MergedItem[]>();
  const tuitionPartsByPayment = new Map<string, number>(); // 待合并的补习相关金额

  for (const it of rawItems) {
    const pk = `${it.studentId}_${it.year}_${it.termIndex}`;
    const cfg = Object.values(SHEET_CONFIG).find((c) => c.itemKey === it.itemKey);

    if (cfg?.mergeIntoTuition) {
      tuitionPartsByPayment.set(pk, (tuitionPartsByPayment.get(pk) || 0) + it.amountCents);
      continue;
    }

    if (!byPayment.has(pk)) byPayment.set(pk, []);
    byPayment.get(pk)!.push({
      itemType: it.itemType,
      refId: refIdMap[it.itemKey],
      description: it.itemKey === "HOMEWORK" ? "功课班" : it.itemKey === "WRITING" ? "写作" : it.description,
      amountCents: it.amountCents,
    });
  }

  // 加入合并后的补习班
  for (const [pk, cents] of tuitionPartsByPayment) {
    if (cents <= 0) continue;
    if (!byPayment.has(pk)) byPayment.set(pk, []);
    byPayment.get(pk)!.push({
      itemType: "COURSE",
      refId: tuitionCourse.id,
      description: "补习班",
      amountCents: cents,
    });
  }

  console.log(`\n📑 将创建 ${byPayment.size} 张账单\n`);

  // 统计学期分布
  const termDist = new Map<string, number>();
  for (const pk of byPayment.keys()) {
    const [, y, t] = pk.split("_");
    const k = `${y}T${t}`;
    termDist.set(k, (termDist.get(k) || 0) + 1);
  }
  console.log("📅 学期分布 (前8):");
  Array.from(termDist.entries())
    .sort()
    .slice(0, 8)
    .forEach(([k, v]) => console.log(`   ${k}: ${v} 张`));

  // 计算每学生每课程最早/最晚付款学期
  const earliestByStudentItem = new Map<string, number>();
  const latestByStudentItem = new Map<string, number>();
  const paidTermsByStudentItem = new Map<string, Set<number>>();

  for (const it of rawItems) {
    const tid = termIdMap.get(termKey(it.year, it.termIndex));
    if (!tid) continue;
    const cfg = Object.values(SHEET_CONFIG).find((c) => c.itemKey === it.itemKey);
    const effectiveKey = cfg?.mergeIntoTuition ? "TUITION_CLASS" : it.itemKey;
    const sk = `${it.studentId}_${effectiveKey}`;

    const curEarliest = earliestByStudentItem.get(sk);
    if (!curEarliest || tid < curEarliest) earliestByStudentItem.set(sk, tid);

    const curLatest = latestByStudentItem.get(sk);
    if (!curLatest || tid > curLatest) latestByStudentItem.set(sk, tid);

    if (!paidTermsByStudentItem.has(sk)) paidTermsByStudentItem.set(sk, new Set());
    paidTermsByStudentItem.get(sk)!.add(tid);
  }

  // 每学生在哪些学期有任意付款（用于判断「退课」）
  const studentPaidTermIds = new Map<string, Set<number>>();
  for (const it of rawItems) {
    const tid = termIdMap.get(termKey(it.year, it.termIndex));
    if (!tid) continue;
    if (!studentPaidTermIds.has(it.studentId)) studentPaidTermIds.set(it.studentId, new Set());
    studentPaidTermIds.get(it.studentId)!.add(tid);
  }

  /** 若学生在更后期有别的科目付款，但此科目已停付 → 设置 endTermId
   *  第5期 Excel 不完整，推断结束学期时最多只看第4期 */
  const baselineTerms = await getAcademicYearTerms();
  const p4Term = findTermByPeriod(baselineTerms, FEE_BASELINE_PERIOD);
  const p4Tid = p4Term?.id;

  function computeEndTermId(studentId: string, itemKey: string): number | null {
    const lastTid = latestByStudentItem.get(`${studentId}_${itemKey}`);
    if (!lastTid) return null;
    const paidTerms = paidTermsByStudentItem.get(`${studentId}_${itemKey}`) ?? new Set();
    const studentTerms = studentPaidTermIds.get(studentId) ?? new Set();

    for (const tid of [...studentTerms].sort((a, b) => a - b)) {
      if (p4Tid != null && tid > p4Tid) continue;
      if (tid <= lastTid) continue;
      if (!paidTerms.has(tid)) {
        return lastTid;
      }
    }
    return null;
  }

  if (!isCommit) {
    console.log("\n确认请加 --commit");
    await prisma.$disconnect();
    return;
  }

  // === 写入 ===
  console.log("\n🗑️  删除现有付款记录...");
  await prisma.studentTermPaymentItem.deleteMany({});
  const deleted = await prisma.studentTermPayment.deleteMany({});
  console.log(`   已删除 ${deleted.count} 张账单`);

  console.log("\n💰 创建付款记录...");
  let created = 0;
  for (const [pk, items] of byPayment) {
    const [studentId, yearStr, termStr] = pk.split("_");
    const year = Number(yearStr);
    const termIndex = Number(termStr);
    const term = termMap.get(termKey(year, termIndex));
    if (!term) continue;

    const total = items.reduce((s, it) => s + it.amountCents, 0);
    await prisma.studentTermPayment.create({
      data: {
        studentId,
        year,
        termIndex,
        totalCents: total,
        paidAt: term.startDate,
        note: "Excel 历史数据导入",
        items: {
          create: items.map((it) => ({
            itemType: it.itemType,
            refId: it.refId,
            description: it.description,
            unitCents: it.amountCents,
            quantity: 1,
            fraction: 1,
            finalCents: it.amountCents,
          })),
        },
      },
    });
    created++;
  }
  console.log(`   创建 ${created} 张账单`);

  // === 修正选课 ===
  console.log("\n🎓 修正选课记录...");
  const courseKeyToId: Record<string, number> = {
    HOMEWORK: homeworkCourse.id,
    TUITION_CLASS: tuitionCourse.id,
    WRITING: writingCourse.id,
  };

  // 删除独立的中学国文/英文选课
  const secCodes = ["SEC_BM", "SEC_EN", "SECONDARY_TUITION", "ENGLISH_CLASS"];
  const deletedSec = await prisma.studentEnrollment.deleteMany({
    where: { course: { code: { in: secCodes } } },
  });
  console.log(`   删除中学国文/英文独立选课: ${deletedSec.count}`);

  const allStudents = await prisma.student.findMany({
    include: { enrollments: { include: { course: true } } },
  });

  let updatedEnrollments = 0;
  for (const student of allStudents) {
    const info = studentInfo.get(student.fullName);
    const ep = new Map<string, boolean>();
    for (const it of rawItems.filter((r) => r.studentId === student.id)) {
      if (it.itemKey === "SEC_BM" || it.description === "国中") ep.set("SEC_BM", true);
      if (it.itemKey === "SEC_EN" || it.description === "英文") ep.set("SEC_EN", true);
    }

    for (const [itemKey, courseId] of Object.entries(courseKeyToId)) {
      const earliestTid = earliestByStudentItem.get(`${student.id}_${itemKey}`);
      const feeFromInfo =
        itemKey === "TUITION_CLASS" ? info?.feeTuition :
        itemKey === "HOMEWORK" ? info?.feeHomework :
        itemKey === "WRITING" ? info?.feeWriting : 0;
      const shouldExist = earliestTid || (feeFromInfo && feeFromInfo > 0);
      if (!shouldExist) continue;

      const subjectIds: number[] = [];
      if (itemKey === "TUITION_CLASS") {
        if (ep.get("SEC_BM")) subjectIds.push(secBmCourse.id);
        if (ep.get("SEC_EN")) subjectIds.push(secEnCourse.id);
      }

      const existing = student.enrollments.find((e) => e.courseId === courseId);
      const startTermId = earliestTid ?? existing?.startTermId;
      if (!startTermId) continue;

      const customPriceCents = feeFromInfo ? Math.round(feeFromInfo * 100) : existing?.customPriceCents;
      const endTermId = computeEndTermId(student.id, itemKey);

      if (existing) {
        await prisma.studentEnrollment.update({
          where: { id: existing.id },
          data: { startTermId, endTermId, customPriceCents, subjectCourseIds: subjectIds },
        });
      } else if (earliestTid) {
        await prisma.studentEnrollment.create({
          data: {
            studentId: student.id,
            courseId,
            startTermId: earliestTid,
            endTermId,
            customPriceCents,
            subjectCourseIds: subjectIds,
          },
        });
      }
      updatedEnrollments++;
    }
  }
  console.log(`   更新/创建选课: ${updatedEnrollments}`);

  // === 修正额外费用起始/结束学期 ===
  console.log("\n🚌 修正额外费用注册...");
  let updatedExtra = 0;
  for (const [code, id] of [["TRANSPORT", extraByCode.get("TRANSPORT")!.id], ["MEAL", extraByCode.get("MEAL")!.id]] as const) {
    for (const student of allStudents) {
      const earliestTid = earliestByStudentItem.get(`${student.id}_${code}`);
      if (!earliestTid) continue;
      const endTermId = computeEndTermId(student.id, code);
      const existing = await prisma.studentExtraFee.findFirst({
        where: { studentId: student.id, extraFeeTypeId: id },
      });
      if (existing) {
        await prisma.studentExtraFee.update({
          where: { id: existing.id },
          data: { startTermId: earliestTid, endTermId },
        });
        updatedExtra++;
      }
    }
  }
  console.log(`   更新额外费用起始/结束: ${updatedExtra}`);

  console.log("\n✅ 重建完成");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
