import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    // 创建年级数据
    const grades = [
      { name: "学前班", orderIndex: 0 },
      { name: "一年级", orderIndex: 1 },
      { name: "二年级", orderIndex: 2 },
      { name: "三年级", orderIndex: 3 },
      { name: "四年级", orderIndex: 4 },
      { name: "五年级", orderIndex: 5 },
      { name: "六年级", orderIndex: 6 },
      { name: "初一", orderIndex: 7 },
      { name: "初二", orderIndex: 8 },
      { name: "初三", orderIndex: 9 },
      { name: "高一", orderIndex: 10 },
      { name: "高二", orderIndex: 11 },
      { name: "高三", orderIndex: 12 }
    ];

    // 创建学校数据
    const schools = [
      "巴生兴华小学",
      "巴生中华小学", 
      "巴生光华小学",
      "培才独立中学",
      "兴华中学",
      "中华中学",
      "光华中学",
      "沙令淡米尔小学",
      "巴生国民中学",
      "苏丹沙拉胡丁中学"
    ];

    // 创建监护人关系类型
    const guardianTypes = [
      "父亲",
      "母亲", 
      "祖父",
      "祖母",
      "外祖父",
      "外祖母",
      "叔叔",
      "阿姨",
      "哥哥",
      "姐姐",
      "监护人",
      "其他亲属"
    ];

    let createdCount = 0;

    // 批量创建年级（如果不存在）
    for (const grade of grades) {
      await prisma.grade.upsert({
        where: { name: grade.name },
        update: {},
        create: grade
      });
      createdCount++;
    }

    // 批量创建学校（如果不存在）
    for (const schoolName of schools) {
      await prisma.school.upsert({
        where: { name: schoolName },
        update: {},
        create: { name: schoolName }
      });
      createdCount++;
    }

    // 批量创建监护人关系类型（如果不存在）
    for (const typeName of guardianTypes) {
      await prisma.guardianType.upsert({
        where: { name: typeName },
        update: {},
        create: { name: typeName }
      });
      createdCount++;
    }

    return NextResponse.json({ 
      success: true, 
      message: `成功初始化字典数据！创建了 ${grades.length} 个年级、${schools.length} 个学校、${guardianTypes.length} 个监护人关系类型`,
      details: {
        grades: grades.length,
        schools: schools.length,
        guardianTypes: guardianTypes.length
      }
    });

  } catch (error) {
    console.error("初始化字典数据失败:", error);
    return NextResponse.json({ error: "初始化失败" }, { status: 500 });
  }
}
