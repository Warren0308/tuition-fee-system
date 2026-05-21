import { prisma } from "../src/lib/prisma";

async function main() {
  console.log('=== 检查课程类型 ===');
  const types = await prisma.courseType.findMany({
    include: {
      courses: true
    }
  });
  
  for (const type of types) {
    console.log(`\n类型: ${type.name}`);
    console.log('课程:');
    for (const course of type.courses) {
      console.log(`- ${course.name} (ID: ${course.id})`);
    }
  }

  console.log('\n=== 检查课程表 ===');
  const courses = await prisma.course.findMany({
    include: {
      dict: true
    }
  });

  for (const course of courses) {
    console.log(`\n课程: ${course.name}`);
    console.log(`ID: ${course.id}`);
    console.log(`代码: ${course.code}`);
    console.log(`字典ID: ${course.dictId}`);
    if (course.dict) {
      console.log(`字典名称: ${course.dict.name}`);
    }
  }

  console.log('\n=== 检查费用设置 ===');
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

  for (const fee of fees) {
    console.log(`\n费用ID: ${fee.id}`);
    console.log(`年级: ${fee.grade.name}`);
    console.log(`课程: ${fee.course.name}`);
    console.log(`金额: ${fee.amountCents / 100} RM`);
    if (fee.course.dict) {
      console.log(`字典课程: ${fee.course.dict.name}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());







