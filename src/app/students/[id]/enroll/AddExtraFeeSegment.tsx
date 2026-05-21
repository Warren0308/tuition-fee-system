"use client";

import { useState } from "react";

interface FeeType {
  id: number;
  name: string;
  defaultPrice: number;
}

interface TermOption {
  id: number;
  period: number;
  label: string;
}

interface Props {
  studentId: string;
  feeTypes: FeeType[];
  terms: TermOption[];
}

export function AddExtraFeeSegment({ studentId, feeTypes, terms }: Props) {
  const [open, setOpen] = useState(false);
  const [feeTypeId, setFeeTypeId] = useState(feeTypes[0]?.id ? String(feeTypes[0].id) : "");
  const [startTermId, setStartTermId] = useState(terms[0] ? String(terms[0].id) : "");
  const [endTermId, setEndTermId] = useState("");
  const [sameAsStart, setSameAsStart] = useState(true);

  if (feeTypes.length === 0 || terms.length === 0) return null;

  const selectedType = feeTypes.find((f) => String(f.id) === feeTypeId);

  return (
    <div className="mt-4 border-t border-gray-200 pt-4">
      {!open ? (
        <button
          type="button"
          onClick={() => setOpen(true)}
          className="btn-modern bg-orange-100 text-orange-800 px-4 py-2 text-sm hover:bg-orange-200"
        >
          ➕ 新增收费分段（某学期不收时可分开登记）
        </button>
      ) : (
        <form
          action={`/api/students/${studentId}/extra-fees`}
          method="post"
          className="bg-orange-50/80 border border-orange-200 rounded-lg p-4 space-y-4"
        >
          <p className="text-sm text-orange-900">
            例如：第2期有膳食、第3期没有、第4期又有 — 请分两段登记，不要一条记录横跨第2–4期。
          </p>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">费用类型</label>
              <select
                name="extraFeeTypeId"
                value={feeTypeId}
                onChange={(e) => setFeeTypeId(e.target.value)}
                className="input-modern w-full text-sm"
                required
              >
                {feeTypes.map((f) => (
                  <option key={f.id} value={f.id}>
                    {f.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">开始学期</label>
              <select
                name="startTermId"
                value={startTermId}
                onChange={(e) => setStartTermId(e.target.value)}
                className="input-modern w-full text-sm"
                required
              >
                {terms.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">结束学期</label>
              <label className="flex items-center gap-2 text-xs text-gray-600 mb-1">
                <input
                  type="checkbox"
                  checked={sameAsStart}
                  onChange={(e) => setSameAsStart(e.target.checked)}
                />
                仅该一期
              </label>
              {!sameAsStart ? (
                <select
                  name="endTermId"
                  value={endTermId}
                  onChange={(e) => setEndTermId(e.target.value)}
                  className="input-modern w-full text-sm"
                >
                  <option value="">持续（不设结束）</option>
                  {terms
                    .slice(terms.findIndex((t) => String(t.id) === startTermId))
                    .map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.label}
                      </option>
                    ))}
                </select>
              ) : (
                <input type="hidden" name="endTermId" value={startTermId} />
              )}
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">金额 (RM)</label>
              <input
                type="number"
                step="0.01"
                name="price"
                defaultValue={selectedType ? (selectedType.defaultPrice / 100).toFixed(2) : "0"}
                className="input-modern w-full text-sm"
                required
              />
            </div>
          </div>
          <div className="flex gap-2">
            <button
              type="submit"
              className="btn-modern bg-orange-600 text-white px-4 py-2 text-sm hover:bg-orange-700"
            >
              保存分段
            </button>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="btn-modern bg-gray-200 text-gray-700 px-4 py-2 text-sm"
            >
              取消
            </button>
          </div>
        </form>
      )}
    </div>
  );
}
