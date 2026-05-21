import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 获取所有课程字典记录
    const dictCourses = await prisma.courseDict.findMany({
      include: {
        type: true
      }
    });

    // 获取所有课程
    const courses = await prisma.course.findMany();

    // 更新课程关联
    for (const course of courses) {
      let matchingDict: typeof dictCourses[0] | undefined;

      // 根据课程名称匹配课程字典
      switch (course.name) {
        case '功课班':
          matchingDict = dictCourses.find(dc => dc.name === '功课班' && dc.type.name === '独立课程');
          break;
        case '写作班':
          matchingDict = dictCourses.find(dc => dc.name === '写作班' && dc.type.name === '独立课程');
          break;
        case '补习班-华文':
          matchingDict = dictCourses.find(dc => dc.name === '华文' && dc.type.name === '小学课程');
          break;
        case '补习班-国文':
          matchingDict = dictCourses.find(dc => dc.name === '国文' && dc.type.name === '小学课程');
          break;
        case '补习班-英文':
          matchingDict = dictCourses.find(dc => dc.name === '英文' && dc.type.name === '小学课程');
          break;
        case '补习班-数学':
          matchingDict = dictCourses.find(dc => dc.name === '数学' && dc.type.name === '小学课程');
          break;
        case '补习班-科学':
          matchingDict = dictCourses.find(dc => dc.name === '科学' && dc.type.name === '小学课程');
          break;
        case '中学国文':
          matchingDict = dictCourses.find(dc => dc.name === '国文' && dc.type.name === '中学课程');
          break;
        case '中学英文':
          matchingDict = dictCourses.find(dc => dc.name === '英文' && dc.type.name === '中学课程');
          break;
      }

      if (matchingDict) {
        await prisma.course.update({
          where: { id: course.id },
          data: {
            dictId: matchingDict.id
          }
        });
        console.log(`已更新课程 ${course.name} -> ${matchingDict.name} (${matchingDict.type.name})`);
      } else {
        console.log(`未找到匹配的字典课程: ${course.name}`);
      }
    }

    console.log('更新完成！');
  } catch (error) {
    console.error('更新失败:', error);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());







