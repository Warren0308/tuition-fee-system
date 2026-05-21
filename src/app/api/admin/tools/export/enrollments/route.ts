import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    const enrollments = await prisma.studentEnrollment.findMany({
      include: {
        student: {
          include: { grade: true }
        },
        course: true,
        startTerm: true,
        endTerm: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 生成CSV内容
    const headers = [
      '注册ID', '学生姓名', '学生年级', '课程名称', '课程组别', 
      '开始学期年份', '开始学期序号', '结束学期年份', '结束学期序号', 
      '状态', '注册时间'
    ];

    const csvRows = [
      headers.join(','),
      ...enrollments.map(enrollment => {
        return [
          enrollment.id,
          `"${enrollment.student.fullName}"`,
          `"${enrollment.student.grade.name}"`,
          `"${enrollment.course.name}"`,
          `"${enrollment.course.group}"`,
          enrollment.startTerm.year,
          enrollment.startTerm.termIndex,
          enrollment.endTerm?.year || '',
          enrollment.endTerm?.termIndex || '',
          enrollment.endTermId ? '已结束' : '进行中',
          enrollment.createdAt.toISOString().split('T')[0]
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="enrollments_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("导出课程注册数据失败:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
