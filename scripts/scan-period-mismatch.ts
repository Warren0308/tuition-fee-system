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
import { JAN_START_SHEET_COLS } from "./excel-term-mapping";

const prisma = new PrismaClient();
const wb = XLSX.readFile("C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx");

function cleanText(v: any) { return v == null ? "" : String(v).trim(); }
function parseAmount(v: any) {
  const s = cleanText(v);
  if (!s || s === "0" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

async function main() {
  const students = await prisma.student.findMany({ select: { id: true, fullName: true } });
  const sm = new Map(students.map(s => [s.fullName, s.id]));
  const janCols = JAN_START_SHEET_COLS.slice(0, 4); // 前4期

  console.log("=== 国中/英文 前4期 vs 系统补习班账单数 ===\n");
  const mismatches: string[] = [];

  for (const sheet of ["国中", "英文"]) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      const sid = sm.get(name);
      if (!sid) continue;

      const excelPaidTerms = new Set<string>();
      for (const c of janCols) {
        if (parseAmount(rows[i][c.col]) > 0) excelPaidTerms.add(`${c.year}_${c.termIndex}`);
      }
      if (excelPaidTerms.size === 0) continue;

      const payments = await prisma.studentTermPayment.findMany({
        where: { studentId: sid },
        include: { items: true },
      });
      const tuitionPaidTerms = new Set<string>();
      for (const p of payments) {
        if (p.items.some(it => it.description === "补习班")) {
          tuitionPaidTerms.add(`${p.year}_${p.termIndex}`);
        }
      }

      if (excelPaidTerms.size !== tuitionPaidTerms.size || ![...excelPaidTerms].every(t => tuitionPaidTerms.has(t))) {
        const excelList = [...excelPaidTerms].sort().map(t => { const [y,ti]=t.split('_'); return `${y}T${ti}`; }).join(',');
        const sysList = [...tuitionPaidTerms].sort().map(t => { const [y,ti]=t.split('_'); return `${y}T${ti}`; }).join(',');
        if (!mismatches.includes(name)) {
          mismatches.push(name);
          console.log(`${name}:`);
          console.log(`  Excel ${sheet} 有付: ${excelList} (${excelPaidTerms.size}期)`);
          console.log(`  系统补习班账单: ${sysList} (${tuitionPaidTerms.size}期)`);
          const missing = [...excelPaidTerms].filter(t => !tuitionPaidTerms.has(t));
          const extra = [...tuitionPaidTerms].filter(t => !excelPaidTerms.has(t));
          if (missing.length) console.log(`  缺少: ${missing.map(t=>{const[y,ti]=t.split('_');return y+'T'+ti}).join(',')}`);
          if (extra.length) console.log(`  多余: ${extra.map(t=>{const[y,ti]=t.split('_');return y+'T'+ti}).join(',')}`);
        }
      }
    }
  }

  if (mismatches.length === 0) console.log("未发现 Excel vs 系统 期数不一致");

  // 陈梓扬：按 UI 视角（2026学年 T1-T4）统计
  console.log("\n=== 陈梓扬 UI 视角 ===");
  const cz = await prisma.student.findFirst({
    where: { fullName: "陈梓扬" },
    include: { payments: { include: { items: true } } },
  });
  if (cz) {
    for (let ti = 1; ti <= 4; ti++) {
      const p = cz.payments.find(x => x.year === 2026 && x.termIndex === ti);
      const tuition = p?.items.find(i => i.description === "补习班");
      console.log(`  2026第${ti}期: ${tuition ? '补习班 RM'+(tuition.finalCents/100) : '无账单'}`);
    }
    const p13 = cz.payments.find(x => x.year === 2025 && x.termIndex === 13);
    console.log(`  2025第13期: ${p13 ? '补习班 RM'+(p13.items.find(i=>i.description==='补习班')?.finalCents/100) : '无'}`);
  }

  await prisma.$disconnect();
}
main();
