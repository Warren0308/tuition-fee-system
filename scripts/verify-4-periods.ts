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
import { calculateUnpaidForStudent } from "../src/lib/billing-utils";

const prisma = new PrismaClient();

async function termStatus(studentId: string, gradeId: number, year: number, termIndex: number) {
  const term = await prisma.term.findFirst({ where: { year, termIndex } });
  if (!term) return "?";
  const pay = await prisma.studentTermPayment.findFirst({ where: { studentId, year, termIndex } });
  const summary = await calculateUnpaidForStudent(studentId, term.id, gradeId);
  if (pay && summary.unpaidTotal === 0) return "✅缴清";
  if (pay && summary.unpaidTotal > 0) return "⚠️部分";
  if (!pay && summary.unpaidTotal > 0) return "❌未结算";
  if (!pay && summary.unpaidTotal === 0) return "—";
  return "?";
}

async function main() {
  const terms = [
    { year: 2025, termIndex: 13, label: "第1期(T13)" },
    { year: 2026, termIndex: 1, label: "第2期(T1)" },
    { year: 2026, termIndex: 2, label: "第3期(T2)" },
    { year: 2026, termIndex: 3, label: "第4期(T3)" },
    { year: 2026, termIndex: 4, label: "第5期(T4)" },
  ];

  const names = ["沈慧萱", "郑宇翔", "吕禹彤", "庞宇葵", "罗毅睿", "黄蒽怡", "陈芷瑩", "M.Ditikka"];

  console.log("=== 前5期状态（JAN=第1期 ... APR=第4期 ... MAY=第5期）===\n");
  for (const name of names) {
    const st = await prisma.student.findFirst({ where: { fullName: name } });
    if (!st) continue;
    const statuses = await Promise.all(terms.map(t => termStatus(st.id, st.gradeId, t.year, t.termIndex)));
    console.log(`${name.padEnd(12)} ${terms.map((t, i) => `${t.label}:${statuses[i]}`).join("  ")}`);
  }

  // 统计前4期全部缴清的学生数
  const students = await prisma.student.findMany({ where: { isActive: true } });
  let all4Paid = 0, t4Unsettled = 0;
  for (const st of students) {
    const s = await Promise.all([
      termStatus(st.id, st.gradeId, 2025, 13),
      termStatus(st.id, st.gradeId, 2026, 1),
      termStatus(st.id, st.gradeId, 2026, 2),
      termStatus(st.id, st.gradeId, 2026, 3),
    ]);
    if (s.every(x => x === "✅缴清")) all4Paid++;
    const t4 = await termStatus(st.id, st.gradeId, 2026, 4);
    if (t4 === "❌未结算") t4Unsettled++;
  }
  console.log(`\n前4期全部缴清: ${all4Paid}/${students.length} 人`);
  console.log(`第5期(T4)未结算: ${t4Unsettled} 人`);

  await prisma.$disconnect();
}
main();
