import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  request: NextRequest,
  { params }: { params: { extraFeeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session || !session.user) {
    return NextResponse.redirect(new URL("/login", request.url));
  }

  const { extraFeeId } = params;
  const extraFeeIdNum = Number(extraFeeId);

  if (isNaN(extraFeeIdNum)) {
    return NextResponse.json({ error: "无效的额外费用ID" }, { status: 400 });
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
    // 获取额外费用信息
    const extraFee = await prisma.studentExtraFee.findUnique({
      where: { id: extraFeeIdNum },
      include: {
        student: true,
      }
    });

    if (!extraFee) {
      return NextResponse.json({ error: "额外费用记录不存在" }, { status: 404 });
    }

    await prisma.studentExtraFee.update({
      where: { id: extraFeeIdNum },
      data: { amountCents: priceCents }
    });

    // 重定向回选课页面
    return NextResponse.redirect(
      new URL(`/students/${extraFee.studentId}/enroll`, request.url),
      { status: 303 }
    );
  } catch (error) {
    console.error("更新额外费用价格失败:", error);
    return NextResponse.json({ error: "更新失败" }, { status: 500 });
  }
}
