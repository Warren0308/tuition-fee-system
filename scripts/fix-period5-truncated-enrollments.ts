/**
 * 修正因 Excel 第5期数据不完整而误设的 endTermId=第4期。
 *
 * 规则：若学生仍有其他在读项目（endTermId 为空或晚于第4期），
 * 则将在第4期结束的项目恢复为在读（endTermId=null）。
 *
 * 用法: npx tsx scripts/fix-period5-truncated-enrollments.ts [--commit]
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
    let v = t.slice(i + 1).trim();
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'")))
      v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import { PrismaClient } from "@prisma/client";
import { findTermByPeriod, getAcademicYearTerms } from "../src/lib/academic-year";
import { FEE_BASELINE_PERIOD } from "../src/lib/fee-baseline";

const prisma = new PrismaClient();
const isCommit = process.argv.includes("--commit");

async function main() {
  const terms = await getAcademicYearTerms();
  const p4 = findTermByPeriod(terms, FEE_BASELINE_PERIOD);
  if (!p4) {
    console.error("找不到第4期");
    process.exit(1);
  }

  console.log(`第4期 term id=${p4.id} (${p4.year}T${p4.termIndex})\n`);

  const students = await prisma.student.findMany({
    where: { isActive: true },
    include: {
      enrollments: { include: { course: true } },
      extraFees: { include: { extraFeeType: true } },
    },
  });

  let enFixed = 0;
  let efFixed = 0;

  for (const st of students) {
    const hasStillActive =
      st.enrollments.some((e) => !e.endTermId || e.endTermId > p4.id) ||
      st.extraFees.some((f) => !f.endTermId || f.endTermId > p4.id);

    if (!hasStillActive) continue;

    for (const en of st.enrollments) {
      if (en.endTermId !== p4.id) continue;
      console.log(`  选课 ${st.fullName} / ${en.course.code}: endTerm 第4期 → 在读`);
      if (isCommit) {
        await prisma.studentEnrollment.update({
          where: { id: en.id },
          data: { endTermId: null },
        });
      }
      enFixed++;
    }

    for (const ef of st.extraFees) {
      if (ef.endTermId !== p4.id) continue;
      console.log(`  额外 ${st.fullName} / ${ef.extraFeeType.code}: endTerm 第4期 → 在读`);
      if (isCommit) {
        await prisma.studentExtraFee.update({
          where: { id: ef.id },
          data: { endTermId: null },
        });
      }
      efFixed++;
    }
  }

  console.log(`\n${isCommit ? "已" : "将"}恢复选课 ${enFixed} 条、额外费用 ${efFixed} 条`);
  if (!isCommit) console.log("确认请加 --commit");

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
