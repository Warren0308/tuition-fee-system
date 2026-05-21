/**
 * 2026 学年学期 — 唯一数据来源
 *
 * 学期管理（/admin/terms）保存第1期起始日并生成 Term 记录；
 * 学生选课、账单、课表、待支付等全部通过本模块读取同一批 Term。
 */
import { prisma } from "@/lib/prisma";
import {
  ACADEMIC_YEAR,
  ACADEMIC_YEAR_LABEL,
  billingCycleTermWhere,
  buildBillingCycleTermDates,
} from "@/lib/term-utils";

export interface AcademicTerm {
  id: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
  /** 第几期（1–13），按 startDate 排序，与学期管理一致 */
  period: number;
}

export type AcademicYearContext = {
  config: { term1Date: Date } | null;
  terms: AcademicTerm[];
  label: string;
};

function termKey(year: number, termIndex: number) {
  return `${year}_${termIndex}`;
}

/** 将 DB 记录加上 period 序号（与学期管理生成顺序一致） */
export function attachPeriodNumbers<
  T extends { year: number; termIndex: number; startDate: Date }
>(terms: T[]): (T & { period: number })[] {
  const sorted = [...terms].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  return sorted.map((t, i) => ({ ...t, period: i + 1 }));
}

/**
 * 从数据库加载本学年 13 期（学期管理写入的 Term）
 */
export async function getAcademicYearTerms(): Promise<AcademicTerm[]> {
  const raw = await prisma.term.findMany({
    where: billingCycleTermWhere(),
    orderBy: { startDate: "asc" },
  });
  return attachPeriodNumbers(raw) as AcademicTerm[];
}

export async function getAcademicYearContext(): Promise<AcademicYearContext> {
  const [config, terms] = await Promise.all([
    prisma.termConfig.findUnique({ where: { year: ACADEMIC_YEAR } }),
    getAcademicYearTerms(),
  ]);
  return {
    config: config ? { term1Date: config.term1Date } : null,
    terms,
    label: ACADEMIC_YEAR_LABEL,
  };
}

export function findTermByPeriod(
  terms: AcademicTerm[],
  period: number
): AcademicTerm | undefined {
  return terms.find((t) => t.period === period);
}

export function findTermByCoords(
  terms: AcademicTerm[],
  year: number,
  termIndex: number
): AcademicTerm | undefined {
  return terms.find((t) => t.year === year && t.termIndex === termIndex);
}

export function getPeriodForTerm(
  terms: AcademicTerm[],
  year: number,
  termIndex: number
): number | null {
  return findTermByCoords(terms, year, termIndex)?.period ?? null;
}

export function getPeriodForTermId(
  terms: AcademicTerm[],
  termId: number
): number | null {
  return terms.find((t) => t.id === termId)?.period ?? null;
}

/** 第 N 期 → Term（来自 DB，不再硬编码坐标） */
export function resolveTermByPeriod(
  terms: AcademicTerm[],
  period: number
): AcademicTerm | null {
  return findTermByPeriod(terms, period) ?? null;
}

/**
 * 今日所在学期；若无则取已开始的最后一期
 */
export async function getCurrentAcademicTerm(): Promise<AcademicTerm | null> {
  const terms = await getAcademicYearTerms();
  if (terms.length === 0) return null;

  const now = new Date();
  now.setHours(0, 0, 0, 0);

  const current = terms.find((t) => {
    const s = new Date(t.startDate);
    s.setHours(0, 0, 0, 0);
    const e = new Date(t.endDate);
    e.setHours(0, 0, 0, 0);
    return now >= s && now <= e;
  });
  if (current) return current;

  const started = terms.filter((t) => new Date(t.startDate) <= now);
  if (started.length > 0) return started[started.length - 1];

  return terms[0];
}

/** 显示标签：优先用 DB 关联的 period */
export function formatTermDisplay(
  year: number,
  termIndex: number,
  terms?: AcademicTerm[]
): string {
  if (terms) {
    const p = getPeriodForTerm(terms, year, termIndex);
    if (p) return `第${p}期`;
  }
  const t = terms?.find((x) => x.year === year && x.termIndex === termIndex);
  if (t) return `第${t.period}期`;
  return `${year}年第${termIndex}期`;
}

export function formatTermDisplayById(
  termId: number,
  terms: AcademicTerm[]
): string {
  const p = getPeriodForTermId(terms, termId);
  return p ? `第${p}期` : "未知学期";
}

/** 预览：根据第1期起始日生成 13 期（与学期管理表单一致） */
export function previewAcademicYearTerms(term1Start: Date) {
  return buildBillingCycleTermDates(term1Start);
}

/**
 * 根据 termConfig 写入/更新本学年 13 期 Term（学期管理「生成」与保存配置共用）
 */
export async function syncAcademicYearTermsFromConfig(): Promise<number> {
  const cfg = await prisma.termConfig.findUnique({ where: { year: ACADEMIC_YEAR } });
  if (!cfg) return 0;

  const termDates = buildBillingCycleTermDates(cfg.term1Date);
  for (const t of termDates) {
    await prisma.term.upsert({
      where: { year_termIndex: { year: t.year, termIndex: t.termIndex } },
      update: { startDate: t.startDate, endDate: t.endDate },
      create: {
        year: t.year,
        termIndex: t.termIndex,
        startDate: t.startDate,
        endDate: t.endDate,
      },
    });
  }
  return termDates.length;
}

export { ACADEMIC_YEAR, ACADEMIC_YEAR_LABEL, termKey };
