import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCourseExistInFees } from '@/lib/course-utils';
import { requireAdmin } from '@/lib/api-auth';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get('gradeId');

    if (!gradeId) {
      return NextResponse.json({ error: '请选择年级' }, { status: 400 });
    }

    const courseTypes = await prisma.courseType.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        courses: {
          orderBy: { orderIndex: 'asc' },
          include: { type: true }
        }
      }
    });

    const existingFees = await prisma.courseFee.findMany({
      where: { gradeId: parseInt(gradeId) },
      include: { course: true }
    });

    const groupedCourses: Record<string, { id: number; name: string; isExisting: boolean }[]> = {};

    for (const courseType of courseTypes) {
      const coursesInType = courseType.courses;
      if (coursesInType.length > 0) {
        groupedCourses[courseType.name] = coursesInType.map(dictCourse => ({
          id: dictCourse.id,
          name: dictCourse.name,
          isExisting: isCourseExistInFees(dictCourse, existingFees),
        }));
      }
    }

    return NextResponse.json(groupedCourses);
  } catch (error) {
    console.error('获取可用课程失败:', error);
    return NextResponse.json({ error: '获取失败' }, { status: 500 });
  }
}