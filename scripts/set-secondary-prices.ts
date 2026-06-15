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
const p = new PrismaClient();

async function main() {
  const grades = await p.grade.findMany({ orderBy: { orderIndex: "asc" } });
  console.log("Grades:", grades.map((g) => `${g.id}:${g.name}`).join(", "));

  // 中学数学=19 RM80, 中学历史=20 RM80, 中学英文作文=21 RM100
  const targets = [
    { courseId: 19, name: "中学数学", amountCents: 8000 },
    { courseId: 20, name: "中学历史", amountCents: 8000 },
    { courseId: 21, name: "中学英文作文", amountCents: 10000 },
  ];

  let created = 0;
  for (const t of targets) {
    for (const grade of grades) {
      await p.courseFee.upsert({
        where: { courseId_gradeId: { courseId: t.courseId, gradeId: grade.id } },
        update: { amountCents: t.amountCents },
        create: { courseId: t.courseId, gradeId: grade.id, amountCents: t.amountCents },
      });
      created++;
    }
    console.log(`✓ ${t.name} RM${t.amountCents / 100} × ${grades.length} grades`);
  }
  console.log(`\nDone: ${created} fee records upserted`);
}

main()
  .catch(console.error)
  .finally(() => p.$disconnect());
