/**
 * 添加中学数学、中学历史、中学英文作文到数据库
 * 用法: npx tsx scripts/add-secondary-subjects.ts
 */
import * as fs from "fs";
import * as path from "path";
import { PrismaClient } from "@prisma/client";
import { SECONDARY_SUBJECT_COURSES } from "../src/lib/secondary-courses";

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

const prisma = new PrismaClient();

async function main() {
  const secondaryType = await prisma.courseType.upsert({
    where: { name: "中学课程" },
    update: { orderIndex: 2 },
    create: { name: "中学课程", orderIndex: 2 },
  });

  for (const c of SECONDARY_SUBJECT_COURSES) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, group: c.group as any, isActive: true },
      create: {
        code: c.code,
        name: c.name,
        group: c.group as any,
        isActive: true,
      },
    });

    for (const dictName of c.dictNames) {
      const dict = await prisma.courseDict.upsert({
        where: { name_typeId: { name: dictName, typeId: secondaryType.id } },
        update: {},
        create: { name: dictName, typeId: secondaryType.id },
      });
      if (!course.dictId) {
        await prisma.course.update({
          where: { id: course.id },
          data: { dictId: dict.id },
        });
      }
    }

    console.log(`✓ ${c.name} (${c.code})`);
  }

  console.log("\n完成。请在「管理 → 费用目录」为各年级设置这三门课的价格。");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
