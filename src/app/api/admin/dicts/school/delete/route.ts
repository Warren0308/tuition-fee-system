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
      return NextResponse.json({ error: "学校ID不能为空" }, { status: 400 });
    }

    const schoolId = Number(id);
    const studentCount = await prisma.student.count({ where: { schoolId } });

    if (studentCount > 0 && !force) {
      return NextResponse.json({
        error: `无法删除：该学校有 ${studentCount} 名学生使用中。请先调整学生学校或选择强制删除。`,
        blockers: [`${studentCount} 名学生`],
      }, { status: 400 });
    }

    // 如果 force 删除，把关联学生的 schoolId 设为 null
    if (force && studentCount > 0) {
      await prisma.student.updateMany({
        where: { schoolId },
        data: { schoolId: null },
      });
    }

    await prisma.school.delete({ where: { id: schoolId } });
    return NextResponse.json({ success: true, message: "学校删除成功" });
  } catch (error: any) {
    console.error("删除学校失败:", error);
    if (error.code === 'P2003') {
      return NextResponse.json({ error: "无法删除：存在关联数据" }, { status: 400 });
    }
    return NextResponse.json({ error: "删除失败" }, { status: 500 });
  }
}
