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
import { JAN_START_SHEET_COLS, DEC_START_SHEET_COLS, termKey } from "./excel-term-mapping";

const prisma = new PrismaClient();
const EXCEL = "C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx";
const NAME = "陈梓扬";

function cleanText(v: any) { return v == null ? "" : String(v).trim(); }
function parseAmount(v: any) {
  const s = cleanText(v);
  if (!s || s === "0" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

async function main() {
  const wb = XLSX.readFile(EXCEL);
  const st = await prisma.student.findFirst({
    where: { fullName: NAME },
    include: {
      grade: true,
      enrollments: { include: { course: true, startTerm: true, endTerm: true } },
      payments: { include: { items: true }, orderBy: [{ year: "asc" }, { termIndex: "asc" }] },
    },
  });
  if (!st) { console.log("找不到"); return; }

  console.log(`=== ${NAME} (${st.grade?.name}) ===\n`);

  console.log("--- Excel 国中/英文 各列 ---");
  for (const sheet of ["国中", "英文", "补习", "功课班"]) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    const row = rows.find(r => cleanText(r[1]) === NAME);
    if (!row) { console.log(`${sheet}: 无此行`); continue; }
    console.log(`\n${sheet} 表头:`, rows[0].slice(3, 10));
    const cols = sheet === "国中" || sheet === "英文" ? JAN_START_SHEET_COLS : DEC_START_SHEET_COLS;
    for (const c of cols.slice(0, 7)) {
      const amt = parseAmount(row[c.col]);
      if (amt > 0) console.log(`  col${c.col} → ${c.year}T${c.termIndex}: RM${amt}`);
    }
  }

  console.log("\n--- 系统选课 ---");
  for (const e of st.enrollments) {
    console.log(`  ${e.course.name} start=${e.startTerm.year}T${e.startTerm.termIndex} end=${e.endTerm?.year ? e.endTerm.year+'T'+e.endTerm.termIndex : 'null'} price=${e.customPriceCents} subjects=${JSON.stringify(e.subjectCourseIds)}`);
  }

  console.log("\n--- 系统账单 ---");
  for (const p of st.payments) {
    console.log(`  ${p.year}T${p.termIndex}: RM${p.totalCents/100} [${p.items.map(i=>`${i.description}(RM${i.finalCents/100})`).join(", ")}]`);
  }

  console.log("\n--- 各期状态 ---");
  const terms = await prisma.term.findMany({
    where: { OR: [{ year: 2025, termIndex: 13 }, { year: 2026, termIndex: { lte: 6 } }] },
    orderBy: [{ year: "asc" }, { termIndex: "asc" }],
  });
  for (const t of terms) {
    const pay = st.payments.find(p => p.year === t.year && p.termIndex === t.termIndex);
    const summary = await calculateUnpaidForStudent(st.id, t.id, st.gradeId);
    const tuitionItem = pay?.items.find(i => i.description === "补习班");
    console.log(`  ${t.year}T${t.termIndex}: 账单=${pay ? '有' : '无'} 补习班=${tuitionItem ? 'RM'+tuitionItem.finalCents/100 : '-'} 未付=RM${summary.unpaidTotal/100} ${summary.unpaidCourses.map(c=>c.name).join(',')}`);
  }

  // 找类似问题：Excel 国中+英文 前4列都有付，但系统 T3 无补习班账单
  console.log("\n\n=== 扫描：Excel 国中/英文 前4期都有付，但系统缺账单 ===");
  const students = await prisma.student.findMany({ select: { id: true, fullName: true, gradeId: true } });
  const sm = new Map(students.map(s => [s.fullName, s]));
  const jan4 = JAN_START_SHEET_COLS.slice(0, 4); // JAN,FEB,MAR,APR → T13,T1,T2,T3

  for (const sheet of ["国中", "英文"]) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      const stu = sm.get(name);
      if (!stu) continue;
      const paidTerms = jan4.filter(c => parseAmount(rows[i][c.col]) > 0).map(c => `${c.year}T${c.termIndex}`);
      if (paidTerms.length < 4) continue;

      // 检查系统对应学期是否有补习班/国中/英文付款
      for (const c of jan4) {
        const pay = await prisma.studentTermPayment.findFirst({
          where: { studentId: stu.id, year: c.year, termIndex: c.termIndex },
          include: { items: true },
        });
        const hasTuition = pay?.items.some(it => it.description === "补习班" || it.description.includes("国") || it.description.includes("英"));
        if (!hasTuition) {
          console.log(`  ${name} ${sheet}: Excel ${c.year}T${c.termIndex} 有付 RM${parseAmount(rows[i][c.col])}, 系统无补习班账单`);
        }
      }
    }
  }

  await prisma.$disconnect();
}
main();
