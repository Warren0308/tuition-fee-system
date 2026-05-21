import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return NextResponse.json({ error: "未授权" }, { status: 401 });
  }

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return NextResponse.json({ error: "需要管理员权限" }, { status: 403 });
  }

  try {
    const payments = await prisma.studentTermPayment.findMany({
      include: {
        student: {
          include: { grade: true }
        },
        items: true
      },
      orderBy: { createdAt: 'desc' }
    });

    // 生成CSV内容
    const headers = [
      '账单ID', '学生姓名', '学生年级', '学年', '学期', '总金额(分)', '总金额(元)', 
      '支付状态', '支付时间', '创建时间', '费用明细'
    ];

    const csvRows = [
      headers.join(','),
      ...payments.map(payment => {
        const items = payment.items.map(item => 
          `${item.description}:${item.finalCents}分`
        ).join(';');

        return [
          payment.id,
          `"${payment.student.fullName}"`,
          `"${payment.student.grade.name}"`,
          payment.year,
          payment.termIndex,
          payment.totalCents,
          `"${(payment.totalCents / 100).toFixed(2)}"`,
          payment.paidAt ? '已支付' : '未支付',
          payment.paidAt ? payment.paidAt.toISOString().split('T')[0] : '',
          payment.createdAt.toISOString().split('T')[0],
          `"${items}"`
        ].join(',');
      })
    ];

    const csvContent = csvRows.join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8' });

    return new NextResponse(blob, {
      headers: {
        'Content-Type': 'text/csv;charset=utf-8',
        'Content-Disposition': `attachment; filename="payments_export_${new Date().toISOString().split('T')[0]}.csv"`
      }
    });

  } catch (error) {
    console.error("导出账单数据失败:", error);
    return NextResponse.json({ error: "导出失败" }, { status: 500 });
  }
}
