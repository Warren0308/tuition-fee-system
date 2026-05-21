/**
 * 额外费用分段 — 同一费用类型可有多段（如第2期有膳食、第3期无、第4期又有）
 */
import type { Prisma } from "@prisma/client";

type TermRef = { id: number; startDate: Date };

/** 记录在该 termId 是否应收此额外费用 */
export function extraFeeAppliesInTerm(
  fee: { startTermId: number; endTermId: number | null },
  termId: number
): boolean {
  if (fee.startTermId > termId) return false;
  if (fee.endTermId != null && fee.endTermId < termId) return false;
  return true;
}

/** 列出 termId 落在 [start, end] 内的所有 term id（含端点） */
export function termIdsInRange(
  startTermId: number,
  endTermId: number | null,
  allTerms: TermRef[]
): number[] {
  const sorted = [...allTerms].sort(
    (a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime()
  );
  const startIdx = sorted.findIndex((t) => t.id === startTermId);
  if (startIdx < 0) return [];
  const endIdx =
    endTermId == null
      ? sorted.length - 1
      : sorted.findIndex((t) => t.id === endTermId);
  if (endIdx < startIdx) return [];
  return sorted.slice(startIdx, endIdx + 1).map((t) => t.id);
}

/** 检查新分段是否与同学同类型已有记录重叠 */
export function extraFeeRangeOverlaps(
  existing: Array<{ startTermId: number; endTermId: number | null; id?: number }>,
  startTermId: number,
  endTermId: number | null,
  allTerms: TermRef[],
  excludeId?: number
): boolean {
  const newIds = new Set(termIdsInRange(startTermId, endTermId, allTerms));
  for (const ex of existing) {
    if (excludeId != null && ex.id === excludeId) continue;
    const exIds = termIdsInRange(ex.startTermId, ex.endTermId, allTerms);
    if (exIds.some((id) => newIds.has(id))) return true;
  }
  return false;
}

export const extraFeeActiveInTermWhere = (termId: number): Prisma.StudentExtraFeeWhereInput => ({
  startTermId: { lte: termId },
  OR: [{ endTermId: null }, { endTermId: { gte: termId } }],
});
