/**
 * Excel vs DB 对比（只读，不修改）
 * 用法: npx tsx scripts/compare-excel-vs-db.ts "path/to/file.xlsx"
 */
import * as fs from "fs";
import * as path from "path";
import * as XLSX from "xlsx";
import { PrismaClient } from "@prisma/client";
import { DEC_START_SHEET_COLS, JAN_START_SHEET_COLS, termKey } from "./excel-term-mapping";

const EXCEL_PATH =
  process.argv[2] ||
  "C:\\Users\\MSI\\Downloads\\2026优特补习学院 (1).xlsx";

function cleanText(v: unknown): string {
  if (v === undefined || v === null) return "";
  return String(v).trim();
}
function parseAmount(v: unknown): number {
  const s = cleanText(v);
  if (!s || s === "0" || s.toUpperCase() === "FALSE" || s.toUpperCase() === "TRUE" || s.startsWith("#"))
    return 0;
  const n = Number(s.replace(/[,\s]/g, ""));
  return isNaN(n) ? 0 : Math.max(0, n);
}
function fmtTerm(year: number, termIndex: number) {
  return `${year}T${termIndex}`;
}
function fmtMoney(cents: number) {
  return `RM${(cents / 100).toFixed(2)}`;
}

const SHEET_CONFIG: Record<
  string,
  {
    dbDesc: string;
    columns: typeof DEC_START_SHEET_COLS;
    mergeIntoTuition?: boolean;
  }
> = {
  功课班: { dbDesc: "功课班", columns: DEC_START_SHEET_COLS },
  补习: { dbDesc: "补习班", columns: DEC_START_SHEET_COLS, mergeIntoTuition: true },
  写作: { dbDesc: "写作班", columns: DEC_START_SHEET_COLS },
  国中: { dbDesc: "补习班", columns: JAN_START_SHEET_COLS, mergeIntoTuition: true },
  英文: { dbDesc: "补习班", columns: JAN_START_SHEET_COLS, mergeIntoTuition: true },
  交通: { dbDesc: "交通", columns: JAN_START_SHEET_COLS },
  膳食: { dbDesc: "膳食", columns: JAN_START_SHEET_COLS },
};

type TermAmount = Map<string, number>; // key: year_termIndex -> cents

function readExcelPayments(wb: XLSX.WorkBook) {
  const byStudent = new Map<string, Map<string, TermAmount>>(); // name -> desc -> term amounts

  for (const [sheetName, cfg] of Object.entries(SHEET_CONFIG)) {
    const sheet = wb.Sheets[sheetName];
    if (!sheet) continue;
    const rows: unknown[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: false });
    for (let i = 1; i < rows.length; i++) {
      const name = cleanText(rows[i][1]);
      if (!name) continue;
      if (!byStudent.has(name)) byStudent.set(name, new Map());
      const desc = cfg.mergeIntoTuition ? "补习班" : cfg.dbDesc;
      if (!byStudent.get(name)!.has(desc)) byStudent.get(name)!.set(desc, new Map());
      const termMap = byStudent.get(name)!.get(desc)!;

      for (const c of cfg.columns) {
        const amt = parseAmount(rows[i][c.col]);
        if (amt <= 0) continue;
        const k = termKey(c.year, c.termIndex);
        termMap.set(k, (termMap.get(k) || 0) + Math.round(amt * 100));
      }
    }
  }
  return byStudent;
}

async function main() {
  if (!fs.existsSync(EXCEL_PATH)) {
    console.error("找不到 Excel:", EXCEL_PATH);
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error("需要 DATABASE_URL 环境变量");
    process.exit(1);
  }

  const wb = XLSX.readFile(EXCEL_PATH);
  console.log(`Excel: ${EXCEL_PATH}`);
  console.log(`Sheets: ${wb.SheetNames.join(", ")}\n`);

  const prisma = new PrismaClient();
  const students = await prisma.student.findMany({
    select: { id: true, fullName: true, grade: { select: { name: true } } },
  });
  const studentMap = new Map(students.map((s) => [s.fullName, s]));

  const excelPayments = readExcelPayments(wb);

  // 学生资料表
  const infoRows: unknown[][] = XLSX.utils.sheet_to_json(wb.Sheets["学生资料"], {
    header: 1,
    defval: "",
    raw: false,
  });
  const excelStudents = new Set<string>();
  for (let i = 1; i < infoRows.length; i++) {
    const name = cleanText(infoRows[i][1]);
    if (name) excelStudents.add(name);
  }

  const dbOnly = students.filter((s) => !excelStudents.has(s.fullName));
  const excelOnly = [...excelStudents].filter((n) => !studentMap.has(n));

  console.log("=== 1. 学生名单 ===");
  console.log(`  Excel 学生资料: ${excelStudents.size} 人`);
  console.log(`  系统数据库: ${students.length} 人`);
  console.log(`  仅在 Excel: ${excelOnly.length} 人${excelOnly.length ? " — " + excelOnly.slice(0, 10).join("、") + (excelOnly.length > 10 ? "…" : "") : ""}`);
  console.log(`  仅在系统: ${dbOnly.length} 人${dbOnly.length ? " — " + dbOnly.slice(0, 10).map((s) => s.fullName).join("、") + (dbOnly.length > 10 ? "…" : "") : ""}`);

  // DB payments grouped
  const allPayments = await prisma.studentTermPayment.findMany({
    include: { items: true },
  });
  const dbByStudent = new Map<string, Map<string, TermAmount>>();
  for (const p of allPayments) {
    if (!dbByStudent.has(p.studentId)) dbByStudent.set(p.studentId, new Map());
    for (const item of p.items) {
      const desc = item.description;
      if (!dbByStudent.get(p.studentId)!.has(desc))
        dbByStudent.get(p.studentId)!.set(desc, new Map());
      const k = termKey(p.year, p.termIndex);
      const m = dbByStudent.get(p.studentId)!.get(desc)!;
      m.set(k, (m.get(k) || 0) + item.finalCents);
    }
  }

  type Diff = {
    name: string;
    desc: string;
    kind: "missing_term" | "extra_term" | "amount_mismatch";
    term: string;
    excel?: number;
    db?: number;
  };
  const diffs: Diff[] = [];
  const termCountMismatch: { name: string; desc: string; excelTerms: number; dbTerms: number }[] = [];

  const comparedNames = new Set<string>();
  for (const [name, excelItems] of excelPayments) {
    const st = studentMap.get(name);
    if (!st) continue;
    comparedNames.add(name);
    const dbItems = dbByStudent.get(st.id) || new Map();

    const allDescs = new Set([...excelItems.keys(), ...dbItems.keys()]);
    for (const desc of allDescs) {
      const ex = excelItems.get(desc) || new Map();
      const db = dbItems.get(desc) || new Map();
      if (ex.size !== db.size) {
        termCountMismatch.push({ name, desc, excelTerms: ex.size, dbTerms: db.size });
      }
      for (const [k, exCents] of ex) {
        const dbCents = db.get(k);
        if (dbCents === undefined) {
          diffs.push({ name, desc, kind: "missing_term", term: k, excel: exCents });
        } else if (Math.abs(exCents - dbCents) > 1) {
          diffs.push({ name, desc, kind: "amount_mismatch", term: k, excel: exCents, db: dbCents });
        }
      }
      for (const [k, dbCents] of db) {
        if (!ex.has(k)) {
          diffs.push({ name, desc, kind: "extra_term", term: k, db: dbCents });
        }
      }
    }
  }

  console.log("\n=== 2. 已付费用 / 学期 对比（Excel 有记录的学生）===");
  console.log(`  对比学生数: ${comparedNames.size}`);
  console.log(`  学期数量不一致: ${termCountMismatch.length} 条`);
  console.log(`  详细差异: ${diffs.length} 条`);

  const byKind = {
    missing_term: diffs.filter((d) => d.kind === "missing_term"),
    extra_term: diffs.filter((d) => d.kind === "extra_term"),
    amount_mismatch: diffs.filter((d) => d.kind === "amount_mismatch"),
  };
  console.log(`    系统缺少的学期: ${byKind.missing_term.length}`);
  console.log(`    系统多余的学期: ${byKind.extra_term.length}`);
  console.log(`    金额不一致: ${byKind.amount_mismatch.length}`);

  // 按费用类型汇总
  const descStats = new Map<string, { missing: number; extra: number; amount: number }>();
  for (const d of diffs) {
    if (!descStats.has(d.desc)) descStats.set(d.desc, { missing: 0, extra: 0, amount: 0 });
    const s = descStats.get(d.desc)!;
    if (d.kind === "missing_term") s.missing++;
    if (d.kind === "extra_term") s.extra++;
    if (d.kind === "amount_mismatch") s.amount++;
  }
  console.log("\n  按费用类型:");
  for (const [desc, s] of [...descStats.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
    console.log(`    ${desc}: 缺${s.missing} / 多${s.extra} / 金额差${s.amount}`);
  }

  // 学期分布
  const termMissing = new Map<string, number>();
  for (const d of byKind.missing_term) {
    termMissing.set(d.term, (termMissing.get(d.term) || 0) + 1);
  }
  console.log("\n  系统缺少最多的学期:");
  for (const [t, c] of [...termMissing.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8)) {
    const [y, ti] = t.split("_");
    console.log(`    ${fmtTerm(Number(y), Number(ti))}: ${c} 人`);
  }

  // 样本：前15个有差异的学生
  console.log("\n=== 3. 差异样本（前 20 名学生）===");
  const studentsWithDiff = new Set(diffs.map((d) => d.name));
  let shown = 0;
  for (const name of [...studentsWithDiff].sort()) {
    if (shown >= 20) break;
    const stDiffs = diffs.filter((d) => d.name === name);
    console.log(`\n  【${name}】${studentMap.get(name)?.grade?.name || ""}`);
    for (const d of stDiffs.slice(0, 6)) {
      const [y, ti] = d.term.split("_");
      const t = fmtTerm(Number(y), Number(ti));
      if (d.kind === "missing_term")
        console.log(`    ❌ 系统缺 ${d.desc} ${t}: Excel ${fmtMoney(d.excel!)}`);
      else if (d.kind === "extra_term")
        console.log(`    ➕ 系统多 ${d.desc} ${t}: DB ${fmtMoney(d.db!)}`);
      else
        console.log(`    💰 ${d.desc} ${t}: Excel ${fmtMoney(d.excel!)} vs DB ${fmtMoney(d.db!)}`);
    }
    if (stDiffs.length > 6) console.log(`    … 另有 ${stDiffs.length - 6} 条`);
    shown++;
  }

  // 选课 vs Excel 最早付款学期
  console.log("\n=== 4. 选课起始学期 vs Excel 最早付款 ===");
  const enrollments = await prisma.studentEnrollment.findMany({
    include: { course: true, startTerm: true, student: { select: { fullName: true } } },
  });
  const extraFees = await prisma.studentExtraFee.findMany({
    include: { extraFeeType: true, startTerm: true, student: { select: { fullName: true } } },
  });

  const descToExcelSheet: Record<string, string> = {
    补习班: "补习",
    功课班: "功课班",
    写作班: "写作",
    交通: "交通",
    膳食: "膳食",
  };

  let enrollMismatch = 0;
  const enrollSamples: string[] = [];
  for (const en of enrollments) {
    const name = en.student.fullName;
    const excelItems = excelPayments.get(name);
    if (!excelItems) continue;
    let desc = en.course.name;
    if (desc === "写作") desc = "写作班";
    const termMap = excelItems.get(desc === "补习班" ? "补习班" : desc);
    if (!termMap || termMap.size === 0) continue;

    const sorted = [...termMap.keys()].sort();
    const firstKey = sorted[0];
    const [fy, fti] = firstKey.split("_").map(Number);
    const start = en.startTerm;
    if (start.year !== fy || start.termIndex !== fti) {
      enrollMismatch++;
      if (enrollSamples.length < 15) {
        enrollSamples.push(
          `  ${name} ${desc}: Excel 最早 ${fmtTerm(fy, fti)}，系统选课从 ${fmtTerm(start.year, start.termIndex)} 开始`
        );
      }
    }
  }
  console.log(`  选课起始与 Excel 不一致: ${enrollMismatch} 条`);
  for (const s of enrollSamples) console.log(s);

  // 第5期 baseline 提醒
  console.log("\n=== 5. 第5期及以后（系统用第4期 baseline）===");
  const p5Excel = new Map<string, number>();
  for (const [name, items] of excelPayments) {
    let p5 = 0;
    for (const [, termMap] of items) {
      for (const [k, cents] of termMap) {
        const [, ti] = k.split("_").map(Number);
        if (ti === 5) p5 += cents;
      }
    }
    if (p5 > 0) p5Excel.set(name, p5);
  }
  console.log(`  Excel 第5期有付款记录的学生: ${p5Excel.size} 人`);
  const p5WithData = [...p5Excel.entries()].slice(0, 5);
  for (const [n, c] of p5WithData) {
    console.log(`    ${n}: 合计 ${fmtMoney(c)}`);
  }

  // 完全一致统计
  const perfect = [...comparedNames].filter((n) => !studentsWithDiff.has(n)).length;
  console.log("\n=== 总结 ===");
  console.log(`  完全匹配（费用+学期）: ${perfect} / ${comparedNames.size} 人`);
  console.log(`  有差异: ${studentsWithDiff.size} 人`);
  console.log(`  仅在 Excel 无 DB 学生: ${excelOnly.length} 人`);
  console.log(`  选课起始不一致: ${enrollMismatch} 条`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
