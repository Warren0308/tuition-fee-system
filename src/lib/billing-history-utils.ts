import { billingPeriodSortKey, formatTermLabelFull } from "@/lib/term-utils";

export interface PaymentItemSnapshot {
  itemType: string;
  refId: number | null;
  description: string;
  unitCents: number;
  quantity: number;
  fraction: number;
  finalCents: number;
  note: string | null;
}

export interface PaymentHistorySnapshot {
  id: string;
  year: number;
  termIndex: number;
  termLabel: string;
  totalCents: number;
  paidAt: string | null;
  items: PaymentItemSnapshot[];
}

export interface HistoryItemToAdd extends PaymentItemSnapshot {
  sourceLabel: string;
}

export const ITEM_TYPE_LABELS: Record<string, string> = {
  COURSE: "课程",
  EXTRA_FEE: "额外费用",
  TEMP_EXTRA_FEE: "临时额外费用",
  CUSTOM_FEE: "自定义费用",
};

/** 用于判断历史项目是否已在当前账单中 */
export function paymentItemKey(item: {
  itemType: string;
  refId: number | null;
  description: string;
}): string {
  if (item.refId != null) return `${item.itemType}:${item.refId}`;
  return `${item.itemType}:${item.description}`;
}

export function isItemAlreadyInBill(
  item: PaymentItemSnapshot,
  currentItems: PaymentItemSnapshot[]
): boolean {
  const key = paymentItemKey(item);
  return currentItems.some((c) => paymentItemKey(c) === key);
}

export function sortPaymentsByBillingPeriod<
  T extends { year: number; termIndex: number }
>(payments: T[]): T[] {
  return [...payments].sort(
    (a, b) =>
      billingPeriodSortKey(b.year, b.termIndex) -
      billingPeriodSortKey(a.year, a.termIndex)
  );
}

export function toPaymentHistorySnapshots(
  payments: Array<{
    id: string;
    year: number;
    termIndex: number;
    totalCents: number;
    paidAt: Date | null;
    items: Array<{
      itemType: string;
      refId: number | null;
      description: string;
      unitCents: number;
      quantity: number;
      fraction: number;
      finalCents: number;
      note: string | null;
    }>;
  }>,
  labelTerms?: Array<{ year: number; termIndex: number; period: number }>
): PaymentHistorySnapshot[] {
  return sortPaymentsByBillingPeriod(payments).map((p) => ({
    id: p.id,
    year: p.year,
    termIndex: p.termIndex,
    termLabel: formatTermLabelFull(p.year, p.termIndex, labelTerms),
    totalCents: p.totalCents,
    paidAt: p.paidAt ? p.paidAt.toISOString() : null,
    items: p.items.map((i) => ({
      itemType: i.itemType,
      refId: i.refId,
      description: i.description,
      unitCents: i.unitCents,
      quantity: i.quantity,
      fraction: i.fraction,
      finalCents: i.finalCents,
      note: i.note,
    })),
  }));
}

/** 从账单项目中提取额外费用类型 ID（含 EXTRA_FEE / TEMP_EXTRA_FEE） */
export function extraFeeTypeIdsFromItems(
  items: Array<{ itemType: string; refId: number | null }>
): Set<number> {
  const ids = new Set<number>();
  for (const item of items) {
    if (
      (item.itemType === "EXTRA_FEE" || item.itemType === "TEMP_EXTRA_FEE") &&
      item.refId != null
    ) {
      ids.add(item.refId);
    }
  }
  return ids;
}
