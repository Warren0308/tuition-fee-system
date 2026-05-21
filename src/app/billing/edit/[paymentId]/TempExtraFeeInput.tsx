"use client";

import { useState } from "react";

interface ExtraFeeType {
  id: number;
  code: string;
  name: string;
}

interface Props {
  extraFeeTypes: ExtraFeeType[];
}

export function TempExtraFeeInput({ extraFeeTypes }: Props) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [prices, setPrices] = useState<Record<number, string>>({});

  const toggleSelect = (id: number) => {
    const newSet = new Set(selected);
    if (newSet.has(id)) {
      newSet.delete(id);
    } else {
      newSet.add(id);
    }
    setSelected(newSet);
  };

  if (extraFeeTypes.length === 0) {
    return null;
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {extraFeeTypes.map((type) => {
        const isSelected = selected.has(type.id);
        return (
          <div
            key={type.id}
            className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
              isSelected
                ? "bg-blue-50 border-blue-300 shadow-sm"
                : "bg-gray-50 border-gray-200 opacity-70"
            }`}
          >
            <div className="flex items-center space-x-3">
              <input
                type="checkbox"
                name="tempExtraItems"
                value={type.id}
                checked={isSelected}
                onChange={() => toggleSelect(type.id)}
                className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
              />
              <div>
                <div
                  className={`font-medium ${
                    isSelected ? "text-gray-800" : "text-gray-600"
                  }`}
                >
                  🚌 {type.name}
                </div>
                <div className="text-sm text-gray-400">仅本期使用</div>
              </div>
            </div>
            <div className="text-right">
              <div className="relative">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-500 text-sm">
                  RM
                </span>
                <input
                  type="number"
                  name={`tempExtra_${type.id}_price`}
                  step="0.01"
                  value={prices[type.id] || ""}
                  onChange={(e) =>
                    setPrices({ ...prices, [type.id]: e.target.value })
                  }
                  className={`w-28 pl-10 pr-2 py-2 border rounded-lg text-sm text-center focus:ring-2 focus:ring-blue-500 focus:border-blue-500 ${
                    isSelected ? "border-blue-300" : "border-gray-300"
                  }`}
                  placeholder="输入金额"
                  required={isSelected}
                />
              </div>
              {isSelected && prices[type.id] && (
                <div className="text-xs text-blue-600 mt-1">
                  RM {parseFloat(prices[type.id] || "0").toFixed(2)}
                </div>
              )}
              <input
                type="hidden"
                name={`tempExtra_${type.id}_name`}
                value={type.name}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
