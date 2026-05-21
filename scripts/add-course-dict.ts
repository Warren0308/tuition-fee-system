import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取或创建课程类型
    const smallSchoolType = await prisma.courseType.upsert({
      where: { name: '小学课程' },
      update: { orderIndex: 1 },
      create: { name: '小学课程', orderIndex: 1 }
    });

    const highSchoolType = await prisma.courseType.upsert({
      where: { name: '中学课程' },
      update: { orderIndex: 2 },
      create: { name: '中学课程', orderIndex: 2 }
    });

    // 添加小学和中学的课程
    const courses = [
      { name: '国文', typeId: smallSchoolType.id, orderIndex: 1 },
      { name: '英文', typeId: smallSchoolType.id, orderIndex: 2 },
      { name: '国文', typeId: highSchoolType.id, orderIndex: 1 },
      { name: '英文', typeId: highSchoolType.id, orderIndex: 2 }
    ];

    for (const course of courses) {
      // 先查找是否存在
      const existing = await prisma.courseDict.findFirst({
        where: {
          name: course.name,
          typeId: course.typeId
        }
      });

      if (existing) {
        await prisma.courseDict.update({
          where: { id: existing.id },
          data: course
        });
        console.log(`更新课程: ${course.name} (${course.typeId})`);
      } else {
        await prisma.courseDict.create({
          data: course
        });
        console.log(`添加课程: ${course.name} (${course.typeId})`);
      }
    }

    console.log('课程添加完成！');
  } catch (error) {
    console.error('添加课程出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();