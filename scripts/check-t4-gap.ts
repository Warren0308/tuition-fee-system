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
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS } from "./excel-term-mapping";

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

  // 统计各 sheet T4 对应列有付款的学生
  const t4Expected = new Set<string>();

  for (const [sheet, cols, colIdx] of [
    ["功课班", DEC_START_SHEET_COLS, 8],
    ["补习", DEC_START_SHEET_COLS, 8],
    ["写作", DEC_START_SHEET_COLS, 8],
    ["国中", JAN_START_SHEET_COLS, 7], // MAY = T4
    ["英文", JAN_START_SHEET_COLS, 7],
    ["交通", JAN_START_SHEET_COLS, 7],
    ["膳食", JAN_START_SHEET_COLS, 7],
  ] as const) {
    const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    const mapped = cols.find(c => c.col === colIdx)!;
    let count = 0;
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      const amt = parseAmount(rows[i][colIdx]);
      if (amt > 0 && sm.has(name)) {
        count++;
        t4Expected.add(name);
      }
    }
    console.log(`${sheet} col${colIdx} (${mapped.year}T${mapped.termIndex}): ${count} 人有付款`);
  }

  console.log(`\nExcel T4 应有付款的唯一学生: ${t4Expected.size}`);

  // 系统 T4 有账单
  const t4Payments = await prisma.studentTermPayment.findMany({
    where: { year: 2026, termIndex: 4 },
    include: { student: true },
  });
  console.log(`系统 T4 有账单: ${t4Payments.length}`);

  const t4PaidNames = new Set(t4Payments.map(p => p.student.fullName));
  const missing = [...t4Expected].filter(n => !t4PaidNames.has(n));
  console.log(`\nExcel T4有付但系统无T4账单 (${missing.length}):`);
  missing.forEach(n => console.log(`  ${n}`));

  // 反过来：系统T4有但Excel T4列无
  const extra = [...t4PaidNames].filter(n => !t4Expected.has(n));
  console.log(`\n系统T4有但Excel T4列无 (${extra.length}):`, extra.join(", "));

  await prisma.$disconnect();
}
main();
