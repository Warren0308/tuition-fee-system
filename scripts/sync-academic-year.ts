/**
 * 设置第1期起始日并同步 13 期 Term 到数据库
 * 用法: npx tsx scripts/sync-academic-year.ts [YYYY-MM-DD]
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
    process.env[t.slice(0, i).trim()] = t.slice(i + 1).trim().replace(/^["']|["']$/g, "");
  }
}

import { PrismaClient } from "@prisma/client";
import { ACADEMIC_YEAR } from "../src/lib/term-utils";
import { syncAcademicYearTermsFromConfig } from "../src/lib/academic-year";
import { parseLocalDate } from "../src/lib/date-utils";

const prisma = new PrismaClient();
const term1Date = process.argv[2] || "2025-12-29";

async function main() {
  const parsed = parseLocalDate(term1Date);
  await prisma.termConfig.upsert({
    where: { year: ACADEMIC_YEAR },
    update: { term1Date: parsed },
    create: { year: ACADEMIC_YEAR, term1Date: parsed },
  });
  const count = await syncAcademicYearTermsFromConfig();
  console.log(`✅ 第1期起始: ${term1Date}，已同步 ${count} 期`);
}

main().finally(() => prisma.$disconnect());
