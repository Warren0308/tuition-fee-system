import { prisma } from "../src/lib/prisma";
import { isCourseNameMatch, getStandardCourseName } from "../src/lib/course-utils";

async function main() {
  try {
    // 获取一年级的数据作为测试
    const grade = await prisma.grade.findFirst({
      where: {
        name: '一年级'
      }
    });

    if (!grade) {
      console.error('未找到一年级数据');
      return;
    }

    // 获取该年级的所有费用设置
    const fees = await prisma.courseFee.findMany({
      where: {
        gradeId: grade.id
      },
      include: {
        course: true
      }
    });

    console.log('=== 现有费用设置 ===');
    fees.forEach(fee => {
      console.log(`- ${fee.course.name} (ID: ${fee.course.id})`);
    });

    // 获取所有课程字典数据
    const dictCourses = await prisma.courseDict.findMany({
      include: {
        type: true
      }
    });

    console.log('\n=== 课程字典数据 ===');
    dictCourses.forEach(dict => {
      console.log(`- ${dict.name} (ID: ${dict.id}, 类型: ${dict.type.name})`);
    });

    console.log('\n=== 测试课程名称匹配 ===');
    fees.forEach(fee => {
      dictCourses.forEach(dict => {
        const isMatch = isCourseNameMatch(fee.course.name, dict.name);
        if (isMatch) {
          console.log(`匹配: ${fee.course.name} = ${dict.name}`);
          console.log(`标准名称: ${getStandardCourseName(fee.course.name)} = ${getStandardCourseName(dict.name)}`);
        }
      });
    });

    console.log('\n=== 测试已存在课程检查 ===');
    dictCourses.forEach(dict => {
      const isExisting = fees.some(fee => isCourseNameMatch(fee.course.name, dict.name));
      console.log(`${dict.name} (${dict.type.name}): ${isExisting ? '已存在' : '未添加'}`);
    });

  } catch (error) {
    console.error('测试失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







