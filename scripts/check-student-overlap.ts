import * as XLSX from "xlsx";

const filePath = process.argv[2];
const wb = XLSX.readFile(filePath);

const masterSheet = wb.Sheets["学生资料"];
const masterRows: any[][] = XLSX.utils.sheet_to_json(masterSheet, { header: 1, defval: "", raw: false });
const masterNames = new Set<string>();
for (let i = 1; i < masterRows.length; i++) {
  const n = String(masterRows[i][1] || "").trim();
  if (n && !n.startsWith("#")) masterNames.add(n);
}

console.log(`学生资料表共 ${masterNames.size} 个学生\n`);

// 其他表的学生，找出不在 master 里的
const otherSheets = ["功课班", "写作", "补习", "国中", "交通", "英文", "膳食", "中学补习"];
const allMissing = new Set<string>();
for (const sn of otherSheets) {
  const s = wb.Sheets[sn];
  if (!s) continue;
  const r: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, defval: "", raw: false });
  const missing: string[] = [];
  const present: string[] = [];
  for (let i = 1; i < r.length; i++) {
    const n = String(r[i][1] || "").trim();
    if (n && !n.startsWith("#") && n.length < 50) {
      if (!masterNames.has(n)) {
        if (!missing.includes(n)) missing.push(n);
        allMissing.add(n);
      } else {
        if (!present.includes(n)) present.push(n);
      }
    }
  }
  console.log(`${sn}: 唯一姓名 ${missing.length + present.length}, 在主表中 ${present.length}, 不在主表 ${missing.length}`);
  if (missing.length > 0 && missing.length <= 20) {
    console.log(`   不在主表的: ${missing.join(", ")}`);
  }
}

console.log(`\n汇总: 不在「学生资料」主表里的姓名共 ${allMissing.size} 个`);
if (allMissing.size > 0 && allMissing.size <= 40) {
  console.log(`   全部: ${Array.from(allMissing).join(", ")}`);
}
