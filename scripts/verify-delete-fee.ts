import { prisma } from "../src/lib/prisma";

async function main() {
  try {
    // 1. 先检查一年级的所有费用记录
    console.log('=== 检查一年级现有费用记录 ===');
    const fees = await prisma.courseFee.findMany({
      where: {
        grade: {
          name: '一年级'
        }
      },
      include: {
        course: {
          include: {
            dict: true
          }
        },
        grade: true
      }
    });

    console.log(`找到 ${fees.length} 条费用记录:`);
    for (const fee of fees) {
      console.log(`- ${fee.grade.name} / ${fee.course.name} (Fee ID: ${fee.id}, Course ID: ${fee.courseId})`);
    }

    // 2. 模拟删除第一条记录
    if (fees.length > 0) {
      const feeToDelete = fees[0];
      console.log('\n=== 模拟删除费用记录 ===');
      console.log('准备删除:', {
        feeId: feeToDelete.id,
        grade: feeToDelete.grade.name,
        course: feeToDelete.course.name
      });

      await prisma.courseFee.delete({
        where: {
          id: feeToDelete.id
        }
      });

      // 3. 验证删除结果
      console.log('\n=== 验证删除结果 ===');
      const deletedFee = await prisma.courseFee.findUnique({
        where: {
          id: feeToDelete.id
        }
      });

      if (deletedFee) {
        console.log('错误: 费用记录仍然存在!');
      } else {
        console.log('费用记录已成功删除');
      }

      // 4. 检查相关课程记录是否还存在
      const course = await prisma.course.findUnique({
        where: {
          id: feeToDelete.courseId
        },
        include: {
          dict: true,
          fees: true
        }
      });

      console.log('\n=== 相关课程记录状态 ===');
      if (course) {
        console.log('课程记录:', {
          id: course.id,
          name: course.name,
          dictId: course.dictId,
          remainingFees: course.fees.length
        });
      } else {
        console.log('课程记录不存在');
      }
    }

  } catch (error) {
    console.error('操作失败:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();







