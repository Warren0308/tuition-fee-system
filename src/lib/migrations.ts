import { prisma } from "@/lib/prisma";
import { checkTermDateChangeImpact } from "./term-utils";

interface MigrationContext {
  termId: number;
  oldStartDate: Date;
  newStartDate: Date;
  oldEndDate: Date;
  newEndDate: Date;
  dryRun: boolean;
  logger: any;
}

// 迁移付款记录
async function migratePayments(ctx: MigrationContext) {
  const { termId, oldStartDate, newStartDate, dryRun, logger } = ctx;
  
  // 获取需要迁移的付款记录
  const payments = await prisma.studentTermPayment.findMany({
    where: {
      term: { id: termId }
    },
    include: {
      items: true
    }
  });

  logger.info(`找到 ${payments.length} 条付款记录需要迁移`);

  if (dryRun) return;

  // 计算日期偏移
  const daysDiff = Math.floor(
    (newStartDate.getTime() - oldStartDate.getTime()) / (1000 * 60 * 60 * 24)
  );

  // 更新付款日期
  for (const payment of payments) {
    if (payment.paidAt) {
      const newPaidAt = new Date(payment.paidAt);
      newPaidAt.setDate(newPaidAt.getDate() + daysDiff);

      await prisma.studentTermPayment.update({
        where: { id: payment.id },
        data: { paidAt: newPaidAt }
      });
    }
  }
}

// 迁移课程安排
async function migrateSchedules(ctx: MigrationContext) {
  const { termId, dryRun, logger } = ctx;

  const schedules = await prisma.courseSchedule.findMany({
    where: { termId }
  });

  logger.info(`找到 ${schedules.length} 条课程安排需要迁移`);

  if (dryRun) return;

  // 课程时间不需要调整，因为是按周几和具体时间安排的
  // 但可能需要检查课程安排是否合理
  for (const schedule of schedules) {
    // 这里可以添加课程安排的验证逻辑
    logger.debug(`验证课程安排: ${schedule.id}`);
  }
}

// 迁移注册记录
async function migrateEnrollments(ctx: MigrationContext) {
  const { termId, dryRun, logger } = ctx;

  const enrollments = await prisma.studentEnrollment.findMany({
    where: {
      OR: [
        { startTermId: termId },
        { endTermId: termId }
      ]
    }
  });

  logger.info(`找到 ${enrollments.length} 条注册记录需要迁移`);

  if (dryRun) return;

  // 注册记录只需要更新关联的学期ID，不需要调整日期
  // 但需要确保学期顺序正确
  for (const enrollment of enrollments) {
    if (enrollment.endTermId && enrollment.startTermId > enrollment.endTermId) {
      logger.warn(`注册记录 ${enrollment.id} 的学期顺序不正确`);
      // 这里可以添加修复逻辑
    }
  }
}

// 主迁移函数
export async function migrateTerm(
  termId: number,
  newStartDate: Date,
  options: {
    dryRun?: boolean;
    force?: boolean;
    logger?: any;
  } = {}
) {
  const { dryRun = true, force = false, logger = console } = options;

  try {
    // 获取当前学期信息
    const term = await prisma.term.findUnique({
      where: { id: termId }
    });

    if (!term) {
      throw new Error(`学期 ${termId} 不存在`);
    }

    // 计算新的结束日期
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newStartDate.getDate() + 27);

    // 创建迁移上下文
    const ctx: MigrationContext = {
      termId,
      oldStartDate: term.startDate,
      newStartDate,
      oldEndDate: term.endDate,
      newEndDate,
      dryRun,
      logger
    };

    // 检查影响
    const impact = await checkTermDateChangeImpact(termId, newStartDate);
    if (impact.hasImpact && !force) {
      throw new Error('该修改会影响现有数据，请使用 force 选项强制执行');
    }

    // 开始迁移
    await prisma.$transaction(async () => {
      // 1. 迁移付款记录
      await migratePayments(ctx);

      // 2. 迁移课程安排
      await migrateSchedules(ctx);

      // 3. 迁移注册记录
      await migrateEnrollments(ctx);

      // 4. 更新学期日期
      if (!dryRun) {
        await prisma.term.update({
          where: { id: termId },
          data: {
            startDate: newStartDate,
            endDate: newEndDate
          }
        });
      }
    });

    logger.info('迁移完成');
    return { success: true };
  } catch (error) {
    logger.error('迁移失败:', error);
    throw error;
  }
}








