"use client";

import { useState } from "react";
import {
  ACADEMIC_YEAR,
  buildBillingCycleTermDates,
} from "@/lib/term-utils";

interface TermFormProps {
  defaultTerm1Date?: string;
}

export function TermForm({ defaultTerm1Date = "2025-12-29" }: TermFormProps) {
  const [term1Date, setTerm1Date] = useState(defaultTerm1Date);
  const [previewTerms, setPreviewTerms] = useState<
    ReturnType<typeof buildBillingCycleTermDates>
  >([]);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const generatePreview = (startDate: string) => {
    if (!startDate) {
      setPreviewTerms([]);
      return;
    }
    const term1Start = new Date(startDate + "T12:00:00");
    setPreviewTerms(buildBillingCycleTermDates(term1Start));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term1Date) {
      alert("请选择第1期起始日期");
      return;
    }

    try {
      setIsSubmitting(true);

      const configResponse = await fetch("/api/term-config", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: `year=${ACADEMIC_YEAR}&term1Date=${term1Date}`,
      });

      if (!configResponse.ok) throw new Error("保存第1期配置失败");

      window.location.reload();
    } catch (error) {
      console.error("保存失败:", error);
      alert("操作失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
          <input
            type="text"
            value="2026 学年"
            readOnly
            className="input-modern w-full bg-gray-50 text-gray-600"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            第1期起始日期
          </label>
          <input
            type="date"
            value={term1Date}
            onChange={(e) => {
              setTerm1Date(e.target.value);
              generatePreview(e.target.value);
            }}
            className="input-modern w-full"
            required
          />
          <p className="text-xs text-gray-500 mt-1">通常为 12/29（2025-12-29）</p>
        </div>
        <button
          type="submit"
          className={`btn-modern w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium ${
            isSubmitting ? "opacity-50 cursor-not-allowed" : ""
          }`}
          disabled={isSubmitting}
          onFocus={() => previewTerms.length === 0 && generatePreview(term1Date)}
        >
          {isSubmitting ? "保存中..." : "🎯 保存并生成 13 期"}
        </button>
      </form>

      {previewTerms.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-700">预览（第1–13期）</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {previewTerms.map((term) => (
                <div
                  key={term.period}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">第{term.period}期</span>
                  <span className="text-gray-600">
                    {term.startDate.toLocaleDateString("zh-CN")} -{" "}
                    {term.endDate.toLocaleDateString("zh-CN")}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
