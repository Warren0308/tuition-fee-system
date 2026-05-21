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
    const students = await prisma.student.findMany({
      include: {
        grade: true,
        school: true,
        guardians: {
          include: {
            relationType: true
          }
        },
        enrollments: {
          where: { endTermId: null },
          include: { course: true }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 生成CSV内容
    const headers = [
      '学生ID', '姓名', '年级', '班级', '学校', '地址', '状态', '创建时间',
      '监护人1姓名', '监护人1关系', '监护人1电话', '监护人1主要联系人',
      '监护人2姓名', '监护人2关系', '监护人2电话', '监护人2主要联系人',
      '在读课程'
    ];

    const csvRows = [
      headers.join(','),
      ...students.map(student => {
        const guardian1 = student.guardians[0];
        const guardian2 = student.guardians[1];
        const courses = student.enrollments.map(e => e.course.name).join(';');

        return [
          student.id,
          `"${student.fullName}"`,
          `"${student.grade.name}"`,
          `"${student.className || ''}"`,
          `"${student.school?.name || ''}"`,
          `"${student.address || ''}"`,
          student.isActive ? '活跃' : '停用',
          student.createdAt.toISOString().split('T')[0],
          `"${guardian1?.name || ''}"`,
          `"${guardian1?.relationType.name || ''}"`,
          `"${guardian1?.phone || ''}"`,
          guardian1?.isPrimary ? '是' : '否',
          `"${guardian2?.name || ''}"`,
          `"${guardian2?.relationType.name || ''}"`,
          `"${guardian2?.phone || ''}"`,
          guardian2?.isPrimary ? '是' : '否',
          `"${courses}"`
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="students_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("导出学生数据失败:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
