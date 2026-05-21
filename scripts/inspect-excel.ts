import * as XLSX from "xlsx";
import * as path from "path";

const filePath = process.argv[2];
if (!filePath) {
  console.error("用法: npx tsx scripts/inspect-excel.ts <excel文件路径>");
  process.exit(1);
}

const wb = XLSX.readFile(filePath);

console.log("📚 工作簿包含以下工作表：");
wb.SheetNames.forEach((name, i) => console.log(`  ${i + 1}. ${name}`));
console.log();

for (const sheetName of wb.SheetNames) {
  console.log("=".repeat(80));
  console.log(`📋 工作表: ${sheetName}`);
  console.log("=".repeat(80));

  const sheet = wb.Sheets[sheetName];
  const rows: any[][] = XLSX.utils.sheet_to_json(sheet, {
    header: 1,
    defval: "",
    raw: false,
  });

  console.log(`总行数: ${rows.length}`);
  if (rows.length === 0) {
    console.log("（空表）\n");
    continue;
  }

  console.log("\n--- 前 8 行预览 ---");
  rows.slice(0, 8).forEach((row, i) => {
    console.log(`行${i + 1}:`, JSON.stringify(row.slice(0, 20)));
  });

  if (rows.length > 8) {
    console.log("\n--- 最后 2 行预览 ---");
    rows.slice(-2).forEach((row, i) => {
      console.log(`行${rows.length - 1 + i}:`, JSON.stringify(row.slice(0, 20)));
    });
  }
  console.log();
}
