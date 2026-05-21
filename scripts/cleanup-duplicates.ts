/**
 * 清理重复条目 - 把新导入的数据合并到老的字典条目中
 *
 * 策略:
 *   - 保留老条目 (有 CourseFee/ExtraFeeRate 价格模板)
 *   - 老条目重命名为新名字 (1年级 不是 一年级)
 *   - 学生/选课/费用注册从新条目迁移到老条目
 *   - 删除空的新条目和无用的繁体重复
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

// 配对 (旧条目, 新条目, 最终名字)
// 学生/选课/费用从 new 迁移到 old, old 重命名, new 删除
const GRADE_MERGES = [
  { oldName: "一年级", newName: "1年级", finalName: "1年级" },
  { oldName: "二年级", newName: "2年级", finalName: "2年级" },
  { oldName: "三年级", newName: "3年级", finalName: "3年级" },
  { oldName: "四年级", newName: "4年级", finalName: "4年级" },
  { oldName: "五年级", newName: "5年级", finalName: "5年级" },
  { oldName: "六年级", newName: "6年级", finalName: "6年级" },
  { oldName: "初一", newName: "中一", finalName: "中一" },
  { oldName: "初二", newName: "中二", finalName: "中二" },
  { oldName: "初三", newName: "中三", finalName: "中三" },
  { oldName: "高二", newName: "中五", finalName: "中五" },
  { oldName: "高三", newName: "中六", finalName: "中六" },
];
// 高一: 新数据里没有 F4 学生，直接把 高一 改名为 中四
const GRADE_RENAMES_ONLY = [{ from: "高一", to: "中四" }];

const COURSE_MERGES = [
  { oldName: "功课班", oldCode: "HOMEWORK", newCode: "HOMEWORK_CLASS", finalName: "功课班" },
  { oldName: "写作班", oldCode: "WRITING", newCode: "WRITING_CLASS", finalName: "写作" },
  { oldName: "中学英文", oldCode: "SEC_EN", newCode: "ENGLISH_CLASS", finalName: "中学英文" },
  { oldName: "中学国文", oldCode: "SEC_BM", newCode: "SECONDARY_TUITION", finalName: "中学国文" },
];

const SCHOOLS_TO_DELETE = ["古來一校", "古來二校", "培正華小", "大古來華小", "沙令華小"];
const GUARDIAN_TYPES_TO_DELETE = ["父亲", "母亲", "监护人", "亲属"];

async function main() {
  console.log(`================================================================`);
  console.log(`🧹 清理重复条目 - ${isCommit ? "🚨 真正执行" : "🔍 Dry-Run"}`);
  console.log(`================================================================\n`);

  // ===== 年级合并 =====
  console.log("📐 年级合并：");
  for (const m of GRADE_MERGES) {
    const oldG = await prisma.grade.findUnique({ where: { name: m.oldName } });
    const newG = await prisma.grade.findUnique({ where: { name: m.newName } });
    if (!oldG || !newG) {
      console.log(`   ⚠️ 找不到 ${m.oldName} 或 ${m.newName}，跳过`);
      continue;
    }
    const studentsInNew = await prisma.student.count({ where: { gradeId: newG.id } });
    const feesInOld = await prisma.courseFee.count({ where: { gradeId: oldG.id } });
    console.log(
      `   ${m.oldName}(id=${oldG.id}, ${feesInOld} CourseFees) ← ${m.newName}(id=${newG.id}, ${studentsInNew} 学生) → 最终: ${m.finalName}`
    );
    if (isCommit) {
      // 迁移学生
      await prisma.student.updateMany({ where: { gradeId: newG.id }, data: { gradeId: oldG.id } });
      // 删除新条目
      await prisma.grade.delete({ where: { id: newG.id } });
      // 重命名老条目
      await prisma.grade.update({ where: { id: oldG.id }, data: { name: m.finalName } });
    }
  }

  console.log("\n📐 年级单独重命名：");
  for (const r of GRADE_RENAMES_ONLY) {
    const g = await prisma.grade.findUnique({ where: { name: r.from } });
    if (!g) {
      console.log(`   ⚠️ 找不到 ${r.from}，跳过`);
      continue;
    }
    console.log(`   ${r.from}(id=${g.id}) → ${r.to}`);
    if (isCommit) {
      await prisma.grade.update({ where: { id: g.id }, data: { name: r.to } });
    }
  }

  // ===== 课程合并 =====
  console.log("\n📚 课程合并：");
  for (const m of COURSE_MERGES) {
    const oldC = await prisma.course.findUnique({ where: { code: m.oldCode } });
    const newC = await prisma.course.findUnique({ where: { code: m.newCode } });
    if (!oldC || !newC) {
      console.log(`   ⚠️ 找不到 ${m.oldCode} 或 ${m.newCode}，跳过`);
      continue;
    }
    const enrollsInNew = await prisma.studentEnrollment.count({ where: { courseId: newC.id } });
    const feesInOld = await prisma.courseFee.count({ where: { courseId: oldC.id } });
    console.log(
      `   ${oldC.name}(id=${oldC.id}, ${feesInOld} CourseFees) ← ${newC.name}(id=${newC.id}, ${enrollsInNew} 选课) → 最终: ${m.finalName}`
    );
    if (isCommit) {
      // 迁移 enrollments
      await prisma.studentEnrollment.updateMany({
        where: { courseId: newC.id },
        data: { courseId: oldC.id },
      });
      // 删除新课程
      await prisma.course.delete({ where: { id: newC.id } });
      // 重命名老课程
      await prisma.course.update({ where: { id: oldC.id }, data: { name: m.finalName } });
    }
  }

  console.log("\n📚 备注：");
  console.log("   补习班(TUITION_CLASS, 新, 46 选课) 保留为「混合补习班」");
  console.log("   补习班-华文/国文/英文/数学/科学 (5 个老课程) 保留作为细分模板");
  console.log("   将来 admin 拿到细分数据后，可手动把每个学生的 补习班 选课拆成 4-5 个细分");

  // ===== 学校删除 =====
  console.log("\n🏫 删除空学校：");
  for (const name of SCHOOLS_TO_DELETE) {
    const s = await prisma.school.findUnique({ where: { name } });
    if (!s) {
      console.log(`   - ${name}：不存在，跳过`);
      continue;
    }
    const cnt = await prisma.student.count({ where: { schoolId: s.id } });
    if (cnt > 0) {
      console.log(`   ⚠️ ${name}：有 ${cnt} 学生，不删！`);
      continue;
    }
    console.log(`   🗑️ ${name}(id=${s.id})`);
    if (isCommit) await prisma.school.delete({ where: { id: s.id } });
  }

  // ===== 监护人类型删除 =====
  console.log("\n👨‍👩‍👧 删除空监护人关系：");
  for (const name of GUARDIAN_TYPES_TO_DELETE) {
    const g = await prisma.guardianType.findUnique({ where: { name } });
    if (!g) {
      console.log(`   - ${name}：不存在，跳过`);
      continue;
    }
    const cnt = await prisma.studentGuardian.count({ where: { relationTypeId: g.id } });
    if (cnt > 0) {
      console.log(`   ⚠️ ${name}：有 ${cnt} 使用，不删！`);
      continue;
    }
    console.log(`   🗑️ ${name}(id=${g.id})`);
    if (isCommit) await prisma.guardianType.delete({ where: { id: g.id } });
  }

  if (!isCommit) {
    console.log(`\n================================================================`);
    console.log(`🔍 Dry-Run 完毕`);
    console.log(`================================================================`);
    console.log(`\n确认后请运行: npx tsx scripts/cleanup-duplicates.ts --commit\n`);
  } else {
    console.log(`\n✅ 清理完成`);
  }

  await prisma.$disconnect();
}

main().catch(async (e) => {
  console.error(e);
  await prisma.$disconnect();
  process.exit(1);
});
