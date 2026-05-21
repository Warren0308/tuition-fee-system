import * as XLSX from "xlsx";
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import { PrismaClient } from "@prisma/client";
import { calculateUnpaidForStudent } from "../src/lib/billing-utils";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS } from "./excel-term-mapping";

const prisma = new PrismaClient();
const EXCEL = "C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx";

function cleanText(v: any) { return v == null ? "" : String(v).trim(); }
function parseAmount(v: any) {
  const s = cleanText(v);
  if (!s || s === "0" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

function getExcelRow(wb: XLSX.WorkBook, sheet: string, name: string) {
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
  return rows.find(r => cleanText(r[1]) === name);
}

async function checkStudent(name: string, wb: XLSX.WorkBook) {
  const st = await prisma.student.findFirst({
    where: { fullName: name },
    include: {
      enrollments: { include: { course: true, startTerm: true } },
      payments: { include: { items: true }, orderBy: [{ year: "asc" }, { termIndex: "asc" }] },
    },
  });
  if (!st) return;

  console.log(`\n===== ${name} =====`);
  console.log("选课:", st.enrollments.map(e => `${e.course.name}(start ${e.startTerm.year}T${e.startTerm.termIndex})`).join(", "));

  for (const p of st.payments) {
    console.log(`  账单 ${p.year}T${p.termIndex}: RM${p.totalCents/100} [${p.items.map(i=>i.description).join(",")}]`);
  }

  const t4 = await prisma.term.findFirst({ where: { year: 2026, termIndex: 4 } });
  const t3 = await prisma.term.findFirst({ where: { year: 2026, termIndex: 3 } });
  if (t4) {
    const s4 = await calculateUnpaidForStudent(st.id, t4.id, st.gradeId);
    console.log(`  T4未付: RM${s4.unpaidTotal/100} [${[...s4.unpaidCourses,...s4.unpaidExtraFees].map(u=>u.name).join(",")}]`);
  }
  if (t3) {
    const s3 = await calculateUnpaidForStudent(st.id, t3.id, st.gradeId);
    console.log(`  T3未付: RM${s3.unpaidTotal/100}`);
  }

  // Excel APR列各sheet
  for (const [sheet, cols, aprCol] of [
    ["功课班", DEC_START_SHEET_COLS, 8],
    ["补习", DEC_START_SHEET_COLS, 8],
    ["写作", DEC_START_SHEET_COLS, 8],
    ["国中", JAN_START_SHEET_COLS, 6],
    ["英文", JAN_START_SHEET_COLS, 6],
    ["交通", JAN_START_SHEET_COLS, 6],
    ["膳食", JAN_START_SHEET_COLS, 6],
  ] as const) {
    const row = getExcelRow(wb, sheet, name);
    if (!row) continue;
    const amt = parseAmount(row[aprCol]);
    if (amt > 0) {
      const mapped = cols.find(c => c.col === aprCol)!;
      console.log(`  Excel ${sheet} APR=RM${amt} → ${mapped.year}T${mapped.termIndex}`);
    }
  }
}

async function main() {
  const wb = XLSX.readFile(EXCEL);
  const names = ["黄蒽怡", "陈芷瑩", "罗毅睿", "沈慧萱", "吕禹彤", "庞宇葵", "郑宇翔"];
  for (const n of names) await checkStudent(n, wb);

  // 统计：Excel 功课班 APR 有付但系统 T4 无账单
  console.log("\n\n===== 功课班 APR有付但T4无账单 =====");
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["功课班"], { header: 1, defval: "", raw: false });
  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    const apr = parseAmount(rows[i][8]);
    if (apr <= 0) continue;
    const st = await prisma.student.findFirst({ where: { fullName: name } });
    if (!st) continue;
    const pay = await prisma.studentTermPayment.findFirst({ where: { studentId: st.id, year: 2026, termIndex: 4 } });
    if (!pay) console.log(`  ${name}: APR=RM${apr}, 无T4账单`);
  }

  // 统计：Excel 任何sheet APR有付但系统T3+T4都没覆盖
  console.log("\n===== Excel任一sheet APR有付，系统T4显示未结算 =====");
  const allStudents = await prisma.student.findMany();
  const t4 = (await prisma.term.findFirst({ where: { year: 2026, termIndex: 4 } }))!;
  for (const st of allStudents) {
    let excelAprTotal = 0;
    for (const [sheet, cols, aprCol] of [
      ["功课班", DEC_START_SHEET_COLS, 8],
      ["补习", DEC_START_SHEET_COLS, 8],
      ["写作", DEC_START_SHEET_COLS, 8],
      ["国中", JAN_START_SHEET_COLS, 6],
      ["英文", JAN_START_SHEET_COLS, 6],
      ["交通", JAN_START_SHEET_COLS, 6],
      ["膳食", JAN_START_SHEET_COLS, 6],
    ] as const) {
      const row = getExcelRow(wb, sheet, st.fullName);
      if (row) excelAprTotal += parseAmount(row[aprCol]);
    }
    if (excelAprTotal <= 0) continue;

    const payT4 = await prisma.studentTermPayment.findFirst({ where: { studentId: st.id, year: 2026, termIndex: 4 } });
    const payT3 = await prisma.studentTermPayment.findFirst({ where: { studentId: st.id, year: 2026, termIndex: 3 } });
    const unpaidT4 = (await calculateUnpaidForStudent(st.id, t4.id, st.gradeId)).unpaidTotal;

    if (!payT4 && unpaidT4 > 0) {
      console.log(`  ${st.fullName}: Excel APR合计=RM${excelAprTotal}, T3账单=${payT3 ? '有' : '无'}, T4账单=无, T4欠=RM${unpaidT4/100}`);
    }
  }

  await prisma.$disconnect();
}
main();
