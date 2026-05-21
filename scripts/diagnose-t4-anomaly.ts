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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import { PrismaClient } from "@prisma/client";
import { calculateUnpaidForStudent } from "../src/lib/billing-utils";

const prisma = new PrismaClient();

async function main() {
  const t4 = await prisma.term.findFirst({ where: { year: 2026, termIndex: 4 } });
  if (!t4) {
    console.log("no T4 term");
    return;
  }
  console.log("=== 第5期 = 2026T4 ===\n");

  const payments = await prisma.studentTermPayment.findMany({
    where: { year: 2026, termIndex: 4 },
    include: {
      student: { select: { id: true, fullName: true, gradeId: true } },
      items: true,
    },
    orderBy: { totalCents: "asc" },
  });
  console.log(`系统 T4 账单总数: ${payments.length}\n`);

  // 异常：有账单但 T4 无选课
  console.log("=== 有 T4 账单但 T4 无有效选课 ===");
  for (const p of payments) {
    const ens = await prisma.studentEnrollment.findMany({
      where: {
        studentId: p.studentId,
        startTermId: { lte: t4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: t4.id } }],
      },
      include: { course: true, startTerm: true, endTerm: true },
    });
    if (ens.length === 0) {
      const unpaid = await calculateUnpaidForStudent(p.studentId, t4.id, p.student.gradeId);
      console.log(`\n${p.student.fullName}`);
      console.log(`  账单: RM${(p.totalCents / 100).toFixed(2)}, ${p.items.length} 项`);
      for (const i of p.items) {
        console.log(`    - ${i.itemType} ${i.label} RM${(i.amountCents / 100).toFixed(2)}`);
      }
      console.log(`  未付: RM${(unpaid.unpaidTotal / 100).toFixed(2)} → UI: ${unpaid.unpaidTotal === 0 ? "全部缴清" : "部分缴清"}`);

      const allEns = await prisma.studentEnrollment.findMany({
        where: { studentId: p.studentId },
        include: { course: true, startTerm: true, endTerm: true },
        orderBy: { startTermId: "asc" },
      });
      console.log(`  全部选课 (${allEns.length}):`);
      for (const e of allEns) {
        console.log(
          `    ${e.course.name} start=${e.startTerm?.year}T${e.startTerm?.termIndex} end=${e.endTerm ? `${e.endTerm.year}T${e.endTerm.termIndex}` : "null"}`
        );
      }
    }
  }

  // RM0.50 账单
  console.log("\n\n=== T4 账单金额 = RM0.50 ===");
  for (const p of payments.filter((x) => x.totalCents === 50)) {
    console.log(p.student.fullName, p.items.map((i) => `${i.label}=${i.amountCents}`).join(", "));
  }

  // 小额 (< RM10)
  console.log("\n=== T4 账单 < RM10 ===");
  for (const p of payments.filter((x) => x.totalCents < 1000)) {
    const ens = await prisma.studentEnrollment.count({
      where: {
        studentId: p.studentId,
        startTermId: { lte: t4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: t4.id } }],
      },
    });
    console.log(`${p.student.fullName}: RM${(p.totalCents / 100).toFixed(2)}, 选课数=${ens}`);
  }

  // 全部 T4 账单明细
  console.log("\n\n=== 全部 T4 账单 ===");
  for (const p of payments) {
    const ens = await prisma.studentEnrollment.findMany({
      where: {
        studentId: p.studentId,
        startTermId: { lte: t4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: t4.id } }],
      },
      include: { course: true },
    });
    const efs = await prisma.studentExtraFee.findMany({
      where: {
        studentId: p.studentId,
        startTermId: { lte: t4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: t4.id } }],
      },
      include: { extraFeeType: true },
    });
    console.log(
      `${p.student.fullName}: RM${(p.totalCents / 100).toFixed(2)} | 选课=[${ens.map((e) => e.course.name).join(",")}] | 额外=[${efs.map((e) => e.extraFeeType.name).join(",")}]`
    );
  }
}

main().finally(() => prisma.$disconnect());
