import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log('=== 检查课程类型 ===');
    const types = await prisma.courseType.findMany({
      include: {
        courses: true
      }
    });
    
    console.log('课程类型数量:', types.length);
    for (const type of types) {
      console.log(`\n类型: ${type.name} (ID: ${type.id})`);
      console.log('课程数量:', type.courses.length);
      console.log('课程列表:');
      for (const course of type.courses) {
        console.log(`- ${course.name} (ID: ${course.id})`);
      }
    }

    console.log('\n=== 检查课程表 ===');
    const courses = await prisma.course.findMany({
      include: {
        dict: {
          include: {
            type: true
          }
        }
      }
    });

    console.log('课程总数:', courses.length);
    for (const course of courses) {
      console.log(`\n课程: ${course.name}`);
      console.log(`ID: ${course.id}`);
      console.log(`代码: ${course.code}`);
      console.log(`字典ID: ${course.dictId}`);
      if (course.dict) {
        console.log(`字典课程: ${course.dict.name}`);
        console.log(`所属类型: ${course.dict.type.name}`);
      } else {
        console.log('未关联字典课程');
      }
    }

    console.log('\n=== 检查一年级的费用设置 ===');
    const fees = await prisma.courseFee.findMany({
      where: {
        grade: {
          name: '一年级'
        }
      },
      include: {
        course: {
          include: {
            dict: {
              include: {
                type: true
              }
            }
          }
        },
        grade: true
      }
    });

    console.log('一年级费用设置数量:', fees.length);
    for (const fee of fees) {
      console.log(`\n费用ID: ${fee.id}`);
      console.log(`课程: ${fee.course.name}`);
      console.log(`金额: ${fee.amountCents / 100} RM`);
      if (fee.course.dict) {
        console.log(`字典课程: ${fee.course.dict.name}`);
        console.log(`所属类型: ${fee.course.dict.type.name}`);
      } else {
        console.log('未关联字典课程');
      }
    }

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







