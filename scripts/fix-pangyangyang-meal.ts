/** 修正庞扬阳膳食：第3期不收，拆成第2期与第4期两段 */
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

const prisma = new PrismaClient();
const NAME = "庞扬阳";

async function main() {
  const student = await prisma.student.findFirst({ where: { fullName: NAME } });
  if (!student) {
    console.log("找不到学生");
    return;
  }

  const terms = await getAcademicYearTerms();
  const p2 = terms.find((t) => t.period === 2)!;
  const p4 = terms.find((t) => t.period === 4)!;

  const meals = await prisma.studentExtraFee.findMany({
    where: { studentId: student.id, extraFeeType: { code: "MEAL" } },
    include: { extraFeeType: true },
  });

  console.log("修正前:", meals.length, "条膳食记录");

  await prisma.$transaction(async (tx) => {
    for (const m of meals) {
      await tx.studentExtraFee.delete({ where: { id: m.id } });
    }
    await tx.studentExtraFee.create({
      data: {
        studentId: student.id,
        extraFeeTypeId: meals[0]?.extraFeeTypeId ?? (
          await tx.extraFeeType.findFirst({ where: { code: "MEAL" } })
        )!.id,
        startTermId: p2.id,
        endTermId: p2.id,
        amountCents: 4000,
      },
    });
    await tx.studentExtraFee.create({
      data: {
        studentId: student.id,
        extraFeeTypeId: meals[0]?.extraFeeTypeId ?? (
          await tx.extraFeeType.findFirst({ where: { code: "MEAL" } })
        )!.id,
        startTermId: p4.id,
        endTermId: p4.id,
        amountCents: 1500,
      },
    });
  });

  console.log("✅ 膳食已拆为：第2期 RM40、第4期 RM15；第3期不再计费");
}

main().finally(() => prisma.$disconnect());
