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
  // 找一个有补习付款的学生
  const student = await prisma.student.findFirst({
    where: { fullName: "吕禹彤" },
    include: {
      grade: true,
      payments: {
        include: { items: true },
        orderBy: [{ year: "asc" }, { termIndex: "asc" }],
      },
      enrollments: { include: { course: true } },
    },
  });

  if (!student) {
    console.log("找不到吕禹彤");
    return;
  }

  console.log(`学生：${student.fullName} (${student.grade?.name})\n`);

  console.log("=== 选课记录 ===");
  for (const e of student.enrollments) {
    console.log(`  课程 id=${e.courseId} (${e.course.name}, code=${e.course.code})  起始学期 id=${e.startTermId}  customPrice=${e.customPriceCents}`);
  }

  console.log("\n=== 付款账单 ===");
  for (const p of student.payments) {
    console.log(`\n  ${p.year}年第${p.termIndex}学期账单 (id=${p.id.slice(0, 8)}...): 总额 RM ${(p.totalCents / 100).toFixed(2)}, paidAt=${p.paidAt?.toISOString().slice(0, 10) || "未付"}`);
    for (const it of p.items) {
      console.log(`     - ${it.description.padEnd(8)} | type=${it.itemType.padEnd(11)} | refId=${it.refId}  | RM ${(it.finalCents / 100).toFixed(2)}`);
    }
  }

  // 查所有现有 courseId
  console.log("\n=== 现有课程 IDs ===");
  const courses = await prisma.course.findMany({ orderBy: { id: "asc" } });
  for (const c of courses) {
    console.log(`  id=${c.id}  ${c.name.padEnd(14)} (${c.code})`);
  }

  // 查所有现有 extraFeeType IDs
  console.log("\n=== 现有额外费用 IDs ===");
  const efs = await prisma.extraFeeType.findMany({ orderBy: { id: "asc" } });
  for (const e of efs) {
    console.log(`  id=${e.id}  ${e.name.padEnd(8)} (${e.code})`);
  }

  await prisma.$disconnect();
}
main();
