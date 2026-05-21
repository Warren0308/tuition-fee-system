import * as XLSX from "xlsx";
const wb = XLSX.readFile("C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx");
for (const sheet of ["国中", "英文", "功课班", "补习", "交通"]) {
  const rows: any[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
  console.log(`\n${sheet} headers:`, rows[0].slice(3, 9));
  for (const name of ["沈慧萱", "罗毅睿", "黄蒽怡", "庞宇葵", "陈芷瑩"]) {
    const row = rows.find((r) => String(r[1]).trim() === name);
    if (!row) continue;
    console.log(`  ${name}:`, [3, 4, 5, 6, 7, 8].map((c) => row[c] || "-").join(" | "));
  }
}
