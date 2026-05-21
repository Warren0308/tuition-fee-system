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
  console.log("=========== 📐 年级 ===========\n");
  const grades = await prisma.grade.findMany({
    orderBy: { orderIndex: "asc" },
    include: {
      _count: { select: { students: true, courseFees: true, extraFees: true } },
    },
  });
  for (const g of grades) {
    const total = g._count.students + g._count.courseFees + g._count.extraFees;
    const mark = total === 0 ? "🗑️" : "✅";
    console.log(
      `   ${mark} id=${String(g.id).padStart(2)}  ${g.name.padEnd(10)}  学生 ${g._count.students}  课程费 ${g._count.courseFees}  额外费率 ${g._count.extraFees}`
    );
  }

  console.log("\n=========== 🏫 学校 ===========\n");
  const schools = await prisma.school.findMany({
    orderBy: { name: "asc" },
    include: { _count: { select: { students: true } } },
  });
  for (const s of schools) {
    const mark = s._count.students === 0 ? "🗑️" : "✅";
    console.log(`   ${mark} id=${String(s.id).padStart(2)}  ${s.name.padEnd(12)}  学生 ${s._count.students}`);
  }

  console.log("\n=========== 📚 课程 ===========\n");
  const courses = await prisma.course.findMany({
    orderBy: { id: "asc" },
    include: {
      _count: { select: { enrollments: true, fees: true, schedules: true, teachers: true } },
    },
  });
  for (const c of courses) {
    const total =
      c._count.enrollments + c._count.fees + c._count.schedules + c._count.teachers;
    const mark = total === 0 ? "🗑️" : "✅";
    console.log(
      `   ${mark} id=${String(c.id).padStart(2)}  ${c.name.padEnd(14)} (${c.code.padEnd(20)} ${c.group.padEnd(11)})  选课 ${c._count.enrollments}  课程费 ${c._count.fees}`
    );
  }

  console.log("\n=========== 👨‍👩‍👧 监护人关系 ===========\n");
  const gts = await prisma.guardianType.findMany({
    include: { _count: { select: { guardians: true } } },
  });
  for (const g of gts) {
    const mark = g._count.guardians === 0 ? "🗑️" : "✅";
    console.log(`   ${mark} id=${String(g.id).padStart(2)}  ${g.name.padEnd(8)}  使用 ${g._count.guardians}`);
  }

  console.log("\n=========== 💸 额外费用类型 ===========\n");
  const efs = await prisma.extraFeeType.findMany({
    include: { _count: { select: { rates: true, studentExtraFees: true } } },
  });
  for (const e of efs) {
    const total = e._count.rates + e._count.studentExtraFees;
    const mark = total === 0 ? "🗑️" : "✅";
    console.log(
      `   ${mark} id=${String(e.id).padStart(2)}  ${e.name.padEnd(8)} (${e.code.padEnd(12)})  费率 ${e._count.rates}  注册 ${e._count.studentExtraFees}`
    );
  }

  console.log("\n🗑️ = 没有任何关联数据，可以安全删除");
  console.log("✅ = 正在使用中，保留\n");

  await prisma.$disconnect();
}
main();
