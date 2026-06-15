"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

interface TermInfo {
  period: number;
  year: number;
  termIndex: number;
}

interface StatsData {
  terms: TermInfo[];
  termRevenue: Record<number, { revenue: number; count: number; paidCount: number }>;
  courseByTerm: Record<number, Record<string, number>>;
  topCourses: { name: string; revenue: number; count: number }[];
  extraFees: { name: string; revenue: number; count: number }[];
  gradeDistrib: { name: string; order: number; count: number }[];
  termPaymentRate: Record<
    number,
    { shouldPayStudents: number; paidStudents: number; paymentRate: number }
  >;
  gradeCourseMatrix: Record<string, Record<string, number>>;
  termGradeMatrix: Record<number, Record<string, number>>;
  allCourseNames: string[];
  allGradeNames: string[];
  summary: {
    totalRevenue: number;
    totalPayments: number;
    activeStudents: number;
    termCount: number;
  };
}

type Dimension =
  | "summary"
  | "termRevenue"
  | "paymentRate"
  | "courses"
  | "extraFees"
  | "grades"
  | "courseByTerm"
  | "gradeCourse"
  | "termGrade";

const DIMENSIONS: { id: Dimension; label: string; icon: string; desc: string }[] = [
  { id: "summary", label: "总览摘要", icon: "🌟", desc: "全年关键数字" },
  { id: "termRevenue", label: "各期收入", icon: "📈", desc: "每学期收入趋势" },
  { id: "paymentRate", label: "缴费率", icon: "✅", desc: "各期学生缴费完成率" },
  { id: "courses", label: "课程排行", icon: "📚", desc: "各课程收入与人次" },
  { id: "extraFees", label: "额外费用", icon: "🍽️", desc: "膳食/交通等费用统计" },
  { id: "grades", label: "年级人数", icon: "👥", desc: "在读学生年级构成" },
  { id: "courseByTerm", label: "课程×学期", icon: "🔢", desc: "每期各课程收入明细" },
  { id: "gradeCourse", label: "年级×课程", icon: "📊", desc: "每个年级各课程收入" },
  { id: "termGrade", label: "学期×年级", icon: "📅", desc: "每期各年级收入" },
];

function fmtRM(cents: number) {
  return `RM ${(cents / 100).toFixed(0)}`;
}
function fmtRMFull(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

export function StatsClient() {
  const [data, setData] = useState<StatsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [active, setActive] = useState<Set<Dimension>>(
    new Set(["summary", "termRevenue", "paymentRate", "courses"] as Dimension[])
  );

  useEffect(() => {
    fetch("/api/stats")
      .then((r) => {
        if (!r.ok) throw new Error("加载失败");
        return r.json();
      })
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  const toggle = (id: Dimension) => {
    setActive((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (loading) {
    return (
      <div className="card-modern p-12 text-center">
        <div className="animate-spin text-4xl mb-4">⏳</div>
        <p className="text-gray-600">正在加载统计数据...</p>
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="card-modern p-12 text-center">
        <div className="text-4xl mb-4">❌</div>
        <p className="text-red-600">{error || "数据加载失败"}</p>
        <button
          onClick={() => window.location.reload()}
          className="mt-4 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
        >
          重试
        </button>
      </div>
    );
  }

  const sortedTerms = [...data.terms].sort((a, b) => a.period - b.period);
  const periodsWithRevenue = sortedTerms.filter(
    (t) => (data.termRevenue[t.period]?.revenue ?? 0) > 0
  );

  const maxRevenue = Math.max(
    ...periodsWithRevenue.map((t) => data.termRevenue[t.period]?.revenue ?? 0),
    1
  );
  const maxStudents = Math.max(...data.gradeDistrib.map((g) => g.count), 1);
  const maxCourseCount = Math.max(...data.topCourses.map((c) => c.count), 1);
  const maxExtraRevenue = Math.max(...data.extraFees.map((f) => f.revenue), 1);

  return (
    <div className="space-y-4">
      {/* Dimension toggles */}
      <div className="card-modern p-4">
        <div className="text-xs font-semibold text-gray-500 mb-3 uppercase tracking-wide">
          选择显示维度
        </div>
        <div className="flex flex-wrap gap-2">
          {DIMENSIONS.map((d) => (
            <button
              key={d.id}
              onClick={() => toggle(d.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all border ${
                active.has(d.id)
                  ? "bg-blue-600 text-white border-blue-600"
                  : "bg-white text-gray-600 border-gray-300 hover:border-blue-400"
              }`}
              title={d.desc}
            >
              <span>{d.icon}</span>
              <span>{d.label}</span>
            </button>
          ))}
          <button
            onClick={() => setActive(new Set(DIMENSIONS.map((d) => d.id)))}
            className="px-3 py-1.5 rounded-full text-xs text-blue-600 border border-blue-300 hover:bg-blue-50"
          >
            全选
          </button>
          <button
            onClick={() => setActive(new Set())}
            className="px-3 py-1.5 rounded-full text-xs text-gray-500 border border-gray-300 hover:bg-gray-50"
          >
            清空
          </button>
        </div>
      </div>

      {/* ── 总览摘要 ── */}
      {active.has("summary") && (
        <section className="card-modern p-5">
          <SectionTitle icon="🌟" title="总览摘要" />
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <StatBox
              label="学年总收入"
              value={fmtRM(data.summary.totalRevenue)}
              sub={`${data.summary.totalPayments} 笔账单`}
              color="text-emerald-600"
              bg="bg-emerald-50"
            />
            <StatBox
              label="在读学生"
              value={String(data.summary.activeStudents)}
              sub="目前活跃"
              color="text-blue-600"
              bg="bg-blue-50"
            />
            <StatBox
              label="课程种类"
              value={String(data.topCourses.length)}
              sub="有缴费记录"
              color="text-purple-600"
              bg="bg-purple-50"
            />
            <StatBox
              label="学期数"
              value={String(data.summary.termCount)}
              sub="本学年"
              color="text-amber-600"
              bg="bg-amber-50"
            />
          </div>
        </section>
      )}

      {/* ── 各期收入 ── */}
      {active.has("termRevenue") && (
        <section className="card-modern p-5">
          <SectionTitle icon="📈" title="各学期收入趋势" />
          {periodsWithRevenue.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {periodsWithRevenue.map((t) => {
                const d = data.termRevenue[t.period];
                return (
                  <div key={t.period} className="flex items-center gap-2">
                    <div className="w-14 text-xs font-medium text-gray-700 shrink-0">
                      第{t.period}期
                    </div>
                    <div className="flex-1 bg-gray-100 rounded h-8 overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-end pr-2 transition-all"
                        style={{ width: `${(d.revenue / maxRevenue) * 100}%`, minWidth: d.revenue > 0 ? "2rem" : 0 }}
                      >
                        <span className="text-xs font-medium text-white whitespace-nowrap">
                          {d.count} 笔
                        </span>
                      </div>
                    </div>
                    <div className="w-28 text-xs text-right font-semibold text-gray-800 shrink-0">
                      {fmtRMFull(d.revenue)}
                    </div>
                  </div>
                );
              })}
              <div className="mt-3 pt-3 border-t text-sm font-semibold text-emerald-700 text-right">
                合计：{fmtRMFull(periodsWithRevenue.reduce((s, t) => s + (data.termRevenue[t.period]?.revenue ?? 0), 0))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 缴费率 ── */}
      {active.has("paymentRate") && (
        <section className="card-modern p-5">
          <SectionTitle icon="✅" title="各学期缴费率" />
          {Object.keys(data.termPaymentRate).length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {sortedTerms
                .filter((t) => data.termPaymentRate[t.period])
                .map((t) => {
                  const r = data.termPaymentRate[t.period];
                  const pct = r.paymentRate;
                  const color =
                    pct >= 80
                      ? "from-emerald-400 to-emerald-600"
                      : pct >= 50
                        ? "from-yellow-400 to-amber-500"
                        : "from-red-400 to-red-600";
                  return (
                    <div key={t.period} className="flex items-center gap-2">
                      <div className="w-14 text-xs font-medium text-gray-700 shrink-0">
                        第{t.period}期
                      </div>
                      <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                        <div
                          className={`h-full bg-gradient-to-r ${color} flex items-center justify-end pr-2 transition-all`}
                          style={{ width: `${pct}%`, minWidth: pct > 0 ? "2.5rem" : 0 }}
                        >
                          <span className="text-xs font-medium text-white whitespace-nowrap">
                            {pct}%
                          </span>
                        </div>
                      </div>
                      <div className="w-24 text-xs text-right text-gray-600 shrink-0">
                        {r.paidStudents}/{r.shouldPayStudents} 人
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </section>
      )}

      {/* ── 课程分布 ── */}
      {active.has("courses") && (
        <section className="card-modern p-5">
          <SectionTitle icon="📚" title="课程收入排行" />
          {data.topCourses.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {data.topCourses.map((c, i) => (
                <div key={c.name} className="flex items-center gap-2">
                  <div className="w-6 text-xs text-center font-bold text-gray-400 shrink-0">
                    {i + 1}
                  </div>
                  <div className="w-28 text-xs font-medium text-gray-800 truncate shrink-0">
                    {c.name}
                  </div>
                  <div className="flex-1 bg-gray-100 rounded h-7 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-end pr-2"
                      style={{ width: `${(c.count / maxCourseCount) * 100}%`, minWidth: "2rem" }}
                    >
                      <span className="text-xs font-medium text-white">{c.count} 次</span>
                    </div>
                  </div>
                  <div className="w-24 text-xs text-right font-semibold text-gray-700 shrink-0">
                    {fmtRM(c.revenue)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 额外费用 ── */}
      {active.has("extraFees") && (
        <section className="card-modern p-5">
          <SectionTitle icon="🍽️" title="额外费用统计（膳食/交通等）" />
          {data.extraFees.length === 0 ? (
            <Empty text="暂无额外费用记录" />
          ) : (
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {data.extraFees.map((f) => (
                <div key={f.name} className="p-3 bg-orange-50 rounded-lg border border-orange-100">
                  <div className="text-sm font-semibold text-gray-800">{f.name}</div>
                  <div className="text-lg font-bold text-orange-600 mt-1">
                    {fmtRM(f.revenue)}
                  </div>
                  <div className="text-xs text-gray-500">{f.count} 次</div>
                  <div className="mt-2 w-full bg-orange-100 rounded-full h-1.5 overflow-hidden">
                    <div
                      className="h-full bg-orange-400"
                      style={{ width: `${(f.revenue / maxExtraRevenue) * 100}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      )}

      {/* ── 年级分布 ── */}
      {active.has("grades") && (
        <section className="card-modern p-5">
          <SectionTitle icon="👥" title="在读学生年级分布" />
          {data.gradeDistrib.length === 0 ? (
            <Empty />
          ) : (
            <div className="space-y-2">
              {data.gradeDistrib.map((g) => (
                <div key={g.name} className="flex items-center gap-2">
                  <div className="w-14 text-xs font-medium text-gray-700 shrink-0">{g.name}</div>
                  <div className="flex-1 bg-gray-100 rounded-full h-7 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-sky-400 to-blue-500 flex items-center justify-end pr-2"
                      style={{
                        width: `${(g.count / maxStudents) * 100}%`,
                        minWidth: "2rem",
                      }}
                    >
                      <span className="text-xs font-medium text-white">{g.count} 人</span>
                    </div>
                  </div>
                  <div className="w-16 text-xs text-right text-gray-600 shrink-0">
                    {((g.count / data.summary.activeStudents) * 100).toFixed(1)}%
                  </div>
                </div>
              ))}
              <div className="pt-2 text-xs text-gray-500 text-right">
                共 {data.summary.activeStudents} 名在读学生
              </div>
            </div>
          )}
        </section>
      )}

      {/* ── 课程×学期 ── */}
      {active.has("courseByTerm") && (
        <section className="card-modern p-5">
          <SectionTitle icon="🔢" title="各学期课程收入明细" />
          {periodsWithRevenue.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 bg-gray-50 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 min-w-[100px]">
                      课程
                    </th>
                    {periodsWithRevenue.map((t) => (
                      <th
                        key={t.period}
                        className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-700 min-w-[70px]"
                      >
                        第{t.period}期
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-700 bg-indigo-50 min-w-[80px]">
                      合计
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.topCourses.map((course) => {
                    const total = periodsWithRevenue.reduce(
                      (s, t) => s + (data.courseByTerm[t.period]?.[course.name] ?? 0),
                      0
                    );
                    return (
                      <tr key={course.name} className="hover:bg-gray-50">
                        <td className="sticky left-0 bg-white border border-gray-100 px-2 py-1.5 font-medium text-gray-800">
                          {course.name}
                        </td>
                        {periodsWithRevenue.map((t) => {
                          const v = data.courseByTerm[t.period]?.[course.name] ?? 0;
                          return (
                            <td
                              key={t.period}
                              className={`border border-gray-100 px-2 py-1.5 text-center ${
                                v > 0 ? "text-blue-700 font-medium" : "text-gray-300"
                              }`}
                            >
                              {v > 0 ? fmtRM(v) : "-"}
                            </td>
                          );
                        })}
                        <td className="border border-gray-100 px-2 py-1.5 text-center font-bold text-gray-800 bg-indigo-50/50">
                          {fmtRM(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── 年级×课程 ── */}
      {active.has("gradeCourse") && (
        <section className="card-modern p-5">
          <SectionTitle icon="📊" title="年级 × 课程 收入交叉" />
          {Object.keys(data.gradeCourseMatrix).length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 bg-gray-50 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 min-w-[70px]">
                      年级
                    </th>
                    {data.allCourseNames.map((c) => (
                      <th
                        key={c}
                        className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-700 min-w-[72px] whitespace-nowrap"
                      >
                        {c}
                      </th>
                    ))}
                    <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold bg-indigo-50 min-w-[72px]">
                      合计
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {data.allGradeNames
                    .filter((g) => data.gradeCourseMatrix[g])
                    .map((grade) => {
                      const row = data.gradeCourseMatrix[grade] || {};
                      const total = Object.values(row).reduce((s, v) => s + v, 0);
                      return (
                        <tr key={grade} className="hover:bg-gray-50">
                          <td className="sticky left-0 bg-white border border-gray-100 px-2 py-1.5 font-medium text-gray-800">
                            {grade}
                          </td>
                          {data.allCourseNames.map((c) => {
                            const v = row[c] ?? 0;
                            return (
                              <td
                                key={c}
                                className={`border border-gray-100 px-2 py-1.5 text-center ${
                                  v > 0 ? "text-purple-700 font-medium" : "text-gray-200"
                                }`}
                              >
                                {v > 0 ? fmtRM(v) : "-"}
                              </td>
                            );
                          })}
                          <td className="border border-gray-100 px-2 py-1.5 text-center font-bold text-gray-800 bg-indigo-50/50">
                            {fmtRM(total)}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {/* ── 学期×年级 ── */}
      {active.has("termGrade") && (
        <section className="card-modern p-5">
          <SectionTitle icon="📅" title="学期 × 年级 收入交叉" />
          {periodsWithRevenue.length === 0 ? (
            <Empty />
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50">
                    <th className="sticky left-0 bg-gray-50 border border-gray-200 px-2 py-1.5 text-left font-semibold text-gray-700 min-w-[60px]">
                      学期
                    </th>
                    {data.allGradeNames
                      .filter((g) =>
                        periodsWithRevenue.some((t) => data.termGradeMatrix[t.period]?.[g] > 0)
                      )
                      .map((g) => (
                        <th
                          key={g}
                          className="border border-gray-200 px-2 py-1.5 text-center font-semibold text-gray-700 min-w-[62px] whitespace-nowrap"
                        >
                          {g}
                        </th>
                      ))}
                    <th className="border border-gray-200 px-2 py-1.5 text-center font-semibold bg-indigo-50 min-w-[70px]">
                      合计
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {periodsWithRevenue.map((term) => {
                    const row = data.termGradeMatrix[term.period] || {};
                    const activeGrades = data.allGradeNames.filter((g) =>
                      periodsWithRevenue.some((t) => data.termGradeMatrix[t.period]?.[g] > 0)
                    );
                    const total = activeGrades.reduce((s, g) => s + (row[g] ?? 0), 0);
                    return (
                      <tr key={term.period} className="hover:bg-gray-50">
                        <td className="sticky left-0 bg-white border border-gray-100 px-2 py-1.5 font-medium text-gray-800">
                          第{term.period}期
                        </td>
                        {activeGrades.map((g) => {
                          const v = row[g] ?? 0;
                          return (
                            <td
                              key={g}
                              className={`border border-gray-100 px-2 py-1.5 text-center ${
                                v > 0 ? "text-blue-700 font-medium" : "text-gray-200"
                              }`}
                            >
                              {v > 0 ? fmtRM(v) : "-"}
                            </td>
                          );
                        })}
                        <td className="border border-gray-100 px-2 py-1.5 text-center font-bold text-gray-800 bg-indigo-50/50">
                          {fmtRM(total)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}

      {active.size === 0 && (
        <div className="card-modern p-12 text-center text-gray-400">
          <div className="text-5xl mb-3">📊</div>
          <p>请在上方选择要查看的统计维度</p>
        </div>
      )}

      {/* 快捷链接 */}
      <div className="card-modern p-4">
        <div className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">
          快捷跳转
        </div>
        <div className="flex flex-wrap gap-2">
          <Link
            href="/billing/unpaid"
            className="text-xs px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"
          >
            ⏰ 待支付学生
          </Link>
          <Link
            href="/billing/ledger"
            className="text-xs px-3 py-1.5 bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100"
          >
            📋 缴费台账
          </Link>
          <Link
            href="/admin/reports"
            className="text-xs px-3 py-1.5 bg-blue-50 text-blue-700 border border-blue-200 rounded-lg hover:bg-blue-100"
          >
            📊 完整报表
          </Link>
          <Link
            href="/billing/batch"
            className="text-xs px-3 py-1.5 bg-purple-50 text-purple-700 border border-purple-200 rounded-lg hover:bg-purple-100"
          >
            ⚡ 批量结算
          </Link>
        </div>
      </div>
    </div>
  );
}

function SectionTitle({ icon, title }: { icon: string; title: string }) {
  return (
    <h2 className="text-base font-semibold text-gray-800 flex items-center gap-2 mb-4">
      <span>{icon}</span>
      {title}
    </h2>
  );
}

function StatBox({
  label,
  value,
  sub,
  color,
  bg,
}: {
  label: string;
  value: string;
  sub: string;
  color: string;
  bg: string;
}) {
  return (
    <div className={`p-4 ${bg} rounded-xl`}>
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-xl font-bold ${color}`}>{value}</div>
      <div className="text-xs text-gray-400 mt-0.5">{sub}</div>
    </div>
  );
}

function Empty({ text = "暂无数据" }: { text?: string }) {
  return <div className="text-center py-8 text-gray-400 text-sm">{text}</div>;
}
