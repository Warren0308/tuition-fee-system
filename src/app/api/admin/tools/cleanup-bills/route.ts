import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/api-auth";

export async function POST() {
  const auth = await requireAdmin();
  if (!auth.ok) return auth.response;

  try {
    // 清理空的账单记录（没有任何费用项目的账单）
    const result = await prisma.$transaction(async (tx) => {
      // 找出没有费用项目的账单
      const emptyPayments = await tx.studentTermPayment.findMany({
        where: {
          items: {
            none: {}
          }
        },
        select: { id: true }
      });

      if (emptyPayments.length === 0) {
        return { deletedCount: 0 };
      }

      // 删除这些空账单
      const deleteResult = await tx.studentTermPayment.deleteMany({
        where: {
          id: {
            in: emptyPayments.map(p => p.id)
          }
        }
      });

      return { deletedCount: deleteResult.count };
    });

    return NextResponse.json({ 
      success: true, 
      message: `成功清理 ${result.deletedCount} 条空账单记录` 
    });
  } catch (error) {
    console.error("清理空账单失败:", error);
    return NextResponse.json({ error: "清理失败" }, { status: 500 });
  }
}
