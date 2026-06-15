import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';
import { resolveSecondaryCourseGroup } from '@/lib/secondary-courses';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { courseIds, gradeId, amountCents } = await request.json();

    console.log('添加课程请求:', { courseIds, gradeId, amountCents });

    if (!Array.isArray(courseIds) || courseIds.length === 0) {
      return NextResponse.json({ error: '请选择课程' }, { status: 400 });
    }

    if (!gradeId) {
      return NextResponse.json({ error: '请选择年级' }, { status: 400 });
    }

    if (typeof amountCents !== 'number' || amountCents <= 0) {
      return NextResponse.json({ error: '请输入有效金额' }, { status: 400 });
    }

    // 获取课程字典中的课程
    const dictCourses = await prisma.courseDict.findMany({
      where: {
        id: {
          in: courseIds
        }
      },
      include: {
        type: true
      }
    });

    console.log('找到的课程字典数据:', dictCourses);

    // 检查是否有课程不存在
    if (dictCourses.length !== courseIds.length) {
      return NextResponse.json({ error: '部分课程不存在' }, { status: 400 });
    }

    // 使用事务来确保数据一致性
    const result = await prisma.$transaction(async (tx) => {
      const results = [];

      for (const dictCourse of dictCourses) {
        try {
          // 1. 检查是否已存在费用记录
          const existingFee = await tx.courseFee.findFirst({
            where: {
              gradeId,
              course: {
                dictId: dictCourse.id
              }
            }
          });

          if (existingFee) {
            results.push({
              success: false,
              message: `课程 ${dictCourse.name} 已存在费用设置`
            });
            continue;
          }

          // 2. 查找可用的课程记录
          let course = await tx.course.findFirst({
            where: {
              OR: [
                { dictId: dictCourse.id },
                {
                  AND: [
                    { name: dictCourse.name },
                    { dictId: null }
                  ]
                }
              ]
            }
          });

          // 确定课程组
          let courseGroup: any = 'TUITION';
          if (dictCourse.type.name === '中学课程') {
            courseGroup = resolveSecondaryCourseGroup(dictCourse.name, dictCourse.type.name);
          } else if (dictCourse.type.name === '独立课程') {
            courseGroup = dictCourse.name === '功课班' ? 'HOMEWORK' : 'WRITING';
          }

          if (course) {
            // 如果找到没有 dictId 的课程记录，更新它
            if (!course.dictId) {
              course = await tx.course.update({
                where: { id: course.id },
                data: {
                  dictId: dictCourse.id,
                  group: courseGroup
                }
              });
            }
          } else {
            // 创建新的课程记录
            course = await tx.course.create({
              data: {
                code: `DICT_${dictCourse.id}`,
                name: dictCourse.name,
                group: courseGroup,
                dictId: dictCourse.id,
                isActive: true
              }
            });
          }

          // 3. 创建费用记录
          await tx.courseFee.create({
            data: {
              courseId: course.id,
              gradeId,
              amountCents
            }
          });

          results.push({
            success: true,
            message: `成功添加 ${dictCourse.name} 的费用设置`
          });
        } catch (error) {
          console.error(`添加课程 ${dictCourse.name} 失败:`, error);
          results.push({
            success: false,
            message: `添加课程 ${dictCourse.name} 失败: ${error instanceof Error ? error.message : '未知错误'}`
          });
        }
      }

      return results;
    });

    // 检查结果
    const failures = result.filter(r => !r.success);
    const successes = result.filter(r => r.success);

    if (failures.length > 0) {
      // 如果有任何失败，返回详细信息
      return NextResponse.json({
        error: failures.length === result.length ? '添加失败' : '部分课程添加失败',
        details: failures.map(f => f.message),
        successes: successes.length > 0 ? successes.map(s => s.message) : undefined
      }, { status: 400 });
    }

    return NextResponse.json({ 
      success: true,
      messages: successes.map(s => s.message)
    });
  } catch (error) {
    console.error('添加课程费用失败:', error);
    return NextResponse.json({ 
      error: '添加失败', 
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}