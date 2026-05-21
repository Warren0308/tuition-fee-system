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
    const endTermId = form.get("endTermId");

    if (!endTermId) {
      return NextResponse.json({ error: "请选择结束学期" }, { status: 400 });
    }

    const endTermIdNum = parseInt(endTermId.toString());

    // 获取当前额外费用记录
    const extraFee = await prisma.studentExtraFee.findUnique({
      where: { id: extraFeeIdNum },
      include: { student: true }
    });

    if (!extraFee) {
      return NextResponse.json({ error: "额外费用记录不存在" }, { status: 404 });
    }

    // 检查结束学期不能早于开始学期
    if (endTermIdNum < extraFee.startTermId) {
      return NextResponse.json({ 
        error: "结束学期不能早于开始学期" 
      }, { status: 400 });
    }

    // 更新结束学期
    await prisma.studentExtraFee.update({
      where: { id: extraFeeIdNum },
      data: { endTermId: endTermIdNum }
    });

    // 重定向回学生选课页面
    return NextResponse.redirect(
      new URL(`/students/${extraFee.studentId}/enroll`, req.url)
    );
  } catch (error) {
    console.error("结束额外费用失败:", error);
    return NextResponse.json({ 
      error: "操作失败",
      details: error instanceof Error ? error.message : "未知错误"
    }, { status: 500 });
  }
}
