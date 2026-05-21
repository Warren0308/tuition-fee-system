"use client";

import { useState } from "react";

interface CustomFeeItem {
  id: string;
  name: string;
  amountCents: number;
}

export function CustomFeeInput() {
  const [customFees, setCustomFees] = useState<CustomFeeItem[]>([]);
  const [newName, setNewName] = useState("");
  const [newAmount, setNewAmount] = useState("");

  const addCustomFee = () => {
    if (!newName.trim() || !newAmount) return;
    const amountCents = Math.round(parseFloat(newAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;

    const newItem: CustomFeeItem = {
      id: `custom_${Date.now()}`,
      name: newName.trim(),
      amountCents,
    };
    setCustomFees([...customFees, newItem]);
    setNewName("");
    setNewAmount("");
  };

  const removeCustomFee = (id: string) => {
    setCustomFees(customFees.filter((f) => f.id !== id));
  };

  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  return (
    <div className="space-y-4">
      {/* 已添加的自定义费用列表 */}
      {customFees.length > 0 && (
        <div className="space-y-2">
          {customFees.map((fee, index) => (
            <div
              key={fee.id}
              className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg"
            >
              <div className="flex items-center space-x-3">
                <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-sm text-purple-700 font-medium">
                  {index + 1}
                </span>
                <div className="font-medium text-gray-800">{fee.name}</div>
                {/* Hidden inputs for form submission */}
                <input type="hidden" name="customFeeNames" value={fee.name} />
                <input type="hidden" name="customFeeAmounts" value={fee.amountCents} />
              </div>
              <div className="flex items-center space-x-3">
                <div className="font-semibold text-purple-600">
                  {formatMoney(fee.amountCents)}
                </div>
                <button
                  type="button"
                  onClick={() => removeCustomFee(fee.id)}
                  className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                  title="删除"
                >
                  ✕
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 添加新的自定义费用 */}
      <div className="flex items-end gap-3 p-4 bg-gray-50 border border-gray-200 border-dashed rounded-lg">
        <div className="flex-1">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            费用名称
          </label>
          <input
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="如：材料费、活动费..."
          />
        </div>
        <div className="w-32">
          <label className="block text-sm font-medium text-gray-600 mb-1">
            金额 (RM)
          </label>
          <input
            type="number"
            step="0.01"
            value={newAmount}
            onChange={(e) => setNewAmount(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-purple-500 focus:border-purple-500"
            placeholder="0.00"
          />
        </div>
        <button
          type="button"
          onClick={addCustomFee}
          disabled={!newName.trim() || !newAmount}
          className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
            newName.trim() && newAmount
              ? "bg-purple-600 hover:bg-purple-700 text-white"
              : "bg-gray-200 text-gray-400 cursor-not-allowed"
          }`}
        >
          ➕ 添加
        </button>
      </div>
    </div>
  );
}
