import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    console.log('=== 测试数据库连接 ===');
    
    // 测试连接
    await prisma.$connect();
    console.log('数据库连接成功');

    // 检查课程字典表
    console.log('\n=== 检查课程字典表 ===');
    const courseTypes = await prisma.courseType.findMany({
      include: {
        courses: true
      }
    });
    console.log('课程类型数量:', courseTypes.length);
    for (const type of courseTypes) {
      console.log(`\n类型: ${type.name}`);
      console.log('课程列表:');
      for (const course of type.courses) {
        console.log(`- ${course.name} (ID: ${course.id})`);
      }
    }

    // 检查课程表
    console.log('\n=== 检查课程表 ===');
    const courses = await prisma.course.findMany({
      include: {
        dict: true
      }
    });
    console.log('课程总数:', courses.length);
    for (const course of courses) {
      console.log(`\n课程: ${course.name}`);
      console.log(`ID: ${course.id}`);
      console.log(`代码: ${course.code}`);
      console.log(`字典ID: ${course.dictId}`);
      if (course.dict) {
        console.log(`关联字典课程: ${course.dict.name}`);
      }
    }

    // 检查费用表
    console.log('\n=== 检查费用表 ===');
    const fees = await prisma.courseFee.findMany({
      include: {
        course: {
          include: {
            dict: true
          }
        },
        grade: true
      }
    });
    console.log('费用记录总数:', fees.length);
    for (const fee of fees) {
      console.log(`\n费用ID: ${fee.id}`);
      console.log(`年级: ${fee.grade.name}`);
      console.log(`课程: ${fee.course.name}`);
      console.log(`金额: ${fee.amountCents / 100} RM`);
      if (fee.course.dict) {
        console.log(`关联字典课程: ${fee.course.dict.name}`);
      }
    }

    // 尝试模拟添加流程
    console.log('\n=== 模拟添加流程 ===');
    const testGrade = await prisma.grade.findFirst({
      where: { name: '一年级' }
    });
    
    const testCourse = await prisma.courseDict.findFirst({
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

    if (testGrade && testCourse) {
      console.log('测试数据:');
      console.log('- 年级:', testGrade.name);
      console.log('- 课程:', testCourse.name);
      console.log('- 类型:', testCourse.type.name);

      // 检查是否已存在
      const existingFee = await prisma.courseFee.findFirst({
        where: {
          gradeId: testGrade.id,
          course: {
            dictId: testCourse.id
          }
        },
        include: {
          course: true
        }
      });

      if (existingFee) {
        console.log('\n已存在的费用记录:', existingFee);
      } else {
        console.log('\n无已存在费用记录');
      }

      // 检查课程记录
      const existingCourse = await prisma.course.findFirst({
        where: {
          dictId: testCourse.id
        }
      });

      if (existingCourse) {
        console.log('\n已存在的课程记录:', existingCourse);
      } else {
        console.log('\n无已存在课程记录');
      }
    }

  } catch (error) {
    console.error('检查失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







