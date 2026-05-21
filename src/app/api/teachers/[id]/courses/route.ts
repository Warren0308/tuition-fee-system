import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

/**
 * 教师-课程绑定管理
 * Body: { courseIds: number[] }
 * 全量替换该教师的课程绑定
 */
export async function POST(req: Request, { params }: { params: { id: string } }) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  const teacherId = params.id;
  try {
    const { courseIds } = await req.json();
    if (!Array.isArray(courseIds)) {
      return NextResponse.json({ error: "courseIds 必须是数组" }, { status: 400 });
    }

    const teacher = await prisma.teacher.findUnique({ where: { id: teacherId } });
    if (!teacher) {
      return NextResponse.json({ error: "教师不存在" }, { status: 404 });
    }

    // 验证 course 存在
    const validCourses = await prisma.course.findMany({
      where: { id: { in: courseIds.map(Number) }, isActive: true },
      select: { id: true },
    });
    const validIds = new Set(validCourses.map((c) => c.id));

    // 全量替换
    await prisma.$transaction([
      prisma.teacherCourse.deleteMany({ where: { teacherId } }),
      prisma.teacherCourse.createMany({
        data: Array.from(validIds).map((courseId) => ({ teacherId, courseId })),
        skipDuplicates: true,
      }),
    ]);

    return NextResponse.json({ ok: true, count: validIds.size });
  } catch (error: any) {
    console.error("更新教师课程绑定失败:", error);
    return NextResponse.json(
      { error: error.message || "操作失败" },
      { status: 500 }
    );
  }
}
