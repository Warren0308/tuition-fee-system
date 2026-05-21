"use client";

import React, { useState } from "react";
import Link from "next/link";
import { formatTermLabelFull } from "@/lib/term-utils";

interface Grade { id: number; name: string; orderIndex: number }
interface School { id: number; name: string }
interface TermOpt { year: number; termIndex: number; period: number }

interface PreviewItem {
  studentId: string;
  name: string;
  gradeName: string | null;
  schoolName: string | null;
  className: string | null;
  courseItems: Array<{ name: string; price: number; courseId: number; enrollmentId: number }>;
  extraItems: Array<{ name: string; price: number; extraFeeTypeId: number }>;
  expectedTotal: number;
  hasBill: boolean;
  existingTotal: number;
  existingItemCount: number;
}

interface BatchResult {
  total: number;
  created: number;
  skipped: number;
  empty: number;
  errors: Array<{ studentId: string; name: string; error: string }>;
  payments: Array<{ studentId: string; paymentId: string; amount: number }>;
}

const formatRM = (cents: number) => `RM ${(cents / 100).toFixed(2)}`;

export function BatchBillingClient({
  grades,
  schools,
  terms,
  initialYear,
  initialTermIndex,
}: {
  grades: Grade[];
  schools: School[];
  terms: TermOpt[];
  initialYear: number;
  initialTermIndex: number;
}) {
  const [year, setYear] = useState(initialYear);
  const [termIndex, setTermIndex] = useState(initialTermIndex);
  const [gradeId, setGradeId] = useState<string>("");
  const [schoolId, setSchoolId] = useState<string>("");
  const [className, setClassName] = useState<string>("");
  const [skipExisting, setSkipExisting] = useState(true);

  const [step, setStep] = useState<"filter" | "preview" | "result">("filter");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [preview, setPreview] = useState<{
    students: PreviewItem[];
    total: number;
    withBill: number;
    withoutBill: number;
  } | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [result, setResult] = useState<BatchResult | null>(null);

  const termLabelTerms = terms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));

  const uniqueTerms = Array.from(
    new Set(terms.map((t) => `${t.year}-${t.termIndex}`))
  ).map((s) => {
    const [y, t] = s.split("-").map(Number);
    return { year: y, termIndex: t };
  });

  async function handlePreview() {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/batch/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          termIndex,
          gradeId: gradeId || null,
          schoolId: schoolId || null,
          className: className || null,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "预览失败");
      }
      setPreview({
        students: data.students,
        total: data.total,
        withBill: data.withBill,
        withoutBill: data.withoutBill,
      });
      // 默认全选可结算的（未有账单的）
      const ids = new Set<string>();
      for (const s of data.students as PreviewItem[]) {
        if (!s.hasBill && s.expectedTotal > 0) ids.add(s.studentId);
      }
      setSelectedIds(ids);
      setStep("preview");
    } catch (e: any) {
      setError(e.message || "网络错误");
    } finally {
      setLoading(false);
    }
  }

  async function handleConfirm() {
    if (selectedIds.size === 0) {
      setError("请至少选择一位学生");
      return;
    }
    if (!confirm(`确认要为 ${selectedIds.size} 位学生批量生成账单吗？\n\n${skipExisting ? "（已有账单的学生将被跳过）" : "（已有账单的学生将被覆盖）"}`)) {
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/billing/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          year,
          termIndex,
          studentIds: Array.from(selectedIds),
          skipExisting,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error || "批量结算失败");
      }
      setResult(data);
      setStep("result");
    } catch (e: any) {
      setError(e.message || "网络错误");
    } finally {
      setLoading(false);
    }
  }

  function toggleStudent(id: string) {
    const ns = new Set(selectedIds);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setSelectedIds(ns);
  }

  function selectAll() {
    if (!preview) return;
    const ids = new Set<string>();
    for (const s of preview.students) {
      if (s.expectedTotal > 0) ids.add(s.studentId);
    }
    setSelectedIds(ids);
  }

  function selectNone() {
    setSelectedIds(new Set());
  }

  function reset() {
    setStep("filter");
    setPreview(null);
    setSelectedIds(new Set());
    setResult(null);
    setError(null);
  }

  // ============ STEP 1: 筛选 ============
  if (step === "filter") {
    return (
      <div className="card-modern p-6 space-y-6">
        <div className="flex items-center gap-2 text-blue-600 font-semibold">
          <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">1</span>
          <span>选择学期与筛选条件</span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学期 *</label>
            <select
              value={`${year}-${termIndex}`}
              onChange={(e) => {
                const [y, t] = e.target.value.split("-").map(Number);
                setYear(y);
                setTermIndex(t);
              }}
              className="input-modern w-full"
            >
              {uniqueTerms.map((t) => (
                <option key={`${t.year}-${t.termIndex}`} value={`${t.year}-${t.termIndex}`}>
                  {formatTermLabelFull(t.year, t.termIndex, termLabelTerms)}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">年级（可选）</label>
            <select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className="input-modern w-full"
            >
              <option value="">全部年级</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">学校（可选）</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="input-modern w-full"
            >
              <option value="">全部学校</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">班级（可选）</label>
            <input
              type="text"
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              placeholder="如：5甲"
              className="input-modern w-full"
            />
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-gray-700">
          <input
            type="checkbox"
            checked={skipExisting}
            onChange={(e) => setSkipExisting(e.target.checked)}
            className="w-4 h-4"
          />
          跳过已生成账单的学生（推荐）
        </label>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            ❌ {error}
          </div>
        )}

        <button
          onClick={handlePreview}
          disabled={loading}
          className="w-full btn-modern bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold disabled:opacity-50"
        >
          {loading ? "查询中..." : "🔍 查询学生 →"}
        </button>
      </div>
    );
  }

  // ============ STEP 2: 预览 ============
  if (step === "preview" && preview) {
    const selectedSum = preview.students
      .filter((s) => selectedIds.has(s.studentId))
      .reduce((sum, s) => sum + s.expectedTotal, 0);

    return (
      <div className="space-y-4">
        <div className="card-modern p-6">
          <div className="flex items-center gap-2 text-blue-600 font-semibold mb-4">
            <span className="w-7 h-7 rounded-full bg-blue-600 text-white text-sm flex items-center justify-center">2</span>
            <span>预览与选择 - {formatTermLabelFull(year, termIndex, termLabelTerms)}</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="符合条件" value={preview.total} color="text-blue-600" />
            <Stat label="未生成账单" value={preview.withoutBill} color="text-amber-600" />
            <Stat label="已有账单" value={preview.withBill} color="text-emerald-600" />
            <Stat label="已选择" value={selectedIds.size} color="text-purple-600" />
          </div>

          <div className="flex items-center justify-between flex-wrap gap-2">
            <div className="flex gap-2">
              <button
                onClick={selectAll}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                全选可用
              </button>
              <button
                onClick={selectNone}
                className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded text-sm"
              >
                全不选
              </button>
            </div>
            <div className="text-sm">
              <span className="text-gray-600">已选金额合计: </span>
              <span className="font-bold text-blue-600">{formatRM(selectedSum)}</span>
            </div>
          </div>
        </div>

        <div className="card-modern overflow-hidden">
          <div className="max-h-[500px] overflow-y-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-gray-50 border-b">
                <tr>
                  <th className="px-3 py-2 text-left w-10"></th>
                  <th className="px-3 py-2 text-left">学生</th>
                  <th className="px-3 py-2 text-left hidden md:table-cell">年级 / 班级</th>
                  <th className="px-3 py-2 text-left hidden lg:table-cell">课程 / 额外费用</th>
                  <th className="px-3 py-2 text-right">金额</th>
                  <th className="px-3 py-2 text-center w-24">状态</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {preview.students.map((s) => {
                  const isSelected = selectedIds.has(s.studentId);
                  const noFees = s.expectedTotal === 0;
                  return (
                    <tr
                      key={s.studentId}
                      className={`${isSelected ? 'bg-blue-50' : ''} ${noFees ? 'opacity-60' : 'hover:bg-gray-50'}`}
                    >
                      <td className="px-3 py-2">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          disabled={noFees}
                          onChange={() => toggleStudent(s.studentId)}
                          className="w-4 h-4"
                        />
                      </td>
                      <td className="px-3 py-2 font-medium text-gray-800">{s.name}</td>
                      <td className="px-3 py-2 text-gray-600 hidden md:table-cell">
                        {s.gradeName || "-"}
                        {s.className && <span className="text-gray-400"> · {s.className}</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-gray-600 hidden lg:table-cell">
                        {s.courseItems.length === 0 && s.extraItems.length === 0 ? (
                          <span className="text-amber-600">⚠️ 本期无选课</span>
                        ) : (
                          <>
                            {s.courseItems.length > 0 && (
                              <div>📚 {s.courseItems.map((c) => c.name).join("、")}</div>
                            )}
                            {s.extraItems.length > 0 && (
                              <div className="text-orange-600">🍽️ {s.extraItems.map((c) => c.name).join("、")}</div>
                            )}
                          </>
                        )}
                      </td>
                      <td className="px-3 py-2 text-right font-semibold">
                        {noFees ? <span className="text-gray-400">-</span> : formatRM(s.expectedTotal)}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {s.hasBill ? (
                          <span className="inline-block px-2 py-0.5 bg-emerald-100 text-emerald-700 text-xs rounded">
                            已结算
                          </span>
                        ) : noFees ? (
                          <span className="inline-block px-2 py-0.5 bg-gray-100 text-gray-500 text-xs rounded">
                            无费用
                          </span>
                        ) : (
                          <span className="inline-block px-2 py-0.5 bg-amber-100 text-amber-700 text-xs rounded">
                            待结算
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {preview.students.length === 0 && (
                  <tr>
                    <td colSpan={6} className="text-center py-8 text-gray-500">
                      没有符合条件的学生
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            ❌ {error}
          </div>
        )}

        <div className="flex gap-3 sticky bottom-4">
          <button
            onClick={reset}
            disabled={loading}
            className="px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 disabled:opacity-50"
          >
            ← 返回修改筛选
          </button>
          <button
            onClick={handleConfirm}
            disabled={loading || selectedIds.size === 0}
            className="flex-1 btn-modern bg-emerald-600 hover:bg-emerald-700 text-white py-3 font-semibold disabled:opacity-50"
          >
            {loading
              ? "生成中..."
              : `✓ 为 ${selectedIds.size} 位学生生成账单（合计 ${formatRM(selectedSum)}）`}
          </button>
        </div>
      </div>
    );
  }

  // ============ STEP 3: 结果 ============
  if (step === "result" && result) {
    return (
      <div className="space-y-4">
        <div className="card-modern p-6">
          <div className="flex items-center gap-2 text-emerald-600 font-semibold mb-4">
            <span className="w-7 h-7 rounded-full bg-emerald-600 text-white text-sm flex items-center justify-center">✓</span>
            <span>批量结算完成</span>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Stat label="处理总数" value={result.total} color="text-blue-600" />
            <Stat label="成功生成" value={result.created} color="text-emerald-600" />
            <Stat label="跳过" value={result.skipped} color="text-gray-600" />
            <Stat label="失败" value={result.errors.length} color="text-red-600" />
          </div>

          {result.empty > 0 && (
            <div className="bg-amber-50 border border-amber-200 text-amber-800 p-3 rounded text-sm mb-3">
              ⚠️ {result.empty} 位学生本期无可结算项目（无选课、无额外费用），已自动跳过。
            </div>
          )}

          {result.errors.length > 0 && (
            <div className="bg-red-50 border border-red-200 p-3 rounded text-sm space-y-1">
              <div className="font-semibold text-red-700 mb-1">失败的学生：</div>
              {result.errors.map((err) => (
                <div key={err.studentId} className="text-red-700">
                  • {err.name}: {err.error}
                </div>
              ))}
            </div>
          )}
        </div>

        {result.payments.length > 0 && (
          <div className="card-modern p-6">
            <h3 className="font-semibold text-gray-800 mb-3">
              成功生成的账单（{result.payments.length}）
            </h3>
            <div className="max-h-96 overflow-y-auto space-y-1">
              {result.payments.map((p) => (
                <div key={p.paymentId} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded hover:bg-gray-100">
                  <Link
                    href={`/billing/receipt/${p.paymentId}`}
                    className="text-blue-600 hover:underline text-sm"
                  >
                    查看收据 →
                  </Link>
                  <div className="font-semibold text-sm">{formatRM(p.amount)}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex gap-3">
          <button
            onClick={reset}
            className="flex-1 btn-modern bg-blue-600 hover:bg-blue-700 text-white py-3 font-semibold"
          >
            🔄 继续批量结算
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-3 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
          >
            返回工作台
          </Link>
        </div>
      </div>
    );
  }

  return null;
}

function Stat({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
