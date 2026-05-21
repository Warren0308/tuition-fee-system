import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

interface ExtraFeeData {
  id: number;
  code: string;
  customPrice: number | null;
}

export async function POST(req: Request, { params }: { params: { studentId: string } }) {
  try {
    const session = await getServerSession(authOptions);
    if (!session) {
      return NextResponse.json({ error: "未授权" }, { status: 401 });
    }

    const studentId = params.studentId;
    
    // 支持 JSON 和 FormData 两种格式
    const contentType = req.headers.get("content-type");
    let courseIds: number[] = [];
    let startTermId: number;
    let extraFees: ExtraFeeData[] = [];
    
    if (contentType?.includes("application/json")) {
      const body = await req.json();
      courseIds = body.courseIds || [];
      startTermId = body.startTermId;
      extraFees = body.extraFees || [];
    } else {
      // 兼容旧的 FormData 格式
      const form = await req.formData();
      const courseId = Number(form.get("courseId"));
      if (courseId) {
        courseIds = [courseId];
      }
      startTermId = Number(form.get("startTermId"));
    }

    if (courseIds.length === 0 || !startTermId) {
      return NextResponse.json({ error: "请选择至少一门课程和学期" }, { status: 400 });
    }

    // 检查是否有已选择的课程（未结束的）
    const existingEnrollments = await prisma.studentEnrollment.findMany({
      where: {
        studentId,
        courseId: { in: courseIds },
        endTermId: null
      },
      include: {
        course: true
      }
    });

    if (existingEnrollments.length > 0) {
      const duplicateCourses = existingEnrollments.map(e => e.course.name).join("、");
      return NextResponse.json({ 
        error: `以下课程已选择: ${duplicateCourses}` 
      }, { status: 400 });
    }

    // 1. 创建选课记录
    const enrollments = await prisma.$transaction(
      courseIds.map(courseId => 
        prisma.studentEnrollment.create({ 
          data: { 
            studentId, 
            courseId, 
            startTermId 
          } 
        })
      )
    );

    // 2. 处理额外费用（膳食、交通等）
    let extraFeeCount = 0;
    const extraFeeErrors: string[] = [];

    if (extraFees.length > 0) {
      for (const fee of extraFees) {
        try {
          const extraFeeType = await prisma.extraFeeType.findUnique({
            where: { id: fee.id }
          });

          if (!extraFeeType) {
            extraFeeErrors.push(`额外费用类型 ${fee.id} 不存在`);
            continue;
          }

          const existingExtraFee = await prisma.studentExtraFee.findFirst({
            where: {
              studentId,
              extraFeeTypeId: fee.id,
              endTermId: null
            }
          });

          if (existingExtraFee) {
            await prisma.studentExtraFee.update({
              where: { id: existingExtraFee.id },
              data: {
                amountCents: fee.customPrice || existingExtraFee.amountCents
              }
            });
            extraFeeCount++;
          } else {
            let amountCents = fee.customPrice;
            if (!amountCents) {
              const student = await prisma.student.findUnique({
                where: { id: studentId },
                select: { gradeId: true }
              });

              if (student) {
                const rate = await prisma.extraFeeRate.findFirst({
                  where: {
                    extraFeeTypeId: fee.id,
                    gradeId: student.gradeId
                  },
                  orderBy: { effectiveFrom: 'desc' }
                });
                amountCents = rate?.amountCents || 0;
              }
            }

            await prisma.studentExtraFee.create({
              data: {
                studentId,
                extraFeeTypeId: fee.id,
                amountCents: amountCents || 0,
                startTermId
              }
            });
            extraFeeCount++;
          }
        } catch (e) {
          console.error(`处理额外费用 ${fee.id} 失败:`, e);
          extraFeeErrors.push(`额外费用 ${fee.id}: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
    }

    return NextResponse.json({
      success: true,
      enrollments: enrollments.length,
      extraFees: extraFeeCount,
      extraFeeErrors: extraFeeErrors.length > 0 ? extraFeeErrors : undefined,
      message:
        `成功选择 ${enrollments.length} 门课程` +
        (extraFeeCount > 0 ? `，${extraFeeCount} 项额外费用` : '') +
        (extraFeeErrors.length > 0 ? `，${extraFeeErrors.length} 项额外费用处理失败` : ''),
    });
  } catch (error) {
    console.error("选课失败:", error);
    return NextResponse.json({ error: "选课失败" }, { status: 500 });
  }
}


