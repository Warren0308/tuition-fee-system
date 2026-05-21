import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { parseLocalDate, calculateEndDate, calculateNextTermStartDate } from "@/lib/date-utils";
import { requireAdmin } from "@/lib/api-auth";
import { logAudit } from "@/lib/audit";

export async function POST(req: Request, { params }: { params: { id: string } }) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const id = Number(params.id);
    if (!id) {
      return NextResponse.json({ ok: false, error: "参数错误" }, { status: 400 });
    }

    const form = await req.formData();
    const startDateStr = String(form.get("startDate") || "");
    
    if (!startDateStr) {
      return NextResponse.json({ ok: false, error: "开始日期必填" }, { status: 400 });
    }

    // 验证日期格式
    if (!/^\d{4}-\d{2}-\d{2}$/.test(startDateStr)) {
      return NextResponse.json({ ok: false, error: "日期格式错误，请使用YYYY-MM-DD格式" }, { status: 400 });
    }

    // 使用本地时区处理日期
    const startDate = parseLocalDate(startDateStr);
    
    // 验证日期是否有效
    if (isNaN(startDate.getTime())) {
      return NextResponse.json({ ok: false, error: "无效的日期" }, { status: 400 });
    }

    const endDate = calculateEndDate(startDate);

    // 获取当前学期信息
    const currentTerm = await prisma.term.findUnique({
      where: { id },
      select: { year: true, termIndex: true, startDate: true, endDate: true }
    });

    if (!currentTerm) {
      return NextResponse.json({ ok: false, error: "学期不存在" }, { status: 404 });
    }

    // 获取同一年份的所有后续学期
    const subsequentTerms = await prisma.term.findMany({
      where: {
        year: currentTerm.year,
        termIndex: { gt: currentTerm.termIndex }
      },
      orderBy: { termIndex: 'asc' }
    });

    try {
      // 开始事务，更新当前学期和所有后续学期
      await prisma.$transaction(async (tx) => {
        // 更新当前学期
        await tx.term.update({
          where: { id },
          data: { startDate, endDate }
        });

        // 更新后续学期
        let nextStartDate = calculateNextTermStartDate(startDate);
        for (const term of subsequentTerms) {
          await tx.term.update({
            where: { id: term.id },
            data: {
              startDate: nextStartDate,
              endDate: calculateEndDate(nextStartDate)
            }
          });
          nextStartDate = calculateNextTermStartDate(nextStartDate);
        }
      });

      await logAudit("Term", "UPDATE_DATE", {
        entityId: id,
        before: {
          startDate: currentTerm.startDate?.toISOString(),
          endDate: currentTerm.endDate?.toISOString(),
        },
        after: {
          startDate: startDate.toISOString(),
          endDate: endDate.toISOString(),
          subsequentTermsAffected: subsequentTerms.length,
        },
      });

      return NextResponse.json({ ok: true });
    } catch (txError) {
      console.error('事务执行失败:', txError);
      return NextResponse.json({ ok: false, error: "更新学期失败" }, { status: 500 });
    }
  } catch (error) {
    console.error('修改学期失败:', error);
    return NextResponse.json(
      { ok: false, error: "服务器错误" },
      { status: 500 }
    );
  }
}