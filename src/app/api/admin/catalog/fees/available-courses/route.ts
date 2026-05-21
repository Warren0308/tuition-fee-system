import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { isCourseExistInFees } from '@/lib/course-utils';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const gradeId = searchParams.get('gradeId');

    console.log('请求参数:', { gradeId });

    if (!gradeId) {
      return NextResponse.json({ error: '请选择年级' }, { status: 400 });
    }

    // 获取课程类型和课程
    console.log('正在获取课程类型...');
    const courseTypes = await prisma.courseType.findMany({
      orderBy: { orderIndex: 'asc' },
      include: {
        courses: {
          orderBy: { orderIndex: 'asc' },
          include: {
            type: true
          }
        }
      }
    });
    console.log('课程类型:', JSON.stringify(courseTypes, null, 2));

    // 获取该年级已有的课程费用
    console.log('正在获取已有课程费用...');
    const existingFees = await prisma.courseFee.findMany({
      where: { 
        gradeId: parseInt(gradeId) 
      },
      include: {
        course: true
      }
    });
    console.log('已有课程费用:', JSON.stringify(existingFees, null, 2));

    // 按课程类型分组
    const groupedCourses: Record<string, { id: number; name: string; isExisting: boolean }[]> = {};

    for (const courseType of courseTypes) {
      const coursesInType = courseType.courses;
      if (coursesInType.length > 0) {
        groupedCourses[courseType.name] = coursesInType.map(dictCourse => {
          // 使用更新后的函数检查课程是否已存在
          const isExisting = isCourseExistInFees(dictCourse, existingFees);

          console.log(`课程 ${dictCourse.name} (${courseType.name}) isExisting: ${isExisting}`);

          return {
            id: dictCourse.id,
            name: dictCourse.name,
            isExisting
          };
        });
      }
    }

    console.log('返回数据:', JSON.stringify(groupedCourses, null, 2));
    return NextResponse.json(groupedCourses);
  } catch (error) {
    console.error('获取可用课程失败:', error);
    return NextResponse.json({ 
      error: '获取失败', 
      details: error instanceof Error ? error.message : '未知错误',
      stack: error instanceof Error ? error.stack : undefined
    }, { status: 500 });
  }
}