import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取所有年级和课程
    const [grades, courses] = await Promise.all([
      prisma.grade.findMany(),
      prisma.course.findMany({ where: { isActive: true } })
    ]);

    console.log(`找到 ${grades.length} 个年级和 ${courses.length} 个课程`);

    // 设置所有费用为100令吉（10000分）
    const amountCents = 10000;

    // 批量创建或更新费用
    for (const grade of grades) {
      for (const course of courses) {
        const existingFee = await prisma.courseFee.findFirst({
          where: { courseId: course.id, gradeId: grade.id }
        });

        if (existingFee) {
          await prisma.courseFee.update({
            where: { id: existingFee.id },
            data: { amountCents, effectiveFrom: new Date() }
          });
          console.log(`更新费用: ${grade.name} - ${course.name}`);
        } else {
          await prisma.courseFee.create({
            data: { courseId: course.id, gradeId: grade.id, amountCents }
          });
          console.log(`创建费用: ${grade.name} - ${course.name}`);
        }
      }
    }

    console.log('所有费用已设置为 RM 100.00');
  } catch (error) {
    console.error('设置费用时出错:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();







