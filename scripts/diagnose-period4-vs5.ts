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
import { getAcademicYearTerms } from "../src/lib/academic-year";
import { calculateUnpaidForStudent } from "../src/lib/billing-utils";

const prisma = new PrismaClient();

async function main() {
  const terms = await getAcademicYearTerms();
  const p4 = terms.find((t) => t.period === 4)!;
  const p5 = terms.find((t) => t.period === 5)!;

  console.log(`第4期: ${p4.year}T${p4.termIndex} id=${p4.id}`);
  console.log(`第5期: ${p5.year}T${p5.termIndex} id=${p5.id}\n`);

  const students = await prisma.student.findMany({
    where: { isActive: true },
    take: 20,
    orderBy: { fullName: "asc" },
  });

  let diffCount = 0;
  for (const st of students) {
    const ensP4 = await prisma.studentEnrollment.findMany({
      where: {
        studentId: st.id,
        startTermId: { lte: p4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: p4.id } }],
      },
      include: { course: true },
    });
    const ensP5 = await prisma.studentEnrollment.findMany({
      where: {
        studentId: st.id,
        startTermId: { lte: p5.id },
        OR: [{ endTermId: null }, { endTermId: { gte: p5.id } }],
      },
      include: { course: true },
    });
    const efP4 = await prisma.studentExtraFee.findMany({
      where: {
        studentId: st.id,
        startTermId: { lte: p4.id },
        OR: [{ endTermId: null }, { endTermId: { gte: p4.id } }],
      },
      include: { extraFeeType: true },
    });
    const efP5 = await prisma.studentExtraFee.findMany({
      where: {
        studentId: st.id,
        startTermId: { lte: p5.id },
        OR: [{ endTermId: null }, { endTermId: { gte: p5.id } }],
      },
      include: { extraFeeType: true },
    });

    const coursesP4 = ensP4.map((e) => e.course.code).sort().join(",");
    const coursesP5 = ensP5.map((e) => e.course.code).sort().join(",");
    const extraP4 = efP4.map((e) => e.extraFeeType.code).sort().join(",");
    const extraP5 = efP5.map((e) => e.extraFeeType.code).sort().join(",");

    const unpaidP5 = await calculateUnpaidForStudent(st.id, p5.id, st.gradeId);

    if (coursesP4 !== coursesP5 || extraP4 !== extraP5 || unpaidP5.unpaidTotal > 0) {
      diffCount++;
      console.log(`--- ${st.fullName} ---`);
      if (coursesP4 !== coursesP5)
        console.log(`  课程 P4:[${coursesP4}] P5:[${coursesP5}]`);
      if (extraP4 !== extraP5)
        console.log(`  额外 P4:[${extraP4}] P5:[${extraP5}]`);
      if (unpaidP5.unpaidTotal > 0)
        console.log(
          `  第5期待付 RM${(unpaidP5.unpaidTotal / 100).toFixed(2)}`,
          unpaidP5.unpaidCourses.map((c) => c.code),
          unpaidP5.unpaidExtraFees.map((f) => f.code)
        );
    }
  }

  const endedBeforeP5 = await prisma.studentEnrollment.count({
    where: { endTermId: p4.id },
  });
  const endedAtP4 = await prisma.studentExtraFee.count({
    where: { endTermId: p4.id },
  });
  console.log(`\n选课 endTerm=第4期: ${endedBeforeP5}, 额外费用 endTerm=第4期: ${endedAtP4}`);
  console.log(`样本差异/待付: ${diffCount}/${students.length}`);

  await prisma.$disconnect();
}
main();
