import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 定义课程类型和课程
    const courseTypes = [
      {
        name: "小学课程",
        orderIndex: 1,
        courses: [
          "华文",
          "国文",
          "英文",
          "数学",
          "科学"
        ]
      },
      {
        name: "中学课程",
        orderIndex: 2,
        courses: [
          "中学国文",
          "中学英文",
          "中学数学",
          "中学历史",
          "中学英文作文",
        ]
      },
      {
        name: "独立课程",
        orderIndex: 3,
        courses: [
          "功课班"
        ]
      }
    ];

    console.log('开始添加课程类型和课程数据...');
    
    for (const type of courseTypes) {
      // 创建或更新课程类型
      const courseType = await prisma.courseType.upsert({
        where: { name: type.name },
        update: { orderIndex: type.orderIndex },
        create: {
          name: type.name,
          orderIndex: type.orderIndex
        }
      });
      console.log(`\n已添加课程类型: ${type.name}`);

      // 为每个课程类型添加课程
      for (const courseName of type.courses) {
        await prisma.courseDict.upsert({
          where: { name_typeId: { name: courseName, typeId: courseType.id } },
          update: { typeId: courseType.id },
          create: {
            name: courseName,
            typeId: courseType.id
          }
        });
        console.log(`- 已添加课程: ${courseName}`);
      }
    }

    console.log('\n课程类型和课程数据添加完成！');
  } catch (error) {
    console.error('添加课程类型和课程数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();