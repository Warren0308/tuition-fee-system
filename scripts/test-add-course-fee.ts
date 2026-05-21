import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取一年级
    const grade = await prisma.grade.findFirst({
      where: {
        name: '一年级'
      }
    });

    if (!grade) {
      console.error('未找到一年级数据');
      return;
    }

    // 获取功课班课程字典
    const homeworkCourse = await prisma.courseDict.findFirst({
      where: {
        name: '功课班',
        type: {
          name: '独立课程'
        }
      },
      include: {
        type: true
      }
    });

    if (!homeworkCourse) {
      console.error('未找到功课班课程');
      return;
    }

    console.log('=== 测试数据 ===');
    console.log('年级:', grade);
    console.log('课程字典:', homeworkCourse);

    // 检查是否已存在费用记录
    const existingFee = await prisma.courseFee.findFirst({
      where: {
        gradeId: grade.id,
        course: {
          dictId: homeworkCourse.id
        }
      },
      include: {
        course: true
      }
    });

    if (existingFee) {
      console.log('已存在费用记录:', existingFee);
      return;
    }

    // 创建或获取课程记录
    const course = await prisma.course.upsert({
      where: {
        code: `DICT_${homeworkCourse.id}`
      },
      update: {
        name: homeworkCourse.name,
        dictId: homeworkCourse.id,
        group: 'HOMEWORK'
      },
      create: {
        code: `DICT_${homeworkCourse.id}`,
        name: homeworkCourse.name,
        group: 'HOMEWORK',
        dictId: homeworkCourse.id,
        isActive: true
      }
    });

    console.log('课程记录:', course);

    // 创建费用记录
    const fee = await prisma.courseFee.create({
      data: {
        courseId: course.id,
        gradeId: grade.id,
        amountCents: 20000 // RM 200.00
      }
    });

    console.log('创建的费用记录:', fee);

    // 验证创建的记录
    const createdFee = await prisma.courseFee.findUnique({
      where: {
        id: fee.id
      },
      include: {
        course: {
          include: {
            dict: true
          }
        },
        grade: true
      }
    });

    console.log('验证创建的记录:', createdFee);

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







