import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取所有课程
    const courses = await prisma.course.findMany({
      where: { isActive: true },
      orderBy: { name: 'asc' }
    });

    console.log('\n所有课程列表:');
    courses.forEach(course => {
      console.log(`ID: ${course.id}, 名称: ${course.name}, 代码: ${course.code}, 组别: ${course.group}, 状态: ${course.isActive ? '启用' : '禁用'}`);
    });

    // 检查重复的课程名称
    const courseNames = courses.map(c => c.name);
    const duplicateNames = courseNames.filter((name, index) => courseNames.indexOf(name) !== index);
    
    if (duplicateNames.length > 0) {
      console.log('\n发现重复的课程名称:');
      duplicateNames.forEach(name => {
        const duplicates = courses.filter(c => c.name === name);
        console.log(`\n课程名称: ${name}`);
        duplicates.forEach(d => {
          console.log(`  - ID: ${d.id}, 代码: ${d.code}, 组别: ${d.group}, 状态: ${d.isActive ? '启用' : '禁用'}`);
        });
      });
    }

    // 检查二年级的费用设置
    const grade2Fees = await prisma.courseFee.findMany({
      where: {
        grade: {
          name: '二年级'
        }
      },
      include: {
        course: true,
        grade: true
      },
      orderBy: {
        course: {
          name: 'asc'
        }
      }
    });

    console.log('\n二年级的费用设置:');
    grade2Fees.forEach(fee => {
      console.log(`课程: ${fee.course.name} (ID: ${fee.course.id}), 费用: RM ${fee.amountCents/100}`);
    });

  } catch (error) {
    console.error('查询出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







