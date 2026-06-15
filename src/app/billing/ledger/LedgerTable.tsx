"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import Link from "next/link";

interface TermInfo {
  period: number;
  year: number;
  termIndex: number;
}

interface ItemDetail {
  name: string;
  amount: number;
  paid: boolean;
  paidAmount: number;
}

interface TermData {
  shouldPay: number;
  paid: number;
  paidAt: string | null;
  forceClosed: boolean;
  items: ItemDetail[];
}

interface StudentRow {
  id: string;
  name: string;
  grade: string;
  gradeOrder: number;
  terms: Record<number, TermData>;
}

interface Filters {
  courses: { id: number; name: string }[];
  extraFeeTypes: { id: number; name: string }[];
}

interface LedgerData {
  terms: TermInfo[];
  students: StudentRow[];
  filters: Filters;
}

function fmt(cents: number) {
  return (cents / 100).toFixed(0);
}

function fmtRM(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

export function LedgerTable() {
  const [data, setData] = useState<LedgerData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filterType, setFilterType] = useState<"all" | "course" | "extraFee">("all");
  const [selectedId, setSelectedId] = useState("");
  const [gradeFilter, setGradeFilter] = useState("all");
  const [searchName, setSearchName] = useState("");
  const [tooltip, setTooltip] = useState<{
    x: number;
    y: number;
    content: TermData;
    period: number;
    studentName: string;
  } | null>(null);

  const fetchData = useCallback(async (courseId?: string, extraFeeId?: string) => {
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams();
      if (courseId) params.set("course", courseId);
      if (extraFeeId) params.set("extraFee", extraFeeId);
      const res = await fetch(`/api/billing/ledger?${params}`);
      if (!res.ok) throw new Error("加载失败");
      const json = await res.json();
      setData(json);
    } catch (e: any) {
      setError(e.message || "加载失败");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleFilterChange = (type: "all" | "course" | "extraFee", id: string) => {
    setFilterType(type);
    setSelectedId(id);
    if (type === "all") fetchData();
    else if (type === "course") fetchData(id, undefined);
    else fetchData(undefined, id);
  };

  const grades = useMemo(() => {
    if (!data) return [];
    const set = new Set(data.students.map((s) => s.grade));
    return Array.from(set).sort();
  }, [data]);

  const filtered = useMemo(() => {
    if (!data) return [];
    let list = data.students;
    if (gradeFilter !== "all") {
      list = list.filter((s) => s.grade === gradeFilter);
    }
    if (searchName.trim()) {
      const q = searchName.trim().toLowerCase();
      list = list.filter((s) => s.name.toLowerCase().includes(q));
    }
    return list;
  }, [data, gradeFilter, searchName]);

  const termTotals = useMemo(() => {
    if (!data) return {};
    const totals: Record<number, { shouldPay: number; paid: number }> = {};
    for (const term of data.terms) {
      totals[term.period] = { shouldPay: 0, paid: 0 };
    }
    for (const student of filtered) {
      for (const term of data.terms) {
        const td = student.terms[term.period];
        if (td && !td.forceClosed) {
          totals[term.period].shouldPay += td.shouldPay;
          totals[term.period].paid += td.paid;
        }
      }
    }
    return totals;
  }, [data, filtered]);

  if (loading) {
    return (
      <div className="card-modern p-12 text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-600">加载台账数据中...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="card-modern p-12 text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-red-600">{error}</p>
        <button
          onClick={() => fetchData()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    );
  }

  if (!data || data.students.length === 0) {
    return (
      <div className="card-modern p-12 text-center">
        <div className="text-4xl mb-4">📭</div>
        <p className="text-gray-600">暂无缴费数据</p>
      </div>
    );
  }

  const filterLabel =
    filterType === "all"
      ? "全部"
      : filterType === "course"
        ? data.filters.courses.find((c) => String(c.id) === selectedId)?.name || ""
        : data.filters.extraFeeTypes.find((f) => String(f.id) === selectedId)?.name || "";

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="card-modern p-4">
        <div className="flex flex-wrap items-end gap-3">
          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              查看项目
            </label>
            <select
              value={filterType === "all" ? "all" : `${filterType}_${selectedId}`}
              onChange={(e) => {
                const v = e.target.value;
                if (v === "all") {
                  handleFilterChange("all", "");
                } else {
                  const [type, id] = v.split("_", 2);
                  handleFilterChange(type as "course" | "extraFee", id);
                }
              }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部课程 + 费用</option>
              <optgroup label="── 课程 ──">
                {data.filters.courses.map((c) => (
                  <option key={`c_${c.id}`} value={`course_${c.id}`}>
                    {c.name}
                  </option>
                ))}
              </optgroup>
              <optgroup label="── 额外费用 ──">
                {data.filters.extraFeeTypes.map((f) => (
                  <option key={`e_${f.id}`} value={`extraFee_${f.id}`}>
                    {f.name}
                  </option>
                ))}
              </optgroup>
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              年级
            </label>
            <select
              value={gradeFilter}
              onChange={(e) => setGradeFilter(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500"
            >
              <option value="all">全部年级</option>
              {grades.map((g) => (
                <option key={g} value={g}>
                  {g}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-500 mb-1">
              搜索
            </label>
            <input
              type="text"
              placeholder="学生姓名..."
              value={searchName}
              onChange={(e) => setSearchName(e.target.value)}
              className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 w-36"
            />
          </div>

          <div className="ml-auto text-right">
            <div className="text-sm font-medium text-gray-700">
              {filterLabel} · {filtered.length} 名学生
            </div>
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="flex flex-wrap items-center gap-3 text-xs text-gray-600 px-1">
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-green-100 border border-green-300 inline-block" />
          全额付清
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-yellow-100 border border-yellow-300 inline-block" />
          部分缴费
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-red-100 border border-red-300 inline-block" />
          未缴
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-gray-50 border border-gray-200 inline-block" />
          无需缴费
        </span>
        <span className="flex items-center gap-1">
          <span className="w-3 h-3 rounded bg-blue-100 border border-blue-300 inline-block" />
          强制清算
        </span>
        <span className="text-gray-400 ml-2">鼠标悬停单元格可查看明细</span>
      </div>

      {/* Table */}
      <div
        className="card-modern overflow-hidden relative"
        onMouseLeave={() => setTooltip(null)}
      >
        <div className="overflow-x-auto">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="sticky left-0 z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 w-10">
                  #
                </th>
                <th className="sticky left-10 z-20 bg-gray-50 border-b border-r border-gray-200 px-3 py-2 text-left font-semibold text-gray-700 min-w-[100px]">
                  学生
                </th>
                <th className="sticky left-[140px] z-20 bg-gray-50 border-b border-r border-gray-200 px-2 py-2 text-left font-semibold text-gray-700 min-w-[60px]">
                  年级
                </th>
                {data.terms.map((t) => (
                  <th
                    key={t.period}
                    className="border-b border-r border-gray-200 px-1 py-2 text-center font-semibold text-gray-700 min-w-[72px] whitespace-nowrap"
                  >
                    第{t.period}期
                  </th>
                ))}
                <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[70px] bg-indigo-50">
                  应缴
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[70px] bg-indigo-50">
                  实缴
                </th>
                <th className="border-b border-gray-200 px-2 py-2 text-center font-semibold text-gray-700 min-w-[70px] bg-indigo-50">
                  差额
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((student, idx) => {
                let totalShould = 0;
                let totalPaid = 0;
                for (const term of data.terms) {
                  const td = student.terms[term.period];
                  if (td && !td.forceClosed) {
                    totalShould += td.shouldPay;
                    totalPaid += td.paid;
                  }
                }
                const diff = totalPaid - totalShould;

                return (
                  <tr
                    key={student.id}
                    className="hover:bg-blue-50/30 transition-colors"
                  >
                    <td className="sticky left-0 z-10 bg-white border-b border-r border-gray-100 px-2 py-1 text-gray-400 text-xs">
                      {idx + 1}
                    </td>
                    <td className="sticky left-10 z-10 bg-white border-b border-r border-gray-100 px-3 py-1 font-medium text-xs">
                      <Link
                        href={`/students/${student.id}`}
                        className="text-blue-600 hover:underline whitespace-nowrap"
                      >
                        {student.name}
                      </Link>
                    </td>
                    <td className="sticky left-[140px] z-10 bg-white border-b border-r border-gray-100 px-2 py-1 text-gray-500 text-xs whitespace-nowrap">
                      {student.grade}
                    </td>
                    {data.terms.map((term) => {
                      const td = student.terms[term.period];
                      return (
                        <td
                          key={term.period}
                          className={`border-b border-r border-gray-100 px-1 py-1 text-center text-xs cursor-default ${cellBg(td)}`}
                          onMouseEnter={(e) => {
                            if (!td) return;
                            const rect = (e.target as HTMLElement).getBoundingClientRect();
                            setTooltip({
                              x: rect.left + rect.width / 2,
                              y: rect.bottom + 4,
                              content: td,
                              period: term.period,
                              studentName: student.name,
                            });
                          }}
                          onMouseLeave={() => setTooltip(null)}
                        >
                          {renderCell(td)}
                        </td>
                      );
                    })}
                    <td className="border-b border-gray-100 px-2 py-1 text-center text-xs font-medium bg-indigo-50/40">
                      {fmt(totalShould)}
                    </td>
                    <td className="border-b border-gray-100 px-2 py-1 text-center text-xs font-medium bg-indigo-50/40">
                      {fmt(totalPaid)}
                    </td>
                    <td
                      className={`border-b border-gray-100 px-2 py-1 text-center text-xs font-bold bg-indigo-50/40 ${
                        diff < 0 ? "text-red-600" : diff > 0 ? "text-green-600" : "text-gray-400"
                      }`}
                    >
                      {diff === 0 ? "0" : diff > 0 ? `+${fmt(diff)}` : fmt(diff)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="bg-gray-50 font-semibold text-xs">
                <td
                  className="sticky left-0 z-10 bg-gray-50 border-t-2 border-gray-300 px-2 py-2"
                  colSpan={3}
                >
                  合计 ({filtered.length}人)
                </td>
                {data.terms.map((term) => {
                  const t = termTotals[term.period];
                  return (
                    <td
                      key={term.period}
                      className="border-t-2 border-gray-300 px-1 py-2 text-center"
                    >
                      <div className="text-green-700">{t ? fmt(t.paid) : "-"}</div>
                      <div className="text-gray-400 text-[10px]">
                        /{t ? fmt(t.shouldPay) : "-"}
                      </div>
                    </td>
                  );
                })}
                {(() => {
                  let gs = 0, gp = 0;
                  for (const t of Object.values(termTotals)) {
                    gs += t.shouldPay;
                    gp += t.paid;
                  }
                  const gd = gp - gs;
                  return (
                    <>
                      <td className="border-t-2 border-gray-300 px-2 py-2 text-center bg-indigo-50">
                        {fmt(gs)}
                      </td>
                      <td className="border-t-2 border-gray-300 px-2 py-2 text-center bg-indigo-50">
                        {fmt(gp)}
                      </td>
                      <td
                        className={`border-t-2 border-gray-300 px-2 py-2 text-center bg-indigo-50 font-bold ${
                          gd < 0 ? "text-red-600" : gd > 0 ? "text-green-600" : "text-gray-400"
                        }`}
                      >
                        {gd === 0 ? "0" : gd > 0 ? `+${fmt(gd)}` : fmt(gd)}
                      </td>
                    </>
                  );
                })()}
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Floating tooltip */}
        {tooltip && (
          <div
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-xl p-3 text-xs max-w-xs pointer-events-none"
            style={{
              left: Math.min(tooltip.x, window.innerWidth - 260),
              top: tooltip.y,
            }}
          >
            <div className="font-semibold text-gray-800 mb-1.5 border-b pb-1">
              {tooltip.studentName} · 第{tooltip.period}期
              {tooltip.content.forceClosed && (
                <span className="ml-2 text-blue-600">[已强制清算]</span>
              )}
            </div>
            {tooltip.content.items.map((item, i) => (
              <div key={i} className="flex justify-between gap-4 py-0.5">
                <span className="text-gray-600">{item.name}</span>
                <span>
                  {item.paid ? (
                    <span className="text-green-600">
                      {fmtRM(item.paidAmount)}
                      {item.paidAmount !== item.amount && (
                        <span className="text-gray-400 ml-1 line-through">{fmtRM(item.amount)}</span>
                      )}
                    </span>
                  ) : (
                    <span className="text-red-500">未付 {fmtRM(item.amount)}</span>
                  )}
                </span>
              </div>
            ))}
            <div className="border-t mt-1.5 pt-1.5 flex justify-between font-medium">
              <span>应缴</span>
              <span>{fmtRM(tooltip.content.shouldPay)}</span>
            </div>
            <div className="flex justify-between font-medium">
              <span>实缴</span>
              <span className={tooltip.content.paid >= tooltip.content.shouldPay ? "text-green-600" : "text-red-600"}>
                {fmtRM(tooltip.content.paid)}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function cellBg(td: TermData | undefined): string {
  if (!td) return "bg-gray-50/30";
  if (td.forceClosed) return "bg-blue-50";
  if (td.shouldPay > 0 && td.paid >= td.shouldPay) return "bg-green-50";
  if (td.paid > 0 && td.paid < td.shouldPay) return "bg-yellow-50";
  if (td.shouldPay > 0 && td.paid === 0) return "bg-red-50";
  return "bg-gray-50/30";
}

function renderCell(td: TermData | undefined) {
  if (!td) return <span className="text-gray-300">-</span>;
  if (td.forceClosed)
    return <span className="text-blue-500 font-medium">清算</span>;
  if (td.paid >= td.shouldPay && td.shouldPay > 0)
    return <span className="text-green-700 font-medium">{fmt(td.paid)}</span>;
  if (td.paid > 0 && td.paid < td.shouldPay)
    return (
      <span className="text-yellow-700 font-medium">
        {fmt(td.paid)}
        <span className="text-[10px] text-gray-400">/{fmt(td.shouldPay)}</span>
      </span>
    );
  if (td.shouldPay > 0)
    return <span className="text-red-600 font-medium">{fmt(td.shouldPay)}</span>;
  return <span className="text-gray-300">-</span>;
}
