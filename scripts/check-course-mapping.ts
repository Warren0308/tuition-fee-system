import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取所有课程字典数据
    const courseDicts = await prisma.courseDict.findMany({
      include: {
        type: true
      },
      orderBy: [
        { type: { orderIndex: 'asc' } },
        { orderIndex: 'asc' }
      ]
    });

    // 获取所有实际课程数据
    const courses = await prisma.course.findMany({
      orderBy: { name: 'asc' }
    });

    // 获取一年级的费用数据作为示例
    const fees = await prisma.courseFee.findMany({
      where: {
        grade: {
          name: '一年级'
        }
      },
      include: {
        course: true,
        grade: true
      }
    });

    console.log('\n课程字典数据:');
    courseDicts.forEach(dict => {
      console.log(`- [${dict.type.name}] ${dict.name} (ID: ${dict.id})`);
    });

    console.log('\n实际课程数据:');
    courses.forEach(course => {
      console.log(`- [${course.group}] ${course.name} (ID: ${course.id}, Code: ${course.code})`);
    });

    console.log('\n一年级费用数据:');
    fees.forEach(fee => {
      console.log(`- ${fee.course.name} (Course ID: ${fee.courseId}, Fee ID: ${fee.id})`);
    });

  } catch (error) {
    console.error('检查出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







