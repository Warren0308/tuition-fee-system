import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { enrollmentId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { enrollmentId } = params;
  const enrollmentIdNum = Number(enrollmentId);

  if (isNaN(enrollmentIdNum)) {
    return NextResponse.json({ error: "无效的选课ID" }, { status: 400 });
  }

  const form = await request.formData();
  const priceStr = form.get("price");

  if (!priceStr) {
    return NextResponse.json({ error: "价格不能为空" }, { status: 400 });
  }

  const priceCents = Math.round(parseFloat(priceStr.toString()) * 100);

  if (isNaN(priceCents) || priceCents < 0) {
    return NextResponse.json({ error: "无效的价格" }, { status: 400 });
  }

  try {
    // 获取选课信息以找到学生和默认价格
    const enrollment = await prisma.studentEnrollment.findUnique({
      where: { id: enrollmentIdNum },
      include: {
        student: true,
        course: {
          include: {
            fees: {
              orderBy: { effectiveFrom: 'desc' },
              take: 1
            }
          }
        }
      }
    });

    if (!enrollment) {
      return NextResponse.json({ error: "选课记录不存在" }, { status: 404 });
    }

    // 获取该年级的默认价格
    const courseFee = await prisma.courseFee.findFirst({
      where: {
        courseId: enrollment.courseId,
        gradeId: enrollment.student.gradeId
      },
      orderBy: { effectiveFrom: 'desc' }
    });

    const defaultPrice = courseFee?.amountCents || 0;

    // 如果价格等于默认价格，则清除自定义价格
    const customPriceCents = priceCents === defaultPrice ? null : priceCents;

    await prisma.studentEnrollment.update({
      where: { id: enrollmentIdNum },
      data: { customPriceCents }
    });

    // 重定向回选课页面
    return NextResponse.redirect(
      new URL(`/students/${enrollment.studentId}/enroll`, request.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("更新价格失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
