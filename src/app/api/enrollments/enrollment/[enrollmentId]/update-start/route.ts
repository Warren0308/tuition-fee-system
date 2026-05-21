import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { enrollmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { enrollmentId } = params;
  const enrollmentIdNum = parseInt(enrollmentId);

  if (isNaN(enrollmentIdNum)) {
    return NextResponse.json({ error: "无效的选课ID" }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const newStartTermId = form.get("startTermId");

    if (!newStartTermId) {
      return NextResponse.json({ error: "请选择新的开始学期" }, { status: 400 });
    }

    const newStartTermIdNum = parseInt(newStartTermId.toString());

    // 获取当前选课记录
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: enrollmentIdNum },
      include: { student: true, endTerm: true }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "选课记录不存在" }, { status: 404 });
    }

    // 如果课程已结束，检查新的开始学期不能晚于结束学期
    if (enrollment.endTermId && newStartTermIdNum > enrollment.endTermId) {
      return NextResponse.json({ 
        error: "开始学期不能晚于结束学期" 
      }, { status: 400 });
    }

    // 更新开始学期
    await prisma.studentEnrollment.update({
      where: { id: enrollmentIdNum },
      data: { startTermId: newStartTermIdNum }
    });

    // 重定向回学生选课页面
    return NextResponse.redirect(
      new URL(`/students/${enrollment.studentId}/enroll`, req.url)
    );
  } catch (error) {
    console.error("更新开始学期失败:", error);
    return NextResponse.json({ 
      error: "更新失败",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 });
  }
}
