import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/api-auth';

export async function DELETE(request: Request) {
  try {
    const auth = await requireAdmin();
    if (!auth.ok) return auth.response;

    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: '请提供费用ID' }, { status: 400 });
    }

    // 使用事务确保数据一致性
    await prisma.$transaction(async (tx) => {
      // 1. 获取费用记录及相关信息
      const fee = await tx.courseFee.findUnique({
        where: { id: parseInt(id) },
        include: {
          course: {
            include: {
              fees: true,
              dict: true
            }
          }
        }
      });

      if (!fee) {
        throw new Error('费用记录不存在');
      }

      // 2. 删除费用记录
      await tx.courseFee.delete({
        where: { id: parseInt(id) }
      });

      // 3. 检查课程是否还有其他费用记录
      const remainingFees = fee.course.fees.filter(f => f.id !== parseInt(id));
      
      // 如果这是最后一个费用记录，重置课程的 dictId
      if (remainingFees.length === 0) {
        await tx.course.update({
          where: { id: fee.course.id },
          data: { dictId: null }
        });
      }
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('删除费用失败:', error);
    return NextResponse.json({ 
      error: '删除失败',
      details: error instanceof Error ? error.message : '未知错误'
    }, { status: 500 });
  }
}