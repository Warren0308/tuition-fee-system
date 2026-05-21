import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取所有年级
    const grades = await prisma.grade.findMany();

    for (const grade of grades) {
      console.log(`\n检查 ${grade.name} 的费用设置...`);
      
      // 获取该年级的所有费用设置
      const fees = await prisma.courseFee.findMany({
        where: { gradeId: grade.id },
        include: { course: true }
      });

      // 找出重复的费用设置
      const courseIds = new Set<number>();
      const duplicates = fees.filter(fee => {
        if (courseIds.has(fee.courseId)) {
          return true;
        }
        courseIds.add(fee.courseId);
        return false;
      });

      if (duplicates.length > 0) {
        console.log(`发现 ${duplicates.length} 个重复的费用设置:`);
        for (const duplicate of duplicates) {
          console.log(`删除重复的费用设置: ${grade.name} - ${duplicate.course.name} (ID: ${duplicate.id})`);
          await prisma.courseFee.delete({
            where: { id: duplicate.id }
          });
        }
      } else {
        console.log('没有发现重复的费用设置');
      }
    }

    console.log('\n清理完成！');
  } catch (error) {
    console.error('清理出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







