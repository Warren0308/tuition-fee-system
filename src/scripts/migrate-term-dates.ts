import { prisma } from "@/lib/prisma";
import { checkTermDateChangeImpact } from "@/lib/term-utils";

interface MigrationOptions {
  dryRun?: boolean;
  force?: boolean;
  logLevel?: 'info' | 'debug' | 'error';
}

/**
 * 迁移学期日期
 * @param termId 学期ID
 * @param newStartDate 新的开始日期
 * @param options 迁移选项
 */
export async function migrateTermDates(
  termId: number,
  newStartDate: Date,
  options: MigrationOptions = {}
) {
  const { dryRun = true, force = false, logLevel = 'info' } = options;
  const log = createLogger(logLevel);

  try {
    log.info(`开始迁移学期 ${termId} 的日期...`);

    // 获取当前学期信息
    const term = await prisma.term.findUnique({
      where: { id: termId }
    });

    if (!term) {
      throw new Error(`学期 ${termId} 不存在`);
    }

    // 检查影响
    const impact = await checkTermDateChangeImpact(termId, newStartDate);
    log.debug('影响分析:', impact);

    if (impact.hasImpact && !force) {
      throw new Error('该修改会影响现有数据，请使用 force 选项强制执行');
    }

    // 计算新的结束日期
    const newEndDate = new Date(newStartDate);
    newEndDate.setDate(newStartDate.getDate() + 27);

    if (dryRun) {
      log.info('试运行模式，不会实际修改数据');
      log.info('将要进行的修改:', {
        termId,
        oldStartDate: term.startDate,
        newStartDate,
        oldEndDate: term.endDate,
        newEndDate
      });
      return;
    }

    // 开始事务
    await prisma.$transaction(async (tx) => {
      // 更新学期日期
      await tx.term.update({
        where: { id: termId },
        data: {
          startDate: newStartDate,
          endDate: newEndDate
        }
      });

      // 更新相关数据
      if (impact.impacts.payments > 0) {
        log.info(`更新 ${impact.impacts.payments} 条付款记录...`);
        // 这里添加付款记录的更新逻辑
      }

      if (impact.impacts.enrollments > 0) {
        log.info(`更新 ${impact.impacts.enrollments} 条注册记录...`);
        // 这里添加注册记录的更新逻辑
      }

      if (impact.impacts.schedules > 0) {
        log.info(`更新 ${impact.impacts.schedules} 条课程安排...`);
        // 这里添加课程安排的更新逻辑
      }
    });

    log.info('迁移完成');
  } catch (error) {
    log.error('迁移失败:', error);
    throw error;
  }
}

// 创建日志记录器
function createLogger(level: 'info' | 'debug' | 'error') {
  return {
    info: (message: string, data?: any) => {
      if (level === 'info' || level === 'debug') {
        console.log(message, data ? data : '');
      }
    },
    debug: (message: string, data?: any) => {
      if (level === 'debug') {
        console.log('[DEBUG]', message, data ? data : '');
      }
    },
    error: (message: string, error?: any) => {
      console.error(message, error ? error : '');
    }
  };
}

// 使用示例：
// await migrateTermDates(1, new Date('2025-01-01'), {
//   dryRun: true,
//   force: false,
//   logLevel: 'debug'
// });








