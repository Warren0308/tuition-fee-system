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
const prisma = new PrismaClient();

async function main() {
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });
  console.log("=== Courses ===");
  for (const c of courses) console.log(`  id=${c.id} ${c.name} (${c.code}) group=${c.group}`);

  const secEnrollments = await prisma.studentEnrollment.findMany({
    where: { course: { code: { in: ["SECONDARY_TUITION", "ENGLISH_CLASS", "SEC_BM", "SEC_EN"] } } },
    include: { student: true, course: true, startTerm: true },
  });
  console.log(`\n=== 中学国文/英文 enrollments: ${secEnrollments.length} ===`);
  for (const e of secEnrollments.slice(0, 10)) {
    console.log(`  ${e.student.fullName} | ${e.course.name} | start=${e.startTerm.year}T${e.startTerm.termIndex} | price=${e.customPriceCents}`);
  }

  const tuitionEnrollments = await prisma.studentEnrollment.findMany({
    where: { course: { code: "TUITION_CLASS" } },
    include: { student: { include: { grade: true } }, course: true, startTerm: true },
  });
  console.log(`\n=== 补习班 enrollments: ${tuitionEnrollments.length} ===`);

  const secPaymentItems = await prisma.studentTermPaymentItem.findMany({
    where: { description: { in: ["中学国文", "中学英文", "国中", "英文"] } },
    take: 20,
  });
  console.log(`\n=== 中学国文/英文 payment items: ${secPaymentItems.length} total (show 20) ===`);
  for (const it of secPaymentItems) console.log(`  ${it.description} refId=${it.refId} RM${it.finalCents/100}`);

  // Sample student with unpaid issues
  const students = await prisma.student.findMany({
    where: { isActive: true },
    include: {
      grade: true,
      enrollments: { include: { course: true, startTerm: true } },
      payments: { include: { items: true, term: true } },
    },
    take: 5,
  });

  for (const s of students.slice(0, 3)) {
    console.log(`\n--- ${s.fullName} (${s.grade?.name}) ---`);
    for (const e of s.enrollments) {
      console.log(`  ENR: ${e.course.name} start=${e.startTerm.year}T${e.startTerm.termIndex} price=${e.customPriceCents}`);
    }
    for (const p of s.payments.slice(0, 4)) {
      const items = p.items.map(i => i.description).join(", ");
      console.log(`  PAY ${p.year}T${p.termIndex}: ${items}`);
    }
  }

  await prisma.$disconnect();
}
main();
