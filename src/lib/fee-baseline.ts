/**
 * 费用基准期 — 老师 Excel 第5期数据不完整，第5期及以后应缴项目以第4期选课/额外费用为准。
 * 第5期账单仅用于追收尚未交完的费用（对照第4期应缴结构）。
 */
import {
  findTermByPeriod,
  getAcademicYearTerms,
  type AcademicTerm,
} from "@/lib/academic-year";

/** 应缴结构基准：第4期 */
export const FEE_BASELINE_PERIOD = 4;

/** 从第几期起使用基准期结构（含第5期） */
export const FEE_BASELINE_FROM_PERIOD = 5;

export async function getFeeBaselineTerm(): Promise<AcademicTerm | null> {
  const terms = await getAcademicYearTerms();
  return findTermByPeriod(terms, FEE_BASELINE_PERIOD) ?? null;
}

/**
 * 计算「应缴项目」查询用的学期 id。
 * 第5期及以后 → 第4期；第1–4期 → 当期。
 */
export function resolveFeeLookupTermId(
  billingTermId: number,
  terms: AcademicTerm[]
): number {
  const billingTerm = terms.find((t) => t.id === billingTermId);
  if (!billingTerm) return billingTermId;

  if (billingTerm.period >= FEE_BASELINE_FROM_PERIOD) {
    const baseline = findTermByPeriod(terms, FEE_BASELINE_PERIOD);
    return baseline?.id ?? billingTermId;
  }
  return billingTermId;
}

export async function resolveFeeLookupTermIdAsync(
  billingTermId: number
): Promise<number> {
  const terms = await getAcademicYearTerms();
  return resolveFeeLookupTermId(billingTermId, terms);
}

/** Prisma where：在指定期（或基准期）有效的选课/额外费用 */
export function activeInTermWhere(termId: number) {
  return {
    startTermId: { lte: termId },
    OR: [{ endTermId: null }, { endTermId: { gte: termId } }],
  };
}

export function activeInTermWhereForBilling(
  billingTermId: number,
  terms: AcademicTerm[]
) {
  const feeTermId = resolveFeeLookupTermId(billingTermId, terms);
  return activeInTermWhere(feeTermId);
}
