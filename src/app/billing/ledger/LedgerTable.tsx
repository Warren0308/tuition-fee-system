"use client";

import { useEffect, useState, useMemo, useRef } from "react";
import Link from "next/link";

interface TermInfo { period: number; year: number; termIndex: number; }
interface ItemDetail { name: string; amount: number; paid: boolean; paidAmount: number; }
interface TermData { shouldPay: number; paid: number; paidAt: string | null; forceClosed: boolean; items: ItemDetail[]; }
interface StudentRow { id: string; name: string; grade: string; gradeOrder: number; terms: Record<number, TermData>; }
interface FilterOption { id: number; name: string; }
interface LedgerFilters { courses: FilterOption[]; extraFeeTypes: FilterOption[]; }
interface LedgerData { terms: TermInfo[]; students: StudentRow[]; filters: LedgerFilters; }

function fmt(cents: number) { return (cents / 100).toFixed(0); }
function fmtRM(cents: number) { return `RM ${(cents / 100).toFixed(2)}`; }

export function LedgerTable({ compact = false }: { compact?: boolean }) {
  // 初始加载状态（第一次）
  const [initLoading, setInitLoading] = useState(true);
  // 筛选加载状态（换选时不清空界面）
  const [filterLoading, setFilterLoading] = useState(false);
  const [error, setError] = useState("");

  // filter options 单独存放，一旦初始加载成功后不再改变
  const [filterOptions, setFilterOptions] = useState<LedgerFilters>({ courses: [], extraFeeTypes: [] });
  // 当前学期列表（始终来自全量加载）
  const [terms, setTerms] = useState<TermInfo[]>([]);
  // 当前筛选后的学生数据
  const [students, setStudents] = useState<StudentRow[]>([]);

  const [filterType, setFilterType] = useState<"all" | "course" | "extraFee">("all");
  const [selectedId, setSelectedId] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [tooltip, setTooltip] = useState<{ x: number; y: number; content: TermData; period: number; studentName: string } | null>(null);

  // 用 ref 追踪是否已经初始化过 filterOptions
  const filterOptionsLoaded = useRef(false);

  const doFetch = async (courseId?: string, extraFeeId?: string, isInit = false) => {
    if (isInit) setInitLoading(true);
    else setFilterLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (courseId) params.set("course", courseId);
      if (extraFeeId) params.set("extraFee", extraFeeId);
      const res = await fetch(`/api/billing/ledger?${params}`);
      if (!res.ok) throw new Error("加载失败");
      const json: LedgerData = await res.json();

      setStudents(json.students);
      setTerms(json.terms);

      // filter options 只从全量加载时设置，之后不变
      if (!filterOptionsLoaded.current) {
        setFilterOptions(json.filters);
        filterOptionsLoaded.current = true;
      }
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      if (isInit) setInitLoading(false);
      else setFilterLoading(false);
    }
  };

  useEffect(() => { doFetch(undefined, undefined, true); }, []);

  const handleFilterChange = (type: "all" | "course" | "extraFee", id: string) => {
    setFilterType(type);
    setSelectedId(id);
    setGradeFilter("all");
    setSearchName("");
    if (type === "all") doFetch();
    else if (type === "course") doFetch(id, undefined);
    else doFetch(undefined, id);
  };

  const grades = useMemo(() => {
    const set = new Set(students.map((s) => s.grade));
    return Array.from(set).sort();
  }, [students]);

  const filtered = useMemo(() => {
    let list = students;
    if (gradeFilter !== "all") list = list.filter((s) => s.grade === gradeFilter);
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [students, gradeFilter, searchName]);

  const termTotals = useMemo(() => {
    const totals: Record<number, { shouldPay: number; paid: number }> = {};
    for (const term of terms) totals[term.period] = { shouldPay: 0, paid: 0 };
    for (const student of filtered) {
      for (const term of terms) {
        const td = student.terms[term.period];
        if (td && !td.forceClosed) {
          totals[term.period].shouldPay += td.shouldPay;
          totals[term.period].paid += td.paid;
        }
      }
    }
    return totals;
  }, [filtered, terms]);

  const filterLabel =
    filterType === "all" ? "全部"
    : filterType === "course" ? filterOptions.courses.find((c) => String(c.id) === selectedId)?.name || "课程"
    : filterOptions.extraFeeTypes.find((f) => String(f.id) === selectedId)?.name || "费用";

  // 初始加载中
  if (initLoading) {
    return (
      <div className={`${compact ? "py-8" : "card-modern p-12"} text-center`}>
        <div className="animate-spin text-3xl mb-3">⏳</div>
        <p className="text-gray-500 text-sm">加载台账数据中...</p>
      </div>
    );
  }

  if (error && students.length === 0) {
    return (
      <div className={`${compact ? "py-8" : "card-modern p-12"} text-center`}>
        <div className="text-3xl mb-3">❌</div>
        <p className="text-red-600 text-sm">{error}</p>
        <button onClick={() => doFetch(undefined, undefined, true)} className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm">重试</button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {/* ── 筛选栏（始终显示）── */}
      <div className={compact ? "flex flex-wrap items-end gap-3" : "card-modern p-4"}>
        <div className={compact ? "flex flex-wrap items-end gap-3 w-full" : "flex flex-wrap items-end gap-3"}>
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">查看项目</label>
            <select
              value={filterType === "all" ? "all" : `${filterType}_${selectedId}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") handleFilterChange("all", "");
                else {
                  const [type, ...rest] = v.split("_");
                  handleFilterChange(type as "course" | "extraFee", rest.join("_"));
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              disabled={filterLoading}
            >
              <option value="all">全部课程 + 费用</option>
              {filterOptions.courses.length > 0 && (
                <optgroup label="── 课程 ──">
                  {filterOptions.courses.map((c) => (
                    <option key={`c_${c.id}`} value={`course_${c.id}`}>{c.name}</option>
                  ))}
                </optgroup>
              )}
              {filterOptions.extraFeeTypes.length > 0 && (
                <optgroup label="── 额外费用 ──">
                  {filterOptions.extraFeeTypes.map((f) => (
                    <option key={`e_${f.id}`} value={`extraFee_${f.id}`}>{f.name}</option>
                  ))}
                </optgroup>
              )}
            </select>
          </div>

          {grades.length > 0 && (
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">年级</label>
              <select
                value={gradeFilter}
                onChange={(e) => setGradeFilter(e.target.value)}
                className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
              >
                <option value="all">全部年级</option>
                {grades.map((g) => <option key={g} value={g}>{g}</option>)}
              </select>
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">搜索</label>
            <input
              type="text"
              placeholder="学生姓名..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-32"
            />
          </div>

          <div className="ml-auto text-right">
            {filterLoading ? (
              <span className="text-xs text-gray-400 animate-pulse">加载中...</span>
            ) : (
              <div className="text-sm font-medium text-gray-700">
                {filterLabel} · {filtered.length} 名学生
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── 图例 ── */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-500 px-1">
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />已付清</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" />部分缴费</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />未缴</span>
        <span className="flex items-center gap-1"><span className="w-3 h-3 rounded bg-blue-50 border border-blue-200 inline-block" /><span className="text-blue-600 font-medium">清</span> 强制清算</span>
      </div>

      {/* ── 无数据（保留筛选栏可操作） ── */}
      {!filterLoading && filtered.length === 0 && (
        <div className={`${compact ? "py-8" : "card-modern p-10"} text-center`}>
          <div className="text-4xl mb-3">📭</div>
          <p className="text-gray-500 text-sm">
            {filterType !== "all"
              ? `「${filterLabel}」暂无缴费记录（未与学生绑定或尚未结算）`
              : "暂无数据"}
          </p>
          {filterType !== "all" && (
            <button
              onClick={() => handleFilterChange("all", "")}
              className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm hover:bg-blue-700"
            >
              ← 返回显示全部
            </button>
          )}
        </div>
      )}

      {/* ── 筛选加载中占位 ── */}
      {filterLoading && (
        <div className={`${compact ? "py-6" : "card-modern p-8"} text-center`}>
          <div className="animate-spin text-2xl mb-2">⏳</div>
          <p className="text-gray-400 text-xs">筛选中...</p>
        </div>
      )}

      {/* ── 表格 ── */}
      {!filterLoading && filtered.length > 0 && (
        <div
          className={compact ? "overflow-hidden rounded-xl border border-gray-200" : "card-modern overflow-hidden"}
          onMouseLeave={() => setTooltip(null)}
        >
          <div className="overflow-x-auto">
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50">
                  <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 w-8">#</th>
                  <th className="sticky left-8 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 min-w-[90px]">学生</th>
                  <th className="sticky left-[122px] z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 min-w-[58px]">年级</th>
                  {terms.map((t) => (
                    <th key={t.period} className="border-b border-r border-gray-200 px-1 py-2 text-center font-semibold text-gray-700 min-w-[68px] whitespace-nowrap text-xs">
                      第{t.period}期
                    </th>
                  ))}
                  <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[64px] bg-indigo-50 text-xs">应缴</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[64px] bg-indigo-50 text-xs">实缴</th>
                  <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[64px] bg-indigo-50 text-xs">差额</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((student, idx) => {
                  let totalShould = 0, totalPaid = 0;
                  for (const term of terms) {
                    const td = student.terms[term.period];
                    if (td && !td.forceClosed) { totalShould += td.shouldPay; totalPaid += td.paid; }
                  }
                  const diff = totalPaid - totalShould;
                  return (
                    <tr key={student.id} className="hover:bg-blue-50/20 transition-colors">
                      <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-2 py-1.5 text-gray-400 text-xs">{idx + 1}</td>
                      <td className="sticky left-8 z-10 bg-white border-b border-r border-gray-100 px-3 py-1.5 text-xs font-medium">
                        <Link href={`/students/${student.id}`} className="text-blue-600 hover:underline whitespace-nowrap">{student.name}</Link>
                      </td>
                      <td className="sticky left-[122px] z-10 bg-white border-b border-r border-gray-100 px-2 py-1.5 text-gray-500 text-[11px] whitespace-nowrap">{student.grade}</td>
                      {terms.map((term) => {
                        const td = student.terms[term.period];
                        return (
                          <td
                            key={term.period}
                            className={`border-b border-r border-gray-100 px-1 py-1.5 text-center text-xs cursor-default ${cellBg(td)}`}
                            onMouseEnter={(e) => {
                              if (!td) return;
                              const rect = (e.target as HTMLElement).getBoundingClientRect();
                              setTooltip({ x: rect.left + rect.width / 2, y: rect.bottom + 4, content: td, period: term.period, studentName: student.name });
                            }}
                            onMouseLeave={() => setTooltip(null)}
                          >
                            {renderCell(td)}
                          </td>
                        );
                      })}
                      <td className="border-b border-gray-100 px-2 py-1.5 text-center text-xs font-medium bg-indigo-50/40">{fmt(totalShould)}</td>
                      <td className="border-b border-gray-100 px-2 py-1.5 text-center text-xs font-medium bg-indigo-50/40">{fmt(totalPaid)}</td>
                      <td className={`border-b border-gray-100 px-2 py-1.5 text-center text-xs font-bold bg-indigo-50/40 ${diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "text-gray-400"}`}>
                        {diff === 0 ? "0" : diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
              <tfoot>
                <tr className="bg-gray-50 font-semibold text-xs">
                  <td className="sticky left-0 z-10 bg-gray-50 border-t-2 border-gray-300 px-2 py-2" colSpan={3}>合计 ({filtered.length}人)</td>
                  {terms.map((term) => {
                    const t = termTotals[term.period];
                    return (
                      <td key={term.period} className="border-t-2 border-gray-300 px-1 py-2 text-center text-xs">
                        <div className="text-green-700">{t ? fmt(t.paid) : "-"}</div>
                        <div className="text-gray-400 text-[10px]">/{t ? fmt(t.shouldPay) : "-"}</div>
                      </td>
                    );
                  })}
                  {(() => {
                    let gs = 0, gp = 0;
                    for (const t of Object.values(termTotals)) { gs += t.shouldPay; gp += t.paid; }
                    const gd = gp - gs;
                    return (
                      <>
                        <td className="border-t-2 border-gray-300 px-2 py-2 text-center text-xs bg-indigo-50">{fmt(gs)}</td>
                        <td className="border-t-2 border-gray-300 px-2 py-2 text-center text-xs bg-indigo-50">{fmt(gp)}</td>
                        <td className={`border-t-2 border-gray-300 px-2 py-2 text-center text-xs bg-indigo-50 font-bold ${gd < 0 ? "text-red-600" : gd > 0 ? "text-green-600" : "text-gray-400"}`}>
                          {gd === 0 ? "0" : gd > 0 ? `+${fmt(gd)}` : fmt(gd)}
                        </td>
                      </>
                    );
                  })()}
                </tr>
              </tfoot>
            </table>
          </div>

          {tooltip && (
            <div
              className="fixed z-50 bg-white border border-gray-200 rounded-xl shadow-2xl p-3 text-xs max-w-[260px] pointer-events-none"
              style={{ left: Math.min(tooltip.x, (typeof window !== "undefined" ? window.innerWidth : 400) - 270), top: tooltip.y }}
            >
              <div className="font-semibold text-gray-800 mb-1.5 border-b pb-1">
                {tooltip.studentName} · 第{tooltip.period}期
                {tooltip.content.forceClosed && <span className="ml-1 text-blue-500 text-[10px]">[强制清算]</span>}
              </div>
              {tooltip.content.items.map((item, i) => (
                <div key={i} className="flex justify-between gap-3 py-0.5">
                  <span className="text-gray-600">{item.name}</span>
                  <span>{item.paid ? <span className="text-green-600">{fmtRM(item.paidAmount)}</span> : <span className="text-red-500">未付 {fmtRM(item.amount)}</span>}</span>
                </div>
              ))}
              <div className="border-t mt-1.5 pt-1.5 space-y-0.5">
                <div className="flex justify-between"><span>应缴</span><span>{fmtRM(tooltip.content.shouldPay)}</span></div>
                <div className="flex justify-between font-semibold">
                  <span>实缴</span>
                  <span className={tooltip.content.paid >= tooltip.content.shouldPay ? "text-green-600" : "text-red-600"}>{fmtRM(tooltip.content.paid)}</span>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function cellBg(td: TermData | undefined): string {
  if (!td) return "bg-gray-50/20";
  if (td.forceClosed) return td.paid > 0 ? "bg-green-50" : "bg-blue-50";
  if (td.shouldPay > 0 && td.paid >= td.shouldPay) return "bg-green-50";
  if (td.paid > 0 && td.paid < td.shouldPay) return "bg-yellow-50";
  if (td.shouldPay > 0 && td.paid === 0) return "bg-red-50";
  return "bg-gray-50/20";
}

function renderCell(td: TermData | undefined) {
  if (!td) return <span className="text-gray-200">-</span>;
  if (td.forceClosed) {
    if (td.paid > 0) return <span className="text-green-700 font-medium">{fmt(td.paid)}<span className="text-[9px] text-blue-500 ml-0.5 align-super">清</span></span>;
    return <span className="text-blue-400 text-[10px] font-medium">清算</span>;
  }
  if (td.paid >= td.shouldPay && td.shouldPay > 0) return <span className="text-green-700 font-medium">{fmt(td.paid)}</span>;
  if (td.paid > 0 && td.paid < td.shouldPay) return <span className="text-yellow-700 font-medium">{fmt(td.paid)}<span className="text-[10px] text-gray-400">/{fmt(td.shouldPay)}</span></span>;
  if (td.shouldPay > 0) return <span className="text-red-600 font-medium">{fmt(td.shouldPay)}</span>;
  return <span className="text-gray-200">-</span>;
}
