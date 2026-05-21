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
const name = process.argv[2] || "郑宇翔";

async function main() {
  const st = await prisma.student.findFirst({
    where: { fullName: name },
    include: {
      enrollments: { include: { course: true, startTerm: true, endTerm: true } },
      extraFees: { include: { extraFeeType: true, startTerm: true, endTerm: true } },
      payments: { include: { items: true }, orderBy: [{ year: "desc" }, { termIndex: "asc" }] },
    },
  });
  if (!st) {
    console.log("not found");
    return;
  }
  console.log(`=== ${st.fullName} ===\n选课:`);
  for (const e of st.enrollments) {
    console.log(
      `  ${e.course.name} ${e.startTerm?.year}T${e.startTerm?.termIndex} → ${e.endTerm ? `${e.endTerm.year}T${e.endTerm.termIndex}` : "持续"}`
    );
  }
  console.log("\n额外费用:");
  for (const e of st.extraFees) {
    console.log(
      `  ${e.extraFeeType.name} ${e.startTerm?.year}T${e.startTerm?.termIndex} → ${e.endTerm ? `${e.endTerm.year}T${e.endTerm.termIndex}` : "持续"}`
    );
  }
  console.log("\n账单:");
  for (const p of st.payments) {
    console.log(
      `  ${p.year}T${p.termIndex}: RM${(p.totalCents / 100).toFixed(2)} (${p.items.length}项) ${p.items.map((i) => i.description || i.itemType).join(", ")}`
    );
  }
}

main().finally(() => prisma.$disconnect());
