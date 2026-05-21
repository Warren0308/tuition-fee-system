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

async function checkStudent(name: string) {
  const student = await prisma.student.findFirst({
    where: { fullName: name },
    include: {
      grade: true,
      enrollments: { include: { course: true, startTerm: true } },
      payments: { include: { items: true }, orderBy: [{ year: "asc" }, { termIndex: "asc" }] },
    },
  });
  if (!student) { console.log(`找不到 ${name}`); return; }

  console.log(`\n======== ${name} (${student.grade?.name}) ========`);
  for (const e of student.enrollments) {
    console.log(`  ENR: ${e.course.name} start=${e.startTerm.year}T${e.startTerm.termIndex} price=${e.customPriceCents} subjects=${JSON.stringify(e.subjectCourseIds)}`);
  }
  for (const p of student.payments) {
    const items = p.items.map(i => `${i.description}(RM${i.finalCents/100})`).join(", ");
    console.log(`  PAY ${p.year}T${p.termIndex}: total=RM${p.totalCents/100} [${items}]`);
  }

  const terms = await prisma.term.findMany({
    where: { year: 2026, termIndex: { lte: 5 } },
    orderBy: { termIndex: "asc" },
  });
  for (const t of terms) {
    const summary = await calculateUnpaidForStudent(student.id, t.id, student.gradeId);
    const status = summary.unpaidTotal === 0 ? "✅ 缴清" : summary.unpaidTotal > 0 ? `❌ 欠 RM${summary.unpaidTotal/100}` : "—";
    const unpaid = [...summary.unpaidCourses, ...summary.unpaidExtraFees].map(u => u.name).join(",");
    console.log(`  T${t.termIndex}: ${status}${unpaid ? ` (${unpaid})` : ""}`);
  }
}

async function main() {
  for (const name of ["郑宇翔", "庞宇葵", "王妍懿", "M.Ditikka", "沈慧萱", "吕禹彤"]) {
    await checkStudent(name);
  }
  await prisma.$disconnect();
}
main();
