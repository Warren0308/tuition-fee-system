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
const prisma = new PrismaClient();

async function main() {
  const terms = await prisma.term.findMany({
    orderBy: [{ year: "asc" }, { termIndex: "asc" }],
  });
  console.log(`系统中共有 ${terms.length} 个学期：\n`);
  for (const t of terms) {
    console.log(
      `  id=${t.id}  ${t.year} 年第 ${t.termIndex} 学期  起: ${t.startDate.toISOString().slice(0, 10)}  止: ${t.endDate.toISOString().slice(0, 10)}`
    );
  }

  const enrollCount = await prisma.studentEnrollment.count();
  const paymentCount = await prisma.studentTermPayment.count();
  const extraFeeCount = await prisma.studentExtraFee.count();
  console.log(`\n现有数据：`);
  console.log(`  选课: ${enrollCount} 条`);
  console.log(`  账单: ${paymentCount} 条`);
  console.log(`  额外费用: ${extraFeeCount} 条`);

  const config = await prisma.termConfig.findFirst();
  if (config) {
    console.log(`\nTermConfig: termsPerYear=${(config as any).termsPerYear}`);
  }
  await prisma.$disconnect();
}
main();
