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
import { JAN_START_SHEET_COLS, DEC_START_SHEET_COLS } from "./excel-term-mapping";

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

  console.log("=== 综合：Excel 最多几期 vs 系统补习班几期 ===\n");

  const allNames = new Set<string>();
  for (const sheet of ["国中", "英文", "补习", "功课班", "写作"]) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    for (let i = 1; i < rows.length; i++) {
      const n = cleanText(rows[i][1]);
      if (n) allNames.add(n);
    }
  }

  for (const name of allNames) {
    const sid = sm.get(name);
    if (!sid) continue;

    const excelTerms = new Set<string>();
    for (const [sheet, cols] of [
      ["国中", JAN_START_SHEET_COLS],
      ["英文", JAN_START_SHEET_COLS],
      ["补习", DEC_START_SHEET_COLS],
      ["功课班", DEC_START_SHEET_COLS],
      ["写作", DEC_START_SHEET_COLS],
    ] as const) {
      const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
      const row = rows.find(r => cleanText(r[1]) === name);
      if (!row) continue;
      for (const c of cols) {
        if (parseAmount(row[c.col]) > 0) excelTerms.add(`${c.year}_${c.termIndex}`);
      }
    }

    const payments = await prisma.studentTermPayment.findMany({
      where: { studentId: sid },
      include: { items: true },
    });
    const sysTerms = new Set<string>();
    for (const p of payments) {
      if (p.items.some(it => it.description === "补习班")) sysTerms.add(`${p.year}_${p.termIndex}`);
    }

    if (excelTerms.size === 0) continue;
    if (excelTerms.size !== sysTerms.size) {
      const fmt = (s: Set<string>) => [...s].sort().map(t => { const [y,ti]=t.split('_'); return `${y}T${ti}`; }).join(',');
      console.log(`${name}: Excel=${excelTerms.size}期 [${fmt(excelTerms)}] 系统=${sysTerms.size}期 [${fmt(sysTerms)}]`);
    }
  }

  await prisma.$disconnect();
}
main();
