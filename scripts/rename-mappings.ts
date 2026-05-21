/**
 * 批量重命名年级 / 学校 / 课程
 *
 * 用法:
 *   npx tsx scripts/rename-mappings.ts          # dry-run
 *   npx tsx scripts/rename-mappings.ts --commit # 真正执行
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
    if ((v.startsWith('"') && v.endsWith('"')) || (v.startsWith("'") && v.endsWith("'"))) v = v.slice(1, -1);
    process.env[t.slice(0, i).trim()] = v;
  }
}

import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();
const isCommit = process.argv.includes("--commit");

const GRADE_MAP: Record<string, string> = {
  P1: "1年级",
  P2: "2年级",
  P3: "3年级",
  P4: "4年级",
  P5: "5年级",
  P6: "6年级",
  F1: "中一",
  F2: "中二",
  F3: "中三",
  F4: "中四",
  F5: "中五",
  F6: "中六",
};

const SCHOOL_MAP: Record<string, string> = {
  二校: "古来二校",
  培正: "培正华小",
  沙令: "沙令华小",
  培群: "培群华小",
  宽中: "宽柔中学",
  喜耀: "喜耀华小",
};

const COURSE_MAP: Record<string, string> = {
  国中: "中学国文",
  英文: "中学英文",
};

async function main() {
  console.log(`================================================================`);
  console.log(`🔤 批量重命名 - ${isCommit ? "🚨 真正提交模式" : "🔍 Dry-Run"}`);
  console.log(`================================================================\n`);

  // 年级
  console.log("📐 年级：");
  const grades = await prisma.grade.findMany({ orderBy: { orderIndex: "asc" } });
  const gradeRenames: Array<{ id: number; from: string; to: string }> = [];
  for (const g of grades) {
    const to = GRADE_MAP[g.name];
    if (to && to !== g.name) {
      gradeRenames.push({ id: g.id, from: g.name, to });
      console.log(`   ${g.name.padEnd(8)} → ${to}`);
    } else {
      console.log(`   ${g.name.padEnd(8)} （保持不变）`);
    }
  }

  // 学校
  console.log("\n🏫 学校：");
  const schools = await prisma.school.findMany({ orderBy: { name: "asc" } });
  const schoolRenames: Array<{ id: number; from: string; to: string }> = [];
  for (const s of schools) {
    const to = SCHOOL_MAP[s.name];
    if (to && to !== s.name) {
      schoolRenames.push({ id: s.id, from: s.name, to });
      console.log(`   ${s.name.padEnd(6)} → ${to}`);
    } else {
      console.log(`   ${s.name.padEnd(6)} （保持不变）`);
    }
  }

  // 课程
  console.log("\n📚 课程：");
  const courses = await prisma.course.findMany();
  const courseRenames: Array<{ id: number; from: string; to: string }> = [];
  for (const c of courses) {
    const to = COURSE_MAP[c.name];
    if (to && to !== c.name) {
      courseRenames.push({ id: c.id, from: c.name, to });
      console.log(`   ${c.name.padEnd(8)} → ${to}`);
    } else {
      console.log(`   ${c.name.padEnd(8)} （保持不变）`);
    }
  }

  console.log(`\n汇总：年级 ${gradeRenames.length} | 学校 ${schoolRenames.length} | 课程 ${courseRenames.length}`);

  if (!isCommit) {
    console.log(`\n如果确认，请加 --commit 重新运行`);
    await prisma.$disconnect();
    return;
  }

  console.log("\n🚨 开始写入...");
  for (const r of gradeRenames) {
    await prisma.grade.update({ where: { id: r.id }, data: { name: r.to } });
    console.log(`   ✓ 年级 ${r.from} → ${r.to}`);
  }
  for (const r of schoolRenames) {
    await prisma.school.update({ where: { id: r.id }, data: { name: r.to } });
    console.log(`   ✓ 学校 ${r.from} → ${r.to}`);
  }
  for (const r of courseRenames) {
    await prisma.course.update({ where: { id: r.id }, data: { name: r.to } });
    console.log(`   ✓ 课程 ${r.from} → ${r.to}`);
  }
  console.log("\n✅ 完成");
  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
