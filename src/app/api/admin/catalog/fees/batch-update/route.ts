import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';

export async function POST(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { feeIds, amountCents } = await request.json();

    if (!Array.isArray(feeIds) || feeIds.length === 0) {
      return NextResponse.json({ error: '请选择要修改的课程' }, { status: 400 });
    }

    if (typeof amountCents !== 'number' || amountCents <= 0) {
      return NextResponse.json({ error: '请输入有效金额' }, { status: 400 });
    }

    // 批量更新费用
    await Promise.all(
      feeIds.map(id =>
        prisma.courseFee.update({
          where: { id },
          data: { amountCents }
        })
      )
    );

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('批量更新费用失败:', error);
    return NextResponse.json({ error: '更新失败' }, { status: 500 });
  }
}







