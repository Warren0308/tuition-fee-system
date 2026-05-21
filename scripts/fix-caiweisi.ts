/**
 * 修正蔡微思：仅第1期有补习，Excel 第2-4期误填
 * 用法: npx tsx scripts/fix-caiweisi.ts [--commit]
 */
import * as fs from "fs";
import * as path from "path";

const envPath = path.join(__dirname, "..", ".env");
if (fs.existsSync(envPath)) {
  for (const line of fs.readFileSync(envPath, "utf-8").split(/\r?\n/)) {
    const t = line.trim();
    if (!t || t.startsWith("#")) continue;
    const i = t.indexOf("=");
    if (i < 0) continue;
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim();
  }
}

import { PrismaClient } from "@prisma/client";
import { getAcademicYearTerms } from "../src/lib/academic-year";
import { stopStudentTutoring } from "../src/lib/student-billing-eligibility";

const prisma = new PrismaClient();
const isCommit = process.argv.includes("--commit");
const NAME = "蔡微思";

async function main() {
  const student = await prisma.student.findFirst({ where: { fullName: NAME } });
  if (!student) {
    console.log("找不到学生");
    return;
  }

  const terms = await getAcademicYearTerms();
  const period1 = terms.find((t) => t.period === 1);
  if (!period1) {
    console.log("找不到第1期");
    return;
  }

  const badPayments = await prisma.studentTermPayment.findMany({
    where: {
      studentId: student.id,
      NOT: { year: period1.year, termIndex: period1.termIndex },
    },
    include: { items: true },
  });

  const homeworkEnrollments = await prisma.studentEnrollment.findMany({
    where: { studentId: student.id, course: { code: "HOMEWORK" } },
    include: { course: true },
  });

  console.log("=== 计划修正 ===");
  console.log(`学生: ${student.fullName} (${student.id})`);
  console.log(`保留第1期账单: ${period1.year}T${period1.termIndex}`);
  console.log(`删除误导入账单 ${badPayments.length} 张:`);
  for (const p of badPayments) {
    const period = terms.find((t) => t.year === p.year && t.termIndex === p.termIndex)?.period;
    console.log(`  - 第${period}期 ${p.year}T${p.termIndex} RM${p.totalCents / 100}`);
  }
  console.log(`删除功课班选课 ${homeworkEnrollments.length} 条（Excel 无功课班缴费）`);
  console.log(`停止补习：最后就读第1期 (termId=${period1.id})`);

  if (!isCommit) {
    console.log("\n确认执行: npx tsx scripts/fix-caiweisi.ts --commit");
    return;
  }

  await prisma.$transaction(async (tx) => {
    for (const p of badPayments) {
      await tx.studentTermPaymentItem.deleteMany({ where: { paymentId: p.id } });
      await tx.studentTermPayment.delete({ where: { id: p.id } });
    }
    for (const e of homeworkEnrollments) {
      await tx.studentEnrollment.delete({ where: { id: e.id } });
    }
    await tx.studentChangeLog.create({
      data: {
        studentId: student.id,
        action: "DATA_FIX",
        before: { badPaymentIds: badPayments.map((p) => p.id) },
        after: {
          reason: "Excel 英文表 FEB-APR 误填，仅保留第1期",
          keptPeriod: 1,
        },
      },
    });
  });

  await stopStudentTutoring(student.id, period1.id);

  console.log("\n✅ 已修正");
}

main().finally(() => prisma.$disconnect());
