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
import { getTutoringStatus } from "../src/lib/student-billing-eligibility";
import { getAcademicYearTerms } from "../src/lib/academic-year";

const prisma = new PrismaClient();
const name = process.argv[2] || "蔡微思";

async function main() {
  const st = await prisma.student.findFirst({
    where: { fullName: { contains: name } },
    include: {
      grade: true,
      enrollments: {
        include: { course: true, startTerm: true, endTerm: true },
      },
      extraFees: {
        include: { extraFeeType: true, startTerm: true, endTerm: true },
      },
      payments: {
        include: { items: true },
        orderBy: [{ year: "asc" }, { termIndex: "asc" }],
      },
    },
  });
  if (!st) {
    console.log("not found");
    return;
  }

  const terms = await getAcademicYearTerms();
  const status = getTutoringStatus(st.enrollments, st.extraFees, terms);

  console.log("=== 学生 ===");
  console.log(st.fullName, st.grade?.name, "isActive:", st.isActive);
  console.log("补习状态:", status);

  console.log("\n=== 选课 ===");
  for (const e of st.enrollments) {
    console.log(
      `- ${e.course.name} | 开始 ${e.startTerm.year}T${e.startTerm.termIndex} | 结束 ${e.endTerm ? e.endTerm.year + "T" + e.endTerm.termIndex : "进行中"} | 价 RM${(e.customPriceCents ?? 0) / 100}`
    );
  }

  console.log("\n=== 额外费用 ===");
  for (const f of st.extraFees) {
    console.log(
      `- ${f.extraFeeType.name} | 开始 ${f.startTerm.year}T${f.startTerm.termIndex} | 结束 ${f.endTerm ? f.endTerm.year + "T" + f.endTerm.termIndex : "进行中"}`
    );
  }

  console.log("\n=== 账单 ===");
  for (const p of st.payments) {
    const period = terms.find((t) => t.year === p.year && t.termIndex === p.termIndex)?.period;
    console.log(`第${period ?? "?"}期 ${p.year}T${p.termIndex} | RM${p.totalCents / 100} | 项目:`);
    for (const i of p.items) {
      console.log(`    ${i.itemType} ${i.description} RM${i.finalCents / 100}`);
    }
  }
}

main().finally(() => prisma.$disconnect());
