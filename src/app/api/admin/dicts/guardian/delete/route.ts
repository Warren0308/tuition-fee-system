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
      return NextResponse.json({ error: "监护人关系ID不能为空" }, { status: 400 });
    }

    const typeId = Number(id);
    const usageCount = await prisma.studentGuardian.count({
      where: { relationTypeId: typeId },
    });

    if (usageCount > 0 && !force) {
      return NextResponse.json({
        error: `无法删除：该关系类型正被 ${usageCount} 位监护人使用。`,
        blockers: [`${usageCount} 位监护人`],
      }, { status: 400 });
    }

    await prisma.guardianType.delete({ where: { id: typeId } });
    return NextResponse.json({ success: true, message: "监护人关系类型删除成功" });
  } catch (error: any) {
    console.error("删除监护人关系类型失败:", error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "无法删除：存在关联数据" }, { status: 400 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
