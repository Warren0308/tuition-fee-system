import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    const schools = [
      "SJKC KUNG MIN",
      "SJKC CHUNG HWA",
      "SJKC CHUNG HWA 2",
      "SJKC CHUNG HWA 3",
      "SJKC PAY FOO",
      "SJKC PERMATANG TINGGI",
      "SJKC KWANG HWA",
      "SJKC LI HWA",
      "SJKC JURU",
      "SJKC BENG TEIK",
      "SJKC KIM SEN",
      "SJKC KAMPUNG KASTAM",
      "SJKC HIN HUA",
      "SJKC KHENG TEAN",
      "SJKC KWANG HUAT"
    ];

    console.log('开始添加学校数据...');
    for (const name of schools) {
      await prisma.school.upsert({
        where: { name },
        update: {},
        create: { name }
      });
      console.log(`- 已添加: ${name}`);
    }

    console.log('\n学校数据添加完成！');
  } catch (error) {
    console.error('添加学校数据时出错:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







