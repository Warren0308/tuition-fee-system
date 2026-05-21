import { prisma } from "@/lib/prisma";

export interface TermPeriod {
  id: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
}

export interface DateValidationResult {
  isValid: boolean;
  term?: TermPeriod;
  error?: string;
}

/**
 * 2026 学年计费周期（内部仍用 calendar term，UI 统一为第1–13期）
 *
 * 第1期 = 12/29 起（内部 2025T13），第2–13期 = 2026T1–T12
 */
export const ACADEMIC_YEAR_LABEL = "2026 学年";
/** 当前使用的学年代号（配置、管理页） */
export const ACADEMIC_YEAR = 2026;

export function getBillingPeriodNumber(
  year: number,
  termIndex: number,
  terms?: Array<{ year: number; termIndex: number; period: number }>
): number | null {
  if (terms) {
    const t = terms.find((x) => x.year === year && x.termIndex === termIndex);
    if (t) return t.period;
  }
  if (year === 2025 && termIndex === 13) return 1;
  if (year === 2026 && termIndex >= 1 && termIndex <= 12) return termIndex + 1;
  return null;
}

/** 第 N 期 → 内部学期坐标（传入 terms 时来自学期管理 DB） */
export function billingPeriodToTerm(
  period: number,
  terms?: Array<{ year: number; termIndex: number; period: number }>
): { year: number; termIndex: number } | null {
  if (terms) {
    const t = terms.find((x) => x.period === period);
    if (t) return { year: t.year, termIndex: t.termIndex };
  }
  if (period === 1) return { year: 2025, termIndex: 13 };
  if (period >= 2 && period <= 13) return { year: 2026, termIndex: period - 1 };
  return null;
}

export function isBillingCycleTerm(year: number, termIndex: number): boolean {
  return getBillingPeriodNumber(year, termIndex) !== null;
}

/** 是否属于 2026 学年计费周期 */
export function isCurrentBillingCycle(year: number, termIndex: number): boolean {
  return isBillingCycleTerm(year, termIndex);
}

/** 主显示：第X期（传入 terms 时与学期管理 DB 完全关联） */
export function formatTermLabel(
  year: number,
  termIndex: number,
  terms?: Array<{ year: number; termIndex: number; period: number }>
): string {
  const bp = getBillingPeriodNumber(year, termIndex, terms);
  if (bp) return `第${bp}期`;
  return `${year}年第${termIndex}期`;
}

/** @deprecated UI 不再显示日历学期副标题 */
export function formatTermSubLabel(_year: number, _termIndex: number): string | null {
  return null;
}

/** 完整标签 */
export function formatTermLabelFull(
  year: number,
  termIndex: number,
  terms?: Array<{ year: number; termIndex: number; period: number }>
): string {
  return formatTermLabel(year, termIndex, terms);
}

/** 排序键：按计费周期顺序 */
export function billingPeriodSortKey(year: number, termIndex: number): number {
  const bp = getBillingPeriodNumber(year, termIndex);
  if (bp) return bp;
  return year * 100 + termIndex;
}

/**
 * 2026 学年全部学期（第1–13期）
 */
export function groupTermsByBillingCycle<T extends { year: number; termIndex: number }>(
  terms: T[]
): { label: string; terms: T[] }[] {
  const cycleTerms = terms
    .filter((t) => isBillingCycleTerm(t.year, t.termIndex))
    .sort(
      (a, b) =>
        billingPeriodSortKey(a.year, a.termIndex) -
        billingPeriodSortKey(b.year, b.termIndex)
    );

  if (cycleTerms.length === 0) return [];
  return [{ label: ACADEMIC_YEAR_LABEL, terms: cycleTerms }];
}

/** Prisma where：2026 学年范围内的学期 */
export function billingCycleTermWhere() {
  return {
    OR: [
      { year: 2025, termIndex: 13 },
      { year: 2026, termIndex: { gte: 1, lte: 12 } },
    ],
  };
}

/** Prisma where：2026 学年范围内的账单 */
export function billingCyclePaymentWhere() {
  return billingCycleTermWhere();
}

export function filterBillingCycleTerms<T extends { year: number; termIndex: number }>(
  terms: T[]
): T[] {
  return terms
    .filter((t) => isBillingCycleTerm(t.year, t.termIndex))
    .sort(
      (a, b) =>
        billingPeriodSortKey(a.year, a.termIndex) -
        billingPeriodSortKey(b.year, b.termIndex)
    );
}

export function filterBillingCyclePayments<
  T extends { year: number; termIndex: number }
>(payments: T[]): T[] {
  return payments
    .filter((p) => isBillingCycleTerm(p.year, p.termIndex))
    .sort(
      (a, b) =>
        billingPeriodSortKey(b.year, b.termIndex) -
        billingPeriodSortKey(a.year, a.termIndex)
    );
}

/** 学期管理 / 日历用：按计费期数（1–13）取背景色 */
export function getBillingPeriodColorClass(period: number, hover = true): string {
  const base = [
    "bg-blue-100",
    "bg-green-100",
    "bg-yellow-100",
    "bg-purple-100",
    "bg-pink-100",
    "bg-indigo-100",
    "bg-red-100",
    "bg-orange-100",
    "bg-lime-100",
    "bg-teal-100",
    "bg-cyan-100",
    "bg-violet-100",
    "bg-rose-100",
  ];
  const color = base[(period - 1) % base.length] || "bg-gray-100";
  return hover ? `${color} hover:opacity-80` : color;
}

/**
 * 从第1期起始日生成 13 期日期，并映射到 DB 坐标
 * 第1期 → 2025T13，第2–13期 → 2026T1–T12
 */
export function buildBillingCycleTermDates(term1Start: Date): Array<{
  period: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
}> {
  const result = [];
  for (let period = 1; period <= 13; period++) {
    const coords = billingPeriodToTerm(period);
    if (!coords) continue;
    const startDate = new Date(term1Start);
    startDate.setDate(startDate.getDate() + 28 * (period - 1));
    const endDate = new Date(startDate);
    endDate.setDate(endDate.getDate() + 27);
    result.push({ period, ...coords, startDate, endDate });
  }
  return result;
}

/**
 * 验证日期是否在指定学期内
 */
export function isDateInTerm(date: Date, term: TermPeriod): boolean {
  const targetDate = new Date(date);
  const termStart = new Date(term.startDate);
  const termEnd = new Date(term.endDate);
  
  // 规范化时间，只比较日期部分
  targetDate.setHours(0, 0, 0, 0);
  termStart.setHours(0, 0, 0, 0);
  termEnd.setHours(0, 0, 0, 0);

  return targetDate >= termStart && targetDate <= termEnd;
}

/**
 * 获取指定日期所属的学期
 */
export async function getTermForDate(date: Date): Promise<TermPeriod | null> {
  const term = await prisma.term.findFirst({
    where: {
      startDate: { lte: date },
      endDate: { gte: date }
    }
  });

  return term;
}

/**
 * 验证日期是否在有效的学期范围内
 */
export async function validateTermDate(
  date: Date,
  options?: {
    year?: number;
    termIndex?: number;
    allowBuffer?: boolean; // 是否允许日期在学期前后的缓冲期内
    bufferDays?: number;   // 缓冲天数，默认7天
  }
): Promise<DateValidationResult> {
  try {
    const { year, termIndex, allowBuffer = false, bufferDays = 7 } = options || {};
    
    // 查询条件
    const where: any = {
      startDate: { lte: date },
      endDate: { gte: date }
    };

    if (year) where.year = year;
    if (termIndex) where.termIndex = termIndex;

    // 查找匹配的学期
    const term = await prisma.term.findFirst({ where });

    if (term) {
      return { isValid: true, term };
    }

    // 如果允许缓冲期，检查日期是否在缓冲期内
    if (allowBuffer) {
      const bufferStart = new Date(date);
      const bufferEnd = new Date(date);
      bufferStart.setDate(bufferStart.getDate() - bufferDays);
      bufferEnd.setDate(bufferEnd.getDate() + bufferDays);

      const termInBuffer = await prisma.term.findFirst({
        where: {
          OR: [
            { startDate: { gte: bufferStart, lte: date } },
            { endDate: { gte: date, lte: bufferEnd } }
          ],
          ...(year ? { year } : {}),
          ...(termIndex ? { termIndex } : {})
        }
      });

      if (termInBuffer) {
        return {
          isValid: true,
          term: termInBuffer,
          error: '日期在学期缓冲期内'
        };
      }
    }

    return {
      isValid: false,
      error: '日期不在任何有效的学期范围内'
    };
  } catch (error) {
    console.error('验证学期日期失败:', error);
    return {
      isValid: false,
      error: '验证日期时发生错误'
    };
  }
}

/**
 * 获取指定学期的相邻学期
 */
export async function getAdjacentTerms(term: TermPeriod) {
  const [previousTerm, nextTerm] = await Promise.all([
    // 获取上一个学期
    prisma.term.findFirst({
      where: {
        OR: [
          {
            year: term.year,
            termIndex: { lt: term.termIndex }
          },
          {
            year: { lt: term.year }
          }
        ]
      },
      orderBy: [
        { year: 'desc' },
        { termIndex: 'desc' }
      ]
    }),
    // 获取下一个学期
    prisma.term.findFirst({
      where: {
        OR: [
          {
            year: term.year,
            termIndex: { gt: term.termIndex }
          },
          {
            year: { gt: term.year }
          }
        ]
      },
      orderBy: [
        { year: 'asc' },
        { termIndex: 'asc' }
      ]
    })
  ]);

  return { previousTerm, nextTerm };
}

/**
 * 获取学期的详细信息
 */
export async function getTermDetails(year: number, termIndex: number) {
  const term = await prisma.term.findUnique({
    where: {
      year_termIndex: {
        year,
        termIndex
      }
    }
  });

  if (!term) {
    throw new Error('学期不存在');
  }

  // 这里可以添加更多的统计信息
  const [studentCount, paymentCount] = await Promise.all([
    // 获取学生数量
    prisma.student.count({
      where: {
        enrollments: {
          some: {
            startTerm: {
              year,
              termIndex
            },
            endTermId: null // 仍在读
          }
        }
      }
    }),
    // 获取付款记录数量
    prisma.studentTermPayment.count({
      where: {
        year,
        termIndex,
        paidAt: { not: null }
      }
    })
  ]);

  return {
    ...term,
    statistics: {
      studentCount,
      paymentCount
    }
  };
}

/**
 * 检查日期移动是否会影响其他数据
 */
export async function checkTermDateChangeImpact(
  termId: number,
  newStartDate: Date
) {
  const term = await prisma.term.findUnique({
    where: { id: termId }
  });

  if (!term) {
    throw new Error('学期不存在');
  }

  // 检查是否有依赖这个学期日期的数据
  const [payments, enrollments, schedules] = await Promise.all([
    // 检查付款记录
    prisma.studentTermPayment.count({
      where: {
        year: term.year,
        termIndex: term.termIndex
      }
    }),
    // 检查注册记录
    prisma.studentEnrollment.count({
      where: {
        OR: [
          { startTermId: term.id },
          { endTermId: term.id }
        ]
      }
    }),
    // 检查课程安排
    prisma.courseSchedule.count({
      where: {
        termId: term.id
      }
    })
  ]);

  return {
    hasImpact: payments > 0 || enrollments > 0 || schedules > 0,
    impacts: {
      payments,
      enrollments,
      schedules
    }
  };
}








