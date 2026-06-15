// prisma/seed.cjs
const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcryptjs");
const prisma = new PrismaClient();

async function main() {
  const roles = [
    { code: "ADMIN", name: "管理层" },
    { code: "RECIPIENT", name: "收费员" },
    { code: "TEACHER", name: "老师" },
  ];
  for (const r of roles) {
    await prisma.role.upsert({ where: { code: r.code }, update: { name: r.name }, create: r });
  }

  const adminUsername = "admin";
  const adminPass = "theylingling7496"; // 首次登录请尽快修改
  const passwordHash = await bcrypt.hash(adminPass, 10);

  await prisma.user.upsert({
    where: { username: adminUsername },
    update: {},
    create: {
      username: adminUsername,
      passwordHash,
      mustChangePassword: true,
      roles: { create: [{ role: { connect: { code: "ADMIN" } } }] },
    },
  });

  // 预置管理维度
  const grades = ["一年级","二年级","三年级","四年级","五年级","六年级","初一","初二","初三","高一","高二","高三"];
  for (let i = 0; i < grades.length; i++) {
    await prisma.grade.upsert({
      where: { name: grades[i] },
      update: { orderIndex: i },
      create: { name: grades[i], orderIndex: i },
    });
  }

  const guardianTypes = ["父亲","母亲","监护人","亲属"];
  for (const name of guardianTypes) {
    await prisma.guardianType.upsert({ where: { name }, update: {}, create: { name } });
  }

  // 课程与费用类型
  const courses = [
    { code: "HOMEWORK", name: "功课班", group: "HOMEWORK" },
    { code: "TUITION_CN", name: "补习班-华文", group: "TUITION" },
    { code: "TUITION_BM", name: "补习班-国文", group: "TUITION" },
    { code: "TUITION_EN", name: "补习班-英文", group: "TUITION" },
    { code: "TUITION_MATH", name: "补习班-数学", group: "TUITION" },
    { code: "TUITION_SCI", name: "补习班-科学", group: "TUITION" },
    { code: "WRITING", name: "写作班", group: "WRITING" },
    { code: "SEC_EN", name: "中学英文", group: "SEC_ENGLISH" },
    { code: "SEC_BM", name: "中学国文", group: "SEC_MALAY" },
    { code: "SEC_MATH", name: "中学数学", group: "SEC_MATH" },
    { code: "SEC_HIST", name: "中学历史", group: "SEC_HISTORY" },
    { code: "SEC_EN_WRITING", name: "中学英文作文", group: "SEC_EN_WRITING" },
  ];
  for (const c of courses) {
    await prisma.course.upsert({
      where: { code: c.code },
      update: { name: c.name, group: c.group },
      create: c,
    });
  }

  const extraTypes = [
    { code: "MEAL", name: "膳食" },
    { code: "TRANSPORT", name: "交通" },
  ];
  for (const t of extraTypes) {
    await prisma.extraFeeType.upsert({ where: { code: t.code }, update: { name: t.name }, create: t });
  }

  // 为每个年级设定默认费用（示例：均为 200/term，膳食 80/term，交通 120/term，可后续在管理后台调整）
  const allGrades = await prisma.grade.findMany();
  const feeByCourse = 20000; // 200.00
  const meal = 8000; // 80.00
  const transport = 12000; // 120.00
  const tuitionCourses = await prisma.course.findMany();
  for (const g of allGrades) {
    for (const c of tuitionCourses) {
      await prisma.courseFee.create({ data: { courseId: c.id, gradeId: g.id, amountCents: feeByCourse } });
    }
    const mealType = await prisma.extraFeeType.findUnique({ where: { code: "MEAL" } });
    const transportType = await prisma.extraFeeType.findUnique({ where: { code: "TRANSPORT" } });
    if (mealType) await prisma.extraFeeRate.create({ data: { extraFeeTypeId: mealType.id, gradeId: g.id, amountCents: meal } });
    if (transportType) await prisma.extraFeeRate.create({ data: { extraFeeTypeId: transportType.id, gradeId: g.id, amountCents: transport } });
  }

  console.log("Seed done: admin 账号已准备");
}

main().catch(e => { console.error(e); process.exit(1); }).finally(async () => { await prisma.$disconnect(); });
