import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export async function POST(
  req: Request,
  { params }: { params: { extraFeeId: string } }
) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const { extraFeeId } = params;
  const extraFeeIdNum = parseInt(extraFeeId);

  if (isNaN(extraFeeIdNum)) {
    return NextResponse.json({ error: "无效的额外费用ID" }, { status: 400 });
  }

  try {
    const form = await req.formData();
    const newStartTermId = form.get("startTermId");

    if (!newStartTermId) {
      return NextResponse.json({ error: "请选择新的开始学期" }, { status: 400 });
    }

    const newStartTermIdNum = parseInt(newStartTermId.toString());

    // 获取当前额外费用记录
    const extraFee = await prisma.studentExtraFee.findUnique({
      where: { id: extraFeeIdNum },
      include: { student: true }
    });

    if (!extraFee) {
      return NextResponse.json({ error: "额外费用记录不存在" }, { status: 404 });
    }

    // 如果已结束，检查新的开始学期不能晚于结束学期
    if (extraFee.endTermId && newStartTermIdNum > extraFee.endTermId) {
      return NextResponse.json({ 
        error: "开始学期不能晚于结束学期" 
      }, { status: 400 });
    }

    // 更新开始学期
    await prisma.studentExtraFee.update({
      where: { id: extraFeeIdNum },
      data: { startTermId: newStartTermIdNum }
    });

    // 重定向回学生选课页面
    return NextResponse.redirect(
      new URL(`/students/${extraFee.studentId}/enroll`, req.url)
    );
  } catch (error) {
    console.error("更新额外费用开始学期失败:", error);
    return NextResponse.json({ 
      error: "更新失败",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 });
  }
}
