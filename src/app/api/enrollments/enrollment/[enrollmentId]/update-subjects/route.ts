import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

/**
 * 更新选课的子科目标签 (例如 补习班 下面的 华文/国文/英文/数学/科学)
 * 不影响价格，仅作为展示
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ enrollmentId: string }> }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.json({ error: "未登录" }, { status: 401 });
  }

  const { enrollmentId } = await params;
  const enrollmentIdNum = Number(enrollmentId);

  if (isNaN(enrollmentIdNum)) {
    return NextResponse.json({ error: "无效的选课ID" }, { status: 400 });
  }

  let body: any;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "请求格式错误" }, { status: 400 });
  }

  const subjectCourseIds = Array.isArray(body.subjectCourseIds)
    ? body.subjectCourseIds.map((x: any) => Number(x)).filter((x: number) => !isNaN(x))
    : [];

  try {
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: enrollmentIdNum },
    });
    if (!enrollment) {
      return NextResponse.json({ error: "选课记录不存在" }, { status: 404 });
    }

    // 验证 subjectCourseIds 都是真实存在的课程
    if (subjectCourseIds.length > 0) {
      const courses = await prisma.course.findMany({
        where: { id: { in: subjectCourseIds } },
        select: { id: true },
      });
      if (courses.length !== subjectCourseIds.length) {
        return NextResponse.json({ error: "存在无效的子科目课程ID" }, { status: 400 });
      }
    }

    const updated = await prisma.studentEnrollment.update({
      where: { id: enrollmentIdNum },
      data: { subjectCourseIds },
      include: { course: true },
    });

    return NextResponse.json({
      success: true,
      enrollment: {
        id: updated.id,
        subjectCourseIds: updated.subjectCourseIds,
      },
    });
  } catch (e: any) {
    console.error("更新子科目失败:", e);
    return NextResponse.json({ error: e.message || "更新失败" }, { status: 500 });
  }
}
