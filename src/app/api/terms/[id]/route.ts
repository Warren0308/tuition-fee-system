import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getTermDetails, checkTermDateChangeImpact } from "@/lib/term-utils";
import { requireAuth, requireAdmin } from "@/lib/api-auth";

// GET /api/terms/[id] - 获取学期详情 (REST 风格 - 程序调用)
// 表单提交请使用 /api/term/[id]
export async function GET(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAuth();
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt(params.id);
    const term = await prisma.term.findUnique({
      where: { id },
      include: {
        payments: {
          include: {
            student: true,
            items: true
          }
        },
        startEnrollments: {
          include: {
            student: true,
            course: true
          }
        },
        endEnrollments: {
          include: {
            student: true,
            course: true
          }
        },
        schedules: {
          include: {
            course: true
          }
        }
      }
    });

    if (!term) {
      return NextResponse.json(
        { ok: false, error: "学期不存在" },
        { status: 404 }
      );
    }

    const details = await getTermDetails(term.year, term.termIndex);

    return NextResponse.json({
      ok: true,
      data: {
        ...term,
        statistics: details.statistics
      }
    });
  } catch (error) {
    console.error('获取学期详情失败:', error);
    return NextResponse.json(
      { ok: false, error: "获取学期详情失败" },
      { status: 500 }
    );
  }
}

// PATCH /api/terms/[id] - 更新学期信息
export async function PATCH(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt(params.id);
    const data = await req.json();
    
    // 如果要修改日期，先检查影响
    if (data.startDate) {
      const impact = await checkTermDateChangeImpact(id, new Date(data.startDate));
      if (impact.hasImpact) {
        return NextResponse.json({
          ok: false,
          error: "修改日期会影响现有数据",
          impact
        }, { status: 400 });
      }
    }

    const term = await prisma.term.update({
      where: { id },
      data
    });

    return NextResponse.json({ ok: true, data: term });
  } catch (error) {
    console.error('更新学期失败:', error);
    return NextResponse.json(
      { ok: false, error: "更新学期失败" },
      { status: 500 }
    );
  }
}

// DELETE /api/terms/[id] - 删除学期
export async function DELETE(
  req: Request,
  { params }: { params: { id: string } }
) {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    const id = parseInt(params.id);
    
    // 检查是否有关联数据
    const impact = await checkTermDateChangeImpact(id, new Date());
    if (impact.hasImpact) {
      return NextResponse.json({
        ok: false,
        error: "无法删除：该学期已有关联数据",
        impact
      }, { status: 400 });
    }

    await prisma.term.delete({
      where: { id }
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error('删除学期失败:', error);
    return NextResponse.json(
      { ok: false, error: "删除学期失败" },
      { status: 500 }
    );
  }
}








