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
import { getAcademicYearTerms } from "../src/lib/academic-year";

const prisma = new PrismaClient();
const name = process.argv[2] || "陈梓扬";

async function main() {
  const st = await prisma.student.findFirst({ where: { fullName: name } });
  if (!st) {
    console.log("not found");
    return;
  }
  const terms = await getAcademicYearTerms();
  for (const t of terms) {
    const pay = await prisma.studentTermPayment.findFirst({
      where: { studentId: st.id, year: t.year, termIndex: t.termIndex },
    });
    const s = await calculateUnpaidForStudent(st.id, t.id, st.gradeId);
    const p = t.period;
    console.log(
      `第${p}期 ${t.year}T${t.termIndex} | 账单: ${pay ? "RM" + pay.totalCents / 100 : "无"} | 欠: RM${s.unpaidTotal / 100}`
    );
  }
}

main().finally(() => prisma.$disconnect());
