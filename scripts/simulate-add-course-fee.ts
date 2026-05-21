import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 1. 模拟选择一年级
    const grade = await prisma.grade.findFirst({
      where: {
        name: '一年级'
      }
    });

    if (!grade) {
      throw new Error('未找到一年级数据');
    }

    console.log('\n=== 1. 选择的年级 ===');
    console.log(grade);

    // 2. 模拟选择功课班课程
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
      throw new Error('未找到功课班课程');
    }

    console.log('\n=== 2. 选择的课程 ===');
    console.log(homeworkCourse);

    // 3. 检查是否已存在费用记录
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

    console.log('\n=== 3. 检查已存在费用 ===');
    console.log(existingFee ? '已存在费用记录' : '无已存在费用记录');
    if (existingFee) {
      console.log(existingFee);
    }

    if (existingFee) {
      console.log('该课程已有费用设置，跳过添加');
      return;
    }

    // 4. 检查是否已存在课程记录
    const existingCourse = await prisma.course.findFirst({
      where: {
        dictId: homeworkCourse.id
      }
    });

    console.log('\n=== 4. 检查已存在课程 ===');
    console.log(existingCourse ? '已存在课程记录' : '无已存在课程记录');
    if (existingCourse) {
      console.log(existingCourse);
    }

    // 5. 创建或更新课程记录
    const courseGroup = homeworkCourse.type.name === '独立课程' ? 
      (homeworkCourse.name === '功课班' ? 'HOMEWORK' : 'WRITING') : 'TUITION';

    const course = await prisma.course.upsert({
      where: {
        code: `DICT_${homeworkCourse.id}`
      },
      update: {
        name: homeworkCourse.name,
        dictId: homeworkCourse.id,
        group: courseGroup
      },
      create: {
        code: `DICT_${homeworkCourse.id}`,
        name: homeworkCourse.name,
        group: courseGroup,
        dictId: homeworkCourse.id,
        isActive: true
      }
    });

    console.log('\n=== 5. 创建/更新的课程记录 ===');
    console.log(course);

    // 6. 创建费用记录
    const fee = await prisma.courseFee.create({
      data: {
        courseId: course.id,
        gradeId: grade.id,
        amountCents: 15000 // RM 150.00
      }
    });

    console.log('\n=== 6. 创建的费用记录 ===');
    console.log(fee);

    // 7. 验证创建的记录
    const createdFee = await prisma.courseFee.findUnique({
      where: {
        id: fee.id
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

    console.log('\n=== 7. 验证创建的记录 ===');
    console.log(JSON.stringify(createdFee, null, 2));

  } catch (error) {
    console.error('模拟添加失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







