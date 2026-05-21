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

async function main() {
  const wb = XLSX.readFile(EXCEL);
  const terms = await prisma.term.findMany({ orderBy: [{ year: "asc" }, { termIndex: "asc" }] });
  console.log("=== 系统学期 ===");
  for (const t of terms.filter(t => t.year >= 2025 && t.year <= 2026)) {
    console.log(`  id=${t.id} ${t.year}T${t.termIndex} ${t.startDate.toISOString().slice(0,10)} ~ ${t.endDate.toISOString().slice(0,10)}`);
  }

  // 看各 sheet APR 列对应什么
  console.log("\n=== 列映射 ===");
  console.log("功课班 col8 (Apr?):", DEC_START_SHEET_COLS.find(c => c.col === 8));
  console.log("国中 col6 (APR):", JAN_START_SHEET_COLS.find(c => c.col === 6));

  // 统计 Excel APR 有付款的学生数
  const sheets = [
    { name: "功课班", cols: DEC_START_SHEET_COLS, aprCol: 8 },
    { name: "补习", cols: DEC_START_SHEET_COLS, aprCol: 8 },
    { name: "国中", cols: JAN_START_SHEET_COLS, aprCol: 6 },
    { name: "交通", cols: JAN_START_SHEET_COLS, aprCol: 6 },
  ];

  for (const s of sheets) {
    const sheet = wb.Sheets[s.name];
    const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    const hdr = rows[0];
    console.log(`\n${s.name} 表头 col${s.aprCol}=`, hdr[s.aprCol]);
    const mapped = s.cols.find(c => c.col === s.aprCol);
    console.log(`  映射到: ${mapped?.year}T${mapped?.termIndex}`);

    let paidCount = 0;
    const paidNames: string[] = [];
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      const amt = parseAmount(rows[i][s.aprCol]);
      if (amt > 0) { paidCount++; paidNames.push(name); }
    }
    console.log(`  APR列有付款: ${paidCount} 人`);
  }

  // 找 Excel APR 有付但系统对应学期无账单的学生
  const students = await prisma.student.findMany({ select: { id: true, fullName: true, gradeId: true } });
  const studentMap = new Map(students.map(s => [s.fullName, s]));

  // 2026 T4 对应 DEC-start col 8
  const aprTermDec = DEC_START_SHEET_COLS.find(c => c.col === 8)!; // 2026 T4
  const aprTermJan = JAN_START_SHEET_COLS.find(c => c.col === 6)!; // 2026 T3

  console.log("\n=== 功课班 APR (2026T4) Excel有付 vs 系统账单 ===");
  const hwRows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets["功课班"], { header: 1, defval: "", raw: false });
  let missingT4 = 0;
  for (let i = 1; i < hwRows.length; i++) {
    const name = cleanText(hwRows[i][1]);
    const amt = parseAmount(hwRows[i][8]);
    if (amt <= 0) continue;
    const st = studentMap.get(name);
    if (!st) continue;
    const pay = await prisma.studentTermPayment.findFirst({
      where: { studentId: st.id, year: aprTermDec.year, termIndex: aprTermDec.termIndex },
      include: { items: true },
    });
    if (!pay) {
      console.log(`  ❌ ${name}: Excel APR=RM${amt}, 系统无 ${aprTermDec.year}T${aprTermDec.termIndex} 账单`);
      missingT4++;
    } else {
      const hasHw = pay.items.some(it => it.description === "功课班");
      if (!hasHw) {
        console.log(`  ⚠️ ${name}: 有账单但无功课班项 [${pay.items.map(i=>i.description).join(",")}]`);
        missingT4++;
      }
    }
  }
  console.log(`  共 ${missingT4} 人功课班 APR 有问题`);

  // 当前学期是哪个？
  const now = new Date();
  const currentTerm = terms.find(t => t.startDate <= now && t.endDate >= now);
  console.log(`\n=== 当前学期: ${currentTerm?.year}T${currentTerm?.termIndex} ===`);

  // 统计 2026T4 未结算/欠费
  console.log("\n=== 2026T4 状态统计 ===");
  let settled = 0, unsettled = 0, partial = 0, noEnroll = 0;
  const unsettledNames: string[] = [];
  const t4 = terms.find(t => t.year === 2026 && t.termIndex === 4)!;

  for (const st of students) {
    const enrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId: st.id,
        startTermId: { lte: t4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: t4.id } }],
      },
    });
    if (enrollments.length === 0) { noEnroll++; continue; }

    const payment = await prisma.studentTermPayment.findFirst({
      where: { studentId: st.id, year: 2026, termIndex: 4 },
    });
    const summary = await calculateUnpaidForStudent(st.id, t4.id, st.gradeId);

    if (!payment && summary.unpaidTotal > 0) {
      unsettled++;
      unsettledNames.push(st.fullName);
    } else if (payment && summary.unpaidTotal === 0) {
      settled++;
    } else if (payment && summary.unpaidTotal > 0) {
      partial++;
    } else if (!payment && summary.unpaidTotal === 0) {
      // enrolled but nothing to pay?
    }
  }
  console.log(`  缴清: ${settled}, 未结算(有选课无账单): ${unsettled}, 部分缴清: ${partial}, 无选课: ${noEnroll}`);
  console.log(`  未结算名单(前15): ${unsettledNames.slice(0,15).join(", ")}`);

  await prisma.$disconnect();
}
main();
