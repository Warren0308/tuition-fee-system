import * as XLSX from "xlsx";

const filePath = process.argv[2];
const wb = XLSX.readFile(filePath);

// 详细看 学生资料 表
const sheet = wb.Sheets["学生资料"];
const rows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });

console.log(`学生资料表 - 总行数: ${rows.length}\n`);

// 找出所有非空行
let filledCount = 0;
let emptyCount = 0;
const samples: number[] = [];
for (let i = 1; i < rows.length; i++) {
  const row = rows[i];
  const name = String(row[1] || "").trim();
  if (name && !name.startsWith("#")) {
    filledCount++;
    if (filledCount <= 5 || filledCount % 100 === 0) samples.push(i + 1);
  } else {
    emptyCount++;
  }
}

console.log(`  有姓名 (col 1) 的行: ${filledCount}`);
console.log(`  空行: ${emptyCount}\n`);

console.log("分布抽样：");
for (const rn of samples) {
  console.log(`  行${rn}:`, JSON.stringify(rows[rn - 1].slice(0, 16)));
}

// 看看其他可能含学生的表
console.log("\n\n=== 其他表的学生数 ===");
for (const sn of wb.SheetNames) {
  if (sn === "学生资料" || sn === "优特系统" || sn === "交学费" || sn === "Private" || sn === " 年收入" || sn === "Cell Notes Store") continue;
  const s = wb.Sheets[sn];
  const r: any[][] = XLSX.utils.sheet_to_json(s, { header: 1, defval: "", raw: false });
  const uniqueNames = new Set<string>();
  for (let i = 1; i < r.length; i++) {
    const n = String(r[i][1] || "").trim();
    if (n && !n.startsWith("#") && n.length < 50) uniqueNames.add(n);
  }
  console.log(`  ${sn}: ${uniqueNames.size} 个唯一姓名`);
}
