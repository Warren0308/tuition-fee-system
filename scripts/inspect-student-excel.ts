import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS } from "./excel-term-mapping";

const wb = XLSX.readFile("C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx");

function cleanText(v: unknown) {
  return v == null ? "" : String(v).trim();
}
function parseAmount(v: unknown) {
  const s = cleanText(v);
  if (!s || s === "0" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

const name = process.argv[2] || "郑宇翔";

for (const [sheet, cols] of [
  ["功课班", DEC_START_SHEET_COLS],
  ["补习", DEC_START_SHEET_COLS],
  ["写作", DEC_START_SHEET_COLS],
  ["国中", JAN_START_SHEET_COLS],
  ["英文", JAN_START_SHEET_COLS],
  ["交通", JAN_START_SHEET_COLS],
  ["膳食", JAN_START_SHEET_COLS],
] as const) {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
    header: 1,
    defval: "",
    raw: false,
  });
  const row = rows.find((r) => cleanText(r[1]) === name);
  if (!row) continue;
  console.log(`\n=== ${sheet} ===`);
  for (const c of cols) {
    const amt = parseAmount(row[c.col]);
    if (amt > 0) {
      const period = c.year === 2025 && c.termIndex === 13 ? "第1期" : `第${c.termIndex + 1}期`;
      console.log(`  col${c.col} ${c.year}T${c.termIndex} (${period}): RM${amt}`);
    }
  }
}
