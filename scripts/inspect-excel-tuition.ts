import * as XLSX from "xlsx";
import * as fs from "fs";
import * as path from "path";

const filePath = process.argv[2] || "C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx";
if (!fs.existsSync(filePath)) {
  console.error("找不到文件:", filePath);
  process.exit(1);
}

const wb = XLSX.readFile(filePath);

function cleanText(v: any): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function parseAmount(v: any): number {
  const s = cleanText(v);
  if (!s || s === "0" || s.toUpperCase() === "FALSE" || s.toUpperCase() === "TRUE" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

// 学生资料
const studentSheet = wb.Sheets["学生资料"];
const studentRows: any[][] = XLSX.utils.sheet_to_json(studentSheet, { header: 1, defval: "", raw: false });
const studentInfo = new Map<string, { grade: string; feeTuition: number }>();
for (let i = 1; i < studentRows.length; i++) {
  const name = cleanText(studentRows[i][1]);
  if (!name) continue;
  studentInfo.set(name, {
    grade: cleanText(studentRows[i][2]),
    feeTuition: parseAmount(studentRows[i][5]),
  });
}

// 检查几个中学生
const secondaryStudents = Array.from(studentInfo.entries())
  .filter(([, v]) => v.grade.startsWith("中") || v.grade.startsWith("F"))
  .slice(0, 8);

console.log("=== 中学生 学生资料 补习班价格 ===");
for (const [name, info] of secondaryStudents) {
  console.log(`  ${name} (${info.grade}): 补习班 RM ${info.feeTuition}`);
}

// 对比 补习/国中/英文 sheet 前几列
for (const sheetName of ["补习", "国中", "英文"]) {
  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  console.log(`\n=== ${sheetName} sheet 表头 ===`);
  console.log("  ", rows[0]?.slice(0, 8));

  console.log(`\n=== ${sheetName} - 中学生样本 (2026 T1-T4) ===`);
  for (const [name] of secondaryStudents) {
    const row = rows.find((r) => cleanText(r[1]) === name);
    if (!row) continue;
    const cols = sheetName === "补习"
      ? [5, 6, 7, 8] // 2026 T1-T4
      : [3, 4, 5, 6]; // 国中/英文 JAN-APR
    const amts = cols.map((c) => parseAmount(row[c]));
    const total = amts.reduce((a, b) => a + b, 0);
    if (total > 0) console.log(`  ${name}: T1-T4 = [${amts.join(", ")}]`);
  }
}

// 找只有中途才有价格的学生 (国中/英文/补习)
console.log("\n=== 中途才开始 (国中/英文/补习 sheet) ===");
for (const sheetName of ["补习", "国中", "英文"]) {
  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
  const cols = sheetName === "补习"
    ? [
        { col: 4, year: 2025, termIndex: 13 },
        { col: 5, year: 2026, termIndex: 1 },
        { col: 6, year: 2026, termIndex: 2 },
        { col: 7, year: 2026, termIndex: 3 },
        { col: 8, year: 2026, termIndex: 4 },
        { col: 9, year: 2026, termIndex: 5 },
      ]
    : [
        { col: 3, year: 2026, termIndex: 1 },
        { col: 4, year: 2026, termIndex: 2 },
        { col: 5, year: 2026, termIndex: 3 },
        { col: 6, year: 2026, termIndex: 4 },
        { col: 7, year: 2026, termIndex: 5 },
      ];

  for (let i = 1; i < rows.length; i++) {
    const name = cleanText(rows[i][1]);
    if (!name) continue;
    const amts = cols.map((c) => ({ ...c, amt: parseAmount(rows[i][c.col]) }));
    const firstPaidIdx = amts.findIndex((a) => a.amt > 0);
    if (firstPaidIdx <= 0) continue; // started from first term or no payment
    const firstPaid = amts[firstPaidIdx];
    console.log(`  [${sheetName}] ${name}: 首次 ${firstPaid.year}T${firstPaid.termIndex} RM${firstPaid.amt}`);
  }
}

// 验证 学生资料 补习班 = 国中+英文 (中学生)
console.log("\n=== 验证 学生资料补习班 = 国中+英文 (中学生) ===");
for (const [name, info] of Array.from(studentInfo.entries()).filter(([, v]) => v.grade.startsWith("中") || v.grade.startsWith("F"))) {
  const guoRow = XLSX.utils.sheet_to_json(wb.Sheets["国中"], { header: 1, defval: "", raw: false }).find((r: any) => cleanText(r[1]) === name) as any[];
  const engRow = XLSX.utils.sheet_to_json(wb.Sheets["英文"], { header: 1, defval: "", raw: false }).find((r: any) => cleanText(r[1]) === name) as any[];
  const guoT1 = guoRow ? parseAmount(guoRow[3]) : 0;
  const engT1 = engRow ? parseAmount(engRow[3]) : 0;
  const sum = guoT1 + engT1;
  if (info.feeTuition > 0 || sum > 0) {
    const match = Math.abs(info.feeTuition - sum) < 1 ? "✓" : "✗";
    console.log(`  ${match} ${name}: 资料=${info.feeTuition} 国中T1=${guoT1}+英文T1=${engT1}=${sum}`);
  }
}
