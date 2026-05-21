import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST(req: Request) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const body = await req.json();
    const { id, force } = body;

    if (!id) {
      return NextResponse.json({ error: "年级ID不能为空" }, { status: 400 });
    }

    const gradeId = Number(id);

    // FK 检查：学生、课程费率、额外费率
    const [studentCount, feeCount, extraRateCount] = await Promise.all([
      prisma.student.count({ where: { gradeId } }),
      prisma.courseFee.count({ where: { gradeId } }),
      prisma.extraFeeRate.count({ where: { gradeId } }),
    ]);

    const blockers: string[] = [];
    if (studentCount > 0) blockers.push(`${studentCount} 名学生`);
    if (feeCount > 0) blockers.push(`${feeCount} 条课程费率`);
    if (extraRateCount > 0) blockers.push(`${extraRateCount} 条额外费率`);

    if (blockers.length > 0 && !force) {
      return NextResponse.json({
        error: `无法删除：该年级仍在使用（${blockers.join('、')}）。请先移除相关数据。`,
        blockers,
      }, { status: 400 });
    }

    await prisma.grade.delete({ where: { id: gradeId } });
    return NextResponse.json({ success: true, message: "年级删除成功" });
  } catch (error: any) {
    console.error("删除年级失败:", error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "无法删除：存在关联数据" }, { status: 400 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
