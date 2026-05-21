"use client";

import { useEffect, useMemo, useState } from "react";
import {
  type PaymentHistorySnapshot,
  type PaymentItemSnapshot,
  type HistoryItemToAdd,
  paymentItemKey,
  ITEM_TYPE_LABELS,
} from "@/lib/billing-history-utils";

interface Props {
  pastPayments: PaymentHistorySnapshot[];
  currentItems: PaymentItemSnapshot[];
  onSelectionChange?: (items: HistoryItemToAdd[]) => void;
}

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

function itemUiKey(paymentId: string, item: PaymentItemSnapshot, index: number) {
  return `${paymentId}_${paymentItemKey(item)}_${index}`;
}

export function HistoryBillingPicker({
  pastPayments,
  currentItems,
  onSelectionChange,
}: Props) {
  const [expandedTerms, setExpandedTerms] = useState<Set<string>>(() => {
    if (pastPayments.length > 0) return new Set([pastPayments[0].id]);
    return new Set();
  });
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const allEntriesByUiKey = useMemo(() => {
    const map = new Map<
      string,
      { payment: PaymentHistorySnapshot; item: PaymentItemSnapshot; uiKey: string }
    >();
    for (const payment of pastPayments) {
      payment.items.forEach((item, index) => {
        const uiKey = itemUiKey(payment.id, item, index);
        map.set(uiKey, { payment, item, uiKey });
      });
    }
    return map;
  }, [pastPayments]);

  const selectableItems = useMemo(() => {
    const map = new Map<
      string,
      { payment: PaymentHistorySnapshot; item: PaymentItemSnapshot; uiKey: string }
    >();
    for (const [uiKey, entry] of allEntriesByUiKey) {
      const key = paymentItemKey(entry.item);
      const inBill = currentItems.some((c) => paymentItemKey(c) === key);
      if (inBill) continue;

      const conflictSelected = [...selectedKeys].some((sk) => {
        if (sk === uiKey) return false;
        const other = allEntriesByUiKey.get(sk);
        return other != null && paymentItemKey(other.item) === key;
      });
      if (!conflictSelected || selectedKeys.has(uiKey)) {
        map.set(uiKey, entry);
      }
    }
    return map;
  }, [allEntriesByUiKey, currentItems, selectedKeys]);

  const selectedItems: HistoryItemToAdd[] = useMemo(() => {
    return [...selectedKeys]
      .map((key) => selectableItems.get(key))
      .filter(
        (entry): entry is {
          payment: PaymentHistorySnapshot;
          item: PaymentItemSnapshot;
          uiKey: string;
        } => entry != null
      )
      .map(({ payment, item }) => ({
        ...item,
        sourceLabel: payment.termLabel,
      }));
  }, [selectedKeys, selectableItems]);

  useEffect(() => {
    onSelectionChange?.(selectedItems);
  }, [selectedItems, onSelectionChange]);

  const toggleTerm = (paymentId: string) => {
    setExpandedTerms((prev) => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

  const toggleItem = (uiKey: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(uiKey)) next.delete(uiKey);
      else next.add(uiKey);
      return next;
    });
  };

  const selectAllFromTerm = (payment: PaymentHistorySnapshot) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      payment.items.forEach((item, index) => {
        const uiKey = itemUiKey(payment.id, item, index);
        if (selectableItems.has(uiKey)) next.add(uiKey);
      });
      return next;
    });
    setExpandedTerms((prev) => new Set(prev).add(payment.id));
  };

  if (pastPayments.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4 text-center">
        该学生暂无其他学期的账单可供参考
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <input
        type="hidden"
        name="historyItemsJson"
        value={selectedItems.length > 0 ? JSON.stringify(selectedItems) : ""}
      />

      <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 text-sm text-indigo-800">
        <p className="font-medium mb-1">💡 使用说明</p>
        <ul className="list-disc list-inside space-y-0.5 text-indigo-700">
          <li>若学生本期已缴费但老师尚未录入完整项目，可参考往期账单勾选复制</li>
          <li>已在当前账单中、或本次已勾选的项目会自动隐藏，避免重复</li>
          <li>复制后可在上方「最终金额」调整本期实际收费（如补习班本期只收 RM200）</li>
          <li>
            <strong>补习班/功课班长期改价</strong>请至选课管理；<strong>自定义费用</strong>仅用于报名费、材料费等杂项
          </li>
        </ul>
      </div>

      <div className="space-y-3">
        {pastPayments.map((payment) => {
          const isExpanded = expandedTerms.has(payment.id);
          const termSelectableCount = payment.items.filter((item, index) =>
            selectableItems.has(itemUiKey(payment.id, item, index))
          ).length;
          const termSelectedCount = payment.items.filter((item, index) =>
            selectedKeys.has(itemUiKey(payment.id, item, index))
          ).length;

          return (
            <div
              key={payment.id}
              className="border border-gray-200 rounded-lg overflow-hidden bg-white"
            >
              <div className="flex items-center justify-between px-4 py-3 bg-gray-50">
                <button
                  type="button"
                  onClick={() => toggleTerm(payment.id)}
                  className="flex items-center gap-2 text-left flex-1 min-w-0"
                >
                  <span className="text-gray-400">{isExpanded ? "▼" : "▶"}</span>
                  <span className="font-medium text-gray-800 truncate">{payment.termLabel}</span>
                  <span className="text-sm text-gray-500 shrink-0">
                    {formatMoney(payment.totalCents)} · {payment.items.length} 项
                  </span>
                </button>
                {termSelectableCount > 0 && (
                  <button
                    type="button"
                    onClick={() => selectAllFromTerm(payment)}
                    className="ml-2 shrink-0 text-xs text-indigo-600 hover:text-indigo-800 font-medium px-2 py-1 rounded hover:bg-indigo-50"
                  >
                    复制整期 ({termSelectableCount})
                  </button>
                )}
              </div>

              {isExpanded && (
                <div className="divide-y divide-gray-100">
                  {payment.items.map((item, index) => {
                    const uiKey = itemUiKey(payment.id, item, index);
                    const canSelect = selectableItems.has(uiKey);
                    const isSelected = selectedKeys.has(uiKey);

                    return (
                      <label
                        key={uiKey}
                        className={`flex items-center gap-3 px-4 py-3 ${
                          !canSelect && !isSelected
                            ? "bg-gray-50 opacity-60 cursor-not-allowed"
                            : "hover:bg-indigo-50/50 cursor-pointer"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={!canSelect && !isSelected}
                          onChange={() => toggleItem(uiKey)}
                          className="w-4 h-4 text-indigo-600 rounded border-gray-300 focus:ring-indigo-500 disabled:opacity-50"
                        />
                        <div className="flex-1 min-w-0">
                          <div className="font-medium text-gray-800 truncate">
                            {item.description}
                          </div>
                          <div className="text-xs text-gray-500">
                            {ITEM_TYPE_LABELS[item.itemType] || item.itemType}
                            {!canSelect && !isSelected && " · 已在账单或已勾选同类"}
                          </div>
                        </div>
                        <div className="text-sm font-medium text-gray-700 shrink-0">
                          {formatMoney(item.finalCents)}
                        </div>
                      </label>
                    );
                  })}
                  {termSelectedCount > 0 && (
                    <div className="px-4 py-2 bg-indigo-50 text-xs text-indigo-700">
                      已选 {termSelectedCount} 项，保存后将加入本期账单
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {selectedItems.length > 0 && (
        <div className="border border-indigo-200 rounded-lg p-4 bg-indigo-50/50">
          <p className="text-sm font-medium text-indigo-900 mb-2">
            待加入本期 ({selectedItems.length} 项)
          </p>
          <ul className="space-y-1">
            {selectedItems.map((item, i) => (
              <li key={i} className="text-sm text-indigo-800 flex justify-between gap-4">
                <span className="truncate">
                  {item.description}
                  <span className="text-indigo-500 text-xs ml-1">← {item.sourceLabel}</span>
                </span>
                <span className="shrink-0 font-medium">{formatMoney(item.finalCents)}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
}
