/** 归一化对比：写作→写作班，忽略材料费等 Excel 无列项 */
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS, termKey } from "./excel-term-mapping";

const EXCEL = process.argv[2] || "C:\\Users\\MSI\\Downloads\\2026优特补习学院 (1).xlsx";

function clean(v: unknown) { return v == null ? "" : String(v).trim(); }
function parseAmount(v: unknown) {
  const s = clean(v);
  if (!s || s === "0" || s.startsWith("#")) return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}

const wb = XLSX.readFile(EXCEL);
const prisma = new PrismaClient();

async function main() {
  const students = await prisma.student.findMany({
    select: { id: true, fullName: true, grade: { select: { name: true } } },
  });
  const sm = new Map(students.map((s) => [s.fullName, s]));

  type TermMap = Map<string, number>;
  type StudentMap = Map<string, TermMap>;
  const excel = new Map<string, StudentMap>();

  const sheets: [string, typeof DEC_START_SHEET_COLS, boolean][] = [
    ["功课班", DEC_START_SHEET_COLS, false],
    ["补习", DEC_START_SHEET_COLS, true],
    ["写作", DEC_START_SHEET_COLS, false],
    ["国中", JAN_START_SHEET_COLS, true],
    ["英文", JAN_START_SHEET_COLS, true],
    ["交通", JAN_START_SHEET_COLS, false],
    ["膳食", JAN_START_SHEET_COLS, false],
  ];

  for (const [sheet, cols, mergeTuition] of sheets) {
    const rows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets[sheet], { header: 1, defval: "", raw: false });
    for (let i = 1; i < rows.length; i++) {
      const name = clean(rows[i][1]);
      if (!name) continue;
      if (!excel.has(name)) excel.set(name, new Map());
      const desc = mergeTuition ? "补习班" : sheet === "写作" ? "写作班" : sheet;
      if (!excel.get(name)!.has(desc)) excel.get(name)!.set(desc, new Map());
      const tm = excel.get(name)!.get(desc)!;
      for (const c of cols) {
        const a = parseAmount(rows[i][c.col]);
        if (a <= 0) continue;
        const k = termKey(c.year, c.termIndex);
        tm.set(k, (tm.get(k) || 0) + Math.round(a * 100));
      }
    }
  }

  const payments = await prisma.studentTermPayment.findMany({ include: { items: true } });
  const db = new Map<string, StudentMap>();
  for (const p of payments) {
    if (!db.has(p.studentId)) db.set(p.studentId, new Map());
    for (const it of p.items) {
      let desc = it.description;
      if (desc === "写作") desc = "写作班";
      const k = termKey(p.year, p.termIndex);
      if (!db.get(p.studentId)!.has(desc)) db.get(p.studentId)!.set(desc, new Map());
      const tm = db.get(p.studentId)!.get(desc)!;
      tm.set(k, (tm.get(k) || 0) + it.finalCents);
    }
  }

  const IGNORE_DB_ONLY = new Set(["材料费", "材料费、报名费", "膳食（临时）"]);
  const CORE = ["补习班", "功课班", "写作班", "交通", "膳食"];

  let perfect = 0;
  const t5Missing = new Set<string>();
  const tuitionAmt: string[] = [];
  const homeworkT5Extra = new Set<string>();
  const mealTransportIssues: string[] = [];
  const stillDiff: string[] = [];

  for (const [name, exItems] of excel) {
    const st = sm.get(name);
    if (!st) continue;
    const dbItems = db.get(st.id) || new Map();
    let ok = true;

    for (const desc of CORE) {
      const ex = exItems.get(desc) || new Map();
      const d = dbItems.get(desc) || new Map();
      for (const [k, c] of ex) {
        const dc = d.get(k);
        if (dc === undefined) {
          ok = false;
          const ti = Number(k.split("_")[1]);
          if (ti === 5 && desc === "补习班") t5Missing.add(name);
          else if (desc === "膳食" || desc === "交通")
            mealTransportIssues.push(`${name} 缺${desc} ${k} Excel RM${c / 100}`);
        } else if (Math.abs(c - dc) > 1) {
          ok = false;
          if (desc === "补习班") tuitionAmt.push(`${name} ${k}: Excel RM${c / 100} vs DB RM${dc / 100}`);
        }
      }
      for (const [k, dc] of d) {
        if (ex.has(k) || IGNORE_DB_ONLY.has(desc)) continue;
        ok = false;
        if (desc === "功课班" && Number(k.split("_")[1]) === 5) homeworkT5Extra.add(name);
      }
    }
    if (ok) perfect++;
    else stillDiff.push(name);
  }

  console.log("=== 归一化对比（写作=写作班，忽略材料费）===");
  console.log(`完全匹配: ${perfect} / 48 人`);
  console.log(`仍有差异: ${stillDiff.length} 人\n`);

  console.log(`【补习班 第5期】Excel 有、系统无: ${t5Missing.size} 人`);
  console.log(`  ${[...t5Missing].join("、")}\n`);

  console.log(`【补习班 金额不一致】: ${tuitionAmt.length} 条`);
  for (const s of tuitionAmt) console.log(`  ${s}`);
  console.log();

  console.log(`【功课班 系统多第5期（Excel 无）】: ${homeworkT5Extra.size} 人`);
  console.log(`  ${[...homeworkT5Extra].join("、")}\n`);

  if (mealTransportIssues.length) {
    console.log(`【交通/膳食 系统缺】: ${mealTransportIssues.length} 条`);
    for (const s of mealTransportIssues.slice(0, 10)) console.log(`  ${s}`);
  }

  // 中学生国中+英文 vs 学生资料补习班
  console.log("\n=== 中学生：学生资料补习班 vs 国中T1+英文T1 ===");
  const infoRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets["学生资料"], { header: 1, defval: "", raw: false });
  let secMismatch = 0;
  for (let i = 1; i < infoRows.length; i++) {
    const name = clean(infoRows[i][1]);
    const grade = clean(infoRows[i][2]);
    if (!name || (!grade.startsWith("中") && !grade.startsWith("F"))) continue;
    const feeInfo = parseAmount(infoRows[i][5]);
    const guoRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets["国中"], { header: 1, defval: "", raw: false });
    const engRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets["英文"], { header: 1, defval: "", raw: false });
    const gr = guoRows.find((r) => clean(r[1]) === name);
    const er = engRows.find((r) => clean(r[1]) === name);
    const sum = (gr ? parseAmount(gr[3]) : 0) + (er ? parseAmount(er[3]) : 0);
    if (feeInfo > 0 && Math.abs(feeInfo - sum) > 1) {
      secMismatch++;
      if (secMismatch <= 8) console.log(`  ${name}: 资料=${feeInfo} 国中+英文T1=${sum}`);
    }
  }
  console.log(`  不一致: ${secMismatch} 人（Excel 内部）`);

  await prisma.$disconnect();
}

main();
