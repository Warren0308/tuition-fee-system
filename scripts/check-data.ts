import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 检查各个表的数据数量
    const counts = await Promise.all([
      prisma.grade.count(),
      prisma.school.count(),
      prisma.guardianType.count(),
      prisma.course.count(),
      prisma.courseFee.count(),
      prisma.courseType.count(),
      prisma.courseDict.count(),
      prisma.user.count(),
    ]);

    console.log('\n数据统计：');
    console.log('年级数量:', counts[0]);
    console.log('学校数量:', counts[1]);
    console.log('监护人关系类型数量:', counts[2]);
    console.log('课程数量:', counts[3]);
    console.log('课程费用设置数量:', counts[4]);
    console.log('课程类型数量:', counts[5]);
    console.log('课程字典数量:', counts[6]);
    console.log('用户数量:', counts[7]);

    // 获取具体数据示例
    console.log('\n年级列表:');
    const grades = await prisma.grade.findMany({ orderBy: { orderIndex: 'asc' } });
    grades.forEach(grade => {
      console.log(`- ${grade.name} (ID: ${grade.id})`);
    });

    console.log('\n学校列表:');
    const schools = await prisma.school.findMany({ orderBy: { name: 'asc' } });
    schools.forEach(school => {
      console.log(`- ${school.name} (ID: ${school.id})`);
    });

    console.log('\n课程类型列表:');
    const courseTypes = await prisma.courseType.findMany({
      include: { courses: true },
      orderBy: { orderIndex: 'asc' }
    });
    courseTypes.forEach(type => {
      console.log(`- ${type.name} (ID: ${type.id})`);
      type.courses.forEach(course => {
        console.log(`  • ${course.name}`);
      });
    });

  } catch (error) {
    console.error('查询出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







