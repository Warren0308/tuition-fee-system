/**
 * 合并 中学国文/英文 → 补习班，并修正选课起始学期
 *
 * 背景：
 *   Excel「学生资料」的「补习班」列已包含中学国文+英文，不应单独计费。
 *   中学生实际付款记录在「国中」「英文」sheet，需合并为一条「补习班」账单项。
 *   学生若中途才有付款，起始学期应从首次付款算起，前面不应显示欠费。
 *
 * 用法:
 *   npx tsx scripts/fix-tuition-consolidation.ts [--commit]
 */

import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS } from "./excel-term-mapping";

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

// 各 sheet 列 → 学期（与 excel-term-mapping.ts 保持一致）
const SHEET_TERM_COLS: Record<string, Array<{ col: number; year: number; termIndex: number }>> = {
  补习: DEC_START_SHEET_COLS,
  国中: JAN_START_SHEET_COLS,
  英文: JAN_START_SHEET_COLS,
  功课班: DEC_START_SHEET_COLS,
  写作: DEC_START_SHEET_COLS,
};

interface StudentExcelInfo {
  feeTuition: number;
  feeHomework: number;
  feeWriting: number;
}

function readExcelPayments(wb: XLSX.WorkBook) {
  const studentInfo = new Map<string, StudentExcelInfo>();
  const studentSheet = wb.Sheets["学生资料"];
  const rows: any[][] = XLSX.utils.sheet_to_json(studentSheet, { header: 1, defval: "", raw: false });
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    studentInfo.set(name, {
      feeHomework: parseAmount(rows[i][4]),
      feeTuition: parseAmount(rows[i][5]),
      feeWriting: parseAmount(rows[i][6]),
    });
  }

  // name → sheet → "year_termIndex" → amount (RM)
  const payments = new Map<string, Map<string, Map<string, number>>>();
  for (const [sheetName, cols] of Object.entries(SHEET_TERM_COLS)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const srows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    for (let i = 1; i < srows.length; i++) {
      const name = cleanText(srows[i][1]);
      if (!name) continue;
      if (!payments.has(name)) payments.set(name, new Map());
      const sm = payments.get(name)!;
      if (!sm.has(sheetName)) sm.set(sheetName, new Map());
      const tm = sm.get(sheetName)!;
      for (const c of cols) {
        const amt = parseAmount(srows[i][c.col]);
        if (amt > 0) tm.set(`${c.year}_${c.termIndex}`, amt);
      }
    }
  }
  return { studentInfo, payments };
}

function termKey(year: number, termIndex: number) {
  return `${year}_${termIndex}`;
}

async function main() {
  console.log(`==== ${isCommit ? "🚨 真正修复" : "🔍 Dry-Run"} ====\n`);

  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("找不到 Excel:", EXCEL_PATH);
    process.exit(1);
  }
  const wb = XLSX.readFile(EXCEL_PATH);
  const { studentInfo, payments: excelPayments } = readExcelPayments(wb);

  const terms = await prisma.term.findMany();
  const termIdMap = new Map(terms.map((t) => [`${t.year}_${t.termIndex}`, t.id]));
  const termById = new Map(terms.map((t) => [t.id, t]));

  const courses = await prisma.course.findMany();
  const courseByCode = new Map(courses.map((c) => [c.code, c]));
  const tuitionCourse = courseByCode.get("TUITION_CLASS")!;
  const secBmCourse = courseByCode.get("SEC_BM")!;
  const secEnCourse = courseByCode.get("SEC_EN")!;
  const homeworkCourse = courseByCode.get("HOMEWORK")!;
  const writingCourse = courseByCode.get("WRITING")!;

  const students = await prisma.student.findMany({
    include: {
      grade: true,
      enrollments: { include: { course: true, startTerm: true } },
      payments: { include: { items: true } },
    },
  });

  let deletedSecEnrollments = 0;
  let updatedTuitionEnrollments = 0;
  let createdTuitionEnrollments = 0;
  let adjustedStartTerms = 0;
  let consolidatedPaymentItems = 0;
  let deletedSecPaymentItems = 0;
  let updatedPaymentTotals = 0;

  for (const student of students) {
    const info = studentInfo.get(student.fullName);
    const ep = excelPayments.get(student.fullName);

    // --- 1. 计算补习班各学期实际付款 (补习 + 国中 + 英文) ---
    const tuitionPaidByTerm = new Map<string, number>(); // termKey → cents
    if (ep) {
      for (const sheetName of ["补习", "国中", "英文"]) {
        const tm = ep.get(sheetName);
        if (!tm) continue;
        for (const [tk, amt] of tm) {
          tuitionPaidByTerm.set(tk, (tuitionPaidByTerm.get(tk) || 0) + Math.round(amt * 100));
        }
      }
    }

    // 最早有补习班付款的学期
    let earliestTuitionTermId: number | null = null;
    for (const [tk] of tuitionPaidByTerm) {
      const tid = termIdMap.get(tk);
      if (tid && (earliestTuitionTermId === null || tid < earliestTuitionTermId)) {
        earliestTuitionTermId = tid;
      }
    }

    const hasSecPayments =
      ep?.get("国中")?.size || ep?.get("英文")?.size;
    const feeTuitionCents = info ? Math.round(info.feeTuition * 100) : null;

    // --- 2. 删除 中学国文/英文 独立选课 ---
    const secEnrollments = student.enrollments.filter((e) =>
      ["SEC_BM", "SEC_EN", "SECONDARY_TUITION", "ENGLISH_CLASS"].includes(e.course.code)
    );
    for (const e of secEnrollments) {
      if (isCommit) await prisma.studentEnrollment.delete({ where: { id: e.id } });
      deletedSecEnrollments++;
    }

    // --- 3. 确保/更新 补习班 选课 ---
    const existingTuition = student.enrollments.find((e) => e.course.code === "TUITION_CLASS");
    const shouldHaveTuition =
      (feeTuitionCents && feeTuitionCents > 0) || tuitionPaidByTerm.size > 0;

    if (shouldHaveTuition) {
      // 子科目标签：有国中/英文付款记录则标记
      const subjectIds: number[] = [];
      if (ep?.get("国中")?.size) subjectIds.push(secBmCourse.id);
      if (ep?.get("英文")?.size) subjectIds.push(secEnCourse.id);

      const startTermId = earliestTuitionTermId ?? existingTuition?.startTermId;
      if (!startTermId) continue;

      if (existingTuition) {
        const needsUpdate =
          (earliestTuitionTermId && existingTuition.startTermId !== earliestTuitionTermId) ||
          (feeTuitionCents && existingTuition.customPriceCents !== feeTuitionCents) ||
          JSON.stringify(existingTuition.subjectCourseIds.sort()) !== JSON.stringify(subjectIds.sort());

        if (needsUpdate) {
          if (isCommit) {
            await prisma.studentEnrollment.update({
              where: { id: existingTuition.id },
              data: {
                startTermId: earliestTuitionTermId ?? existingTuition.startTermId,
                customPriceCents: feeTuitionCents ?? existingTuition.customPriceCents,
                subjectCourseIds: subjectIds,
              },
            });
          }
          updatedTuitionEnrollments++;
          if (earliestTuitionTermId && existingTuition.startTermId !== earliestTuitionTermId) {
            const old = termById.get(existingTuition.startTermId);
            const neu = termById.get(earliestTuitionTermId);
            console.log(
              `  📅 ${student.fullName} 补习班起始: ${old?.year}T${old?.termIndex} → ${neu?.year}T${neu?.termIndex}`
            );
          }
        }
      } else {
        if (isCommit) {
          await prisma.studentEnrollment.create({
            data: {
              studentId: student.id,
              courseId: tuitionCourse.id,
              startTermId,
              customPriceCents: feeTuitionCents,
              subjectCourseIds: subjectIds,
            },
          });
        }
        createdTuitionEnrollments++;
        console.log(`  + ${student.fullName} 新建补习班选课 (startTerm=${startTermId})`);
      }
    }

    // --- 4. 修正 功课班/写作 起始学期 ---
    for (const [sheetName, course] of [
      ["功课班", homeworkCourse],
      ["写作", writingCourse],
    ] as const) {
      const tm = ep?.get(sheetName);
      if (!tm || tm.size === 0) continue;
      let earliest: number | null = null;
      for (const [tk] of tm) {
        const tid = termIdMap.get(tk);
        if (tid && (earliest === null || tid < earliest)) earliest = tid;
      }
      if (!earliest) continue;
      const enr = student.enrollments.find((e) => e.courseId === course.id);
      if (enr && enr.startTermId !== earliest) {
        if (isCommit) {
          await prisma.studentEnrollment.update({
            where: { id: enr.id },
            data: { startTermId: earliest },
          });
        }
        adjustedStartTerms++;
        const old = termById.get(enr.startTermId);
        const neu = termById.get(earliest);
        console.log(
          `  📅 ${student.fullName} ${course.name}起始: ${old?.year}T${old?.termIndex} → ${neu?.year}T${neu?.termIndex}`
        );
      }
    }

    // --- 5. 合并付款明细：国中+英文 → 补习班 ---
    for (const payment of student.payments) {
      const tk = termKey(payment.year, payment.termIndex);
      const secItems = payment.items.filter(
        (it) =>
          it.itemType === "COURSE" &&
          (it.description === "中学国文" ||
            it.description === "中学英文" ||
            it.description === "国中" ||
            it.description === "英文" ||
            it.refId === secBmCourse.id ||
            it.refId === secEnCourse.id)
      );
      const tuitionItem = payment.items.find(
        (it) => it.itemType === "COURSE" && it.refId === tuitionCourse.id
      );

      if (secItems.length === 0 && !tuitionItem) {
        // 检查是否有 Excel 补习 sheet 付款但没账单项
        const excelAmt = tuitionPaidByTerm.get(tk);
        if (excelAmt && excelAmt > 0 && isCommit) {
          // 这种情况较少，跳过（已有完整导入的应该都有）
        }
        continue;
      }

      const secTotal = secItems.reduce((s, it) => s + it.finalCents, 0);
      const buxiAmt = ep?.get("补习")?.get(tk);
      const buxiCents = buxiAmt ? Math.round(buxiAmt * 100) : 0;
      const consolidatedCents = Math.max(buxiCents, secTotal);

      if (secItems.length > 0 || (buxiCents > 0 && tuitionItem && tuitionItem.finalCents !== consolidatedCents)) {
        if (isCommit) {
          // 删除中学国文/英文明细
          for (const it of secItems) {
            await prisma.studentTermPaymentItem.delete({ where: { id: it.id } });
            deletedSecPaymentItems++;
          }

          if (tuitionItem) {
            if (tuitionItem.finalCents !== consolidatedCents || tuitionItem.description !== "补习班") {
              await prisma.studentTermPaymentItem.update({
                where: { id: tuitionItem.id },
                data: {
                  description: "补习班",
                  refId: tuitionCourse.id,
                  unitCents: consolidatedCents,
                  finalCents: consolidatedCents,
                },
              });
            }
          } else if (consolidatedCents > 0) {
            await prisma.studentTermPaymentItem.create({
              data: {
                paymentId: payment.id,
                itemType: "COURSE",
                refId: tuitionCourse.id,
                description: "补习班",
                unitCents: consolidatedCents,
                finalCents: consolidatedCents,
              },
            });
          }

          // 重算账单总额
          const remaining = await prisma.studentTermPaymentItem.findMany({
            where: { paymentId: payment.id },
          });
          const newTotal = remaining.reduce((s, it) => s + it.finalCents, 0);
          await prisma.studentTermPayment.update({
            where: { id: payment.id },
            data: { totalCents: newTotal },
          });
          updatedPaymentTotals++;
        } else {
          deletedSecPaymentItems += secItems.length;
          if (secItems.length > 0 || !tuitionItem) consolidatedPaymentItems++;
        }
      }
    }
  }

  console.log("\n==== 汇总 ====");
  console.log(`  删除中学国文/英文选课: ${deletedSecEnrollments}`);
  console.log(`  更新补习班选课: ${updatedTuitionEnrollments}`);
  console.log(`  新建补习班选课: ${createdTuitionEnrollments}`);
  console.log(`  调整功课班/写作起始学期: ${adjustedStartTerms}`);
  console.log(`  删除中学国文/英文付款明细: ${deletedSecPaymentItems}`);
  console.log(`  合并/更新补习班付款明细: ${consolidatedPaymentItems}`);
  console.log(`  重算账单总额: ${updatedPaymentTotals}`);

  if (!isCommit) console.log("\n确认请加 --commit 重新执行");
  else console.log("\n✅ 修复完成");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
