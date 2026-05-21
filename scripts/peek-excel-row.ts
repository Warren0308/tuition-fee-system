import * as XLSX from "xlsx";

const wb = XLSX.readFile("C:\\Users\\MSI\\Downloads\\2026优特补习学院.xlsx");
const name = process.argv[2] || "蔡微思";

for (const sheet of ["英文", "补习", "功课班", "学生资料"]) {
  const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], {
    header: 1,
    defval: "",
    raw: false,
  });
  const header = rows[0] as string[];
  const row = rows.find((r) => String(r[1] ?? "").trim() === name);
  if (!row) continue;
  console.log(`\n=== ${sheet} ===`);
  console.log("Headers:", header.slice(0, 16).map((h, i) => `[${i}]${h}`).join(" | "));
  console.log("Values:", row.slice(0, 16).map((v, i) => `[${i}]${v}`).join(" | "));
}
