"use client";

import { useMemo, useState } from "react";
import { HistoryBillingPicker } from "./HistoryBillingPicker";
import { TempExtraFeeInput } from "./TempExtraFeeInput";
import {
  type PaymentHistorySnapshot,
  type PaymentItemSnapshot,
  type HistoryItemToAdd,
  extraFeeTypeIdsFromItems,
} from "@/lib/billing-history-utils";

interface ExtraFeeType {
  id: number;
  code: string;
  name: string;
}

interface Props {
  pastPayments: PaymentHistorySnapshot[];
  currentItems: PaymentItemSnapshot[];
  unusedExtraFeeTypes: ExtraFeeType[];
  studentId: string;
}

export function EditPaymentAddOns({
  pastPayments,
  currentItems,
  unusedExtraFeeTypes,
  studentId,
}: Props) {
  const [pendingHistoryItems, setPendingHistoryItems] = useState<HistoryItemToAdd[]>([]);

  const blockedExtraFeeTypeIds = useMemo(() => {
    const fromBill = extraFeeTypeIdsFromItems(currentItems);
    const fromHistory = extraFeeTypeIdsFromItems(pendingHistoryItems);
    return new Set([...fromBill, ...fromHistory]);
  }, [currentItems, pendingHistoryItems]);

  const filteredTempExtraTypes = useMemo(
    () => unusedExtraFeeTypes.filter((t) => !blockedExtraFeeTypeIds.has(t.id)),
    [unusedExtraFeeTypes, blockedExtraFeeTypeIds]
  );

  return (
    <>
      <div className="mb-6">
        <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
          <span className="mr-2">📜</span> 历史账单参考
          <span className="ml-2 text-sm font-normal text-indigo-600">
            （快速复制往期项目；金额不对请在上方「最终金额」修改）
          </span>
        </h3>
        <HistoryBillingPicker
          pastPayments={pastPayments}
          currentItems={currentItems}
          onSelectionChange={setPendingHistoryItems}
        />
      </div>

      {filteredTempExtraTypes.length > 0 ? (
        <div className="mb-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4 flex items-center">
            <span className="mr-2">🚌</span> 临时额外费用
            <span className="ml-2 text-sm font-normal text-blue-600">
              （学生未注册、仅本期一次性收取时使用）
            </span>
          </h3>
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <TempExtraFeeInput extraFeeTypes={filteredTempExtraTypes} />
            <p className="text-sm text-blue-700 mt-3">
              💡 若学生长期有交通/膳食，应到{" "}
              <a
                href={`/students/${studentId}/enroll`}
                className="underline font-medium hover:text-blue-900"
              >
                选课管理
              </a>{" "}
              注册并设定价格；勿与历史参考或上方已有项目重复添加。
            </p>
          </div>
        </div>
      ) : unusedExtraFeeTypes.length > 0 ? (
        <div className="mb-6 text-sm text-gray-500 bg-gray-50 border border-gray-200 rounded-lg px-4 py-3">
          临时额外费用选项已隐藏：所选历史项目或当前账单已包含对应费用类型。
        </div>
      ) : null}
    </>
  );
}
