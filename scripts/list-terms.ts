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
import { getBillingPeriodNumber } from "../src/lib/term-utils";

const prisma = new PrismaClient();

async function main() {
  const terms = await prisma.term.findMany({
    orderBy: [{ year: "asc" }, { termIndex: "asc" }],
  });
  for (const t of terms) {
    const p = getBillingPeriodNumber(t.year, t.termIndex);
    console.log(
      `${t.year}T${t.termIndex} → 第${p ?? "?"}期 | ${t.startDate.toISOString().slice(0, 10)} ~ ${t.endDate.toISOString().slice(0, 10)}`
    );
  }
  console.log("\ntermConfig:", await prisma.termConfig.findMany());
}

main().finally(() => prisma.$disconnect());
