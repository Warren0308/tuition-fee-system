import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { calculateUnpaidForStudents, getCurrentOrLatestTerm } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { formatTermLabel, formatTermLabelFull, billingCyclePaymentWhere } from "@/lib/term-utils";
import { studentBillableInTermWhere } from "@/lib/student-billing-eligibility";

function formatMoney(cents: number) {
  return `RM ${(cents / 100).toFixed(2)}`;
}

async function getReportData(_year?: number) {
  const [currentTerm, academicTerms] = await Promise.all([
    getCurrentOrLatestTerm(),
    getAcademicYearTerms(),
  ]);
  const termLabels = academicTerms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));
  const periodByCoords = new Map(
    academicTerms.map((t) => [`${t.year}_${t.termIndex}`, t.period])
  );

  // 2026 学年全部账单（含第1期内部分 2025T13）
  const cyclePayments = await prisma.studentTermPayment.findMany({
    where: billingCyclePaymentWhere(),
    include: { items: true, student: { include: { grade: true } } },
  });

  const termRevenueMap = new Map<number, { revenue: number; count: number; itemBreakdown: Map<string, { revenue: number; count: number }> }>();
  for (const p of cyclePayments) {
    const period = periodByCoords.get(`${p.year}_${p.termIndex}`);
    if (!period) continue;
    if (!termRevenueMap.has(period)) {
      termRevenueMap.set(period, { revenue: 0, count: 0, itemBreakdown: new Map() });
    }
    const bucket = termRevenueMap.get(period)!;
    bucket.revenue += p.totalCents;
    bucket.count += 1;
    for (const item of p.items) {
      const key = item.itemType;
      if (!bucket.itemBreakdown.has(key)) {
        bucket.itemBreakdown.set(key, { revenue: 0, count: 0 });
      }
      const sub = bucket.itemBreakdown.get(key)!;
      sub.revenue += item.finalCents;
      sub.count += 1;
    }
  }

  // 2. 当前/最新学期未付分析
  let currentTermStats: {
    term: { year: number; termIndex: number };
    totalStudents: number;
    paidStudents: number;
    unpaidStudents: number;
    expectedRevenue: number;
    receivedRevenue: number;
    unpaidRevenue: number;
    unpaidByGrade: Array<{ gradeName: string; count: number; unpaid: number }>;
  } | null = null;

  if (currentTerm) {
    const allActiveStudents = await prisma.student.findMany({
      where: studentBillableInTermWhere(currentTerm.id, academicTerms),
      select: { id: true, grade: { select: { name: true, orderIndex: true } } },
    });

    const unpaidMap = await calculateUnpaidForStudents(
      allActiveStudents.map((s) => s.id),
      currentTerm.id
    );

    let paidCount = 0;
    let unpaidCount = 0;
    let expected = 0;
    let received = 0;
    let unpaidTotal = 0;
    const byGradeMap = new Map<string, { gradeOrder: number; count: number; unpaid: number }>();

    for (const s of allActiveStudents) {
      const summary = unpaidMap.get(s.id);
      if (!summary) continue;

      if (summary.unpaidTotal > 0) {
        unpaidCount++;
        unpaidTotal += summary.unpaidTotal;

        const gradeName = s.grade?.name || '未分配年级';
        const order = s.grade?.orderIndex ?? 999;
        if (!byGradeMap.has(gradeName)) {
          byGradeMap.set(gradeName, { gradeOrder: order, count: 0, unpaid: 0 });
        }
        const b = byGradeMap.get(gradeName)!;
        b.count++;
        b.unpaid += summary.unpaidTotal;
      } else {
        paidCount++;
      }
    }

    // 当前学期已收
    const currentTermPayments = cyclePayments.filter(
      (p) => p.year === currentTerm.year && p.termIndex === currentTerm.termIndex
    );
    received = currentTermPayments.reduce((s, p) => s + p.totalCents, 0);
    expected = received + unpaidTotal;

    currentTermStats = {
      term: { year: currentTerm.year, termIndex: currentTerm.termIndex },
      totalStudents: allActiveStudents.length,
      paidStudents: paidCount,
      unpaidStudents: unpaidCount,
      expectedRevenue: expected,
      receivedRevenue: received,
      unpaidRevenue: unpaidTotal,
      unpaidByGrade: Array.from(byGradeMap.entries())
        .map(([name, v]) => ({ gradeName: name, count: v.count, unpaid: v.unpaid }))
        .sort((a, b) => b.unpaid - a.unpaid),
    };
  }

  // 3. 课程热度排行 (所有时间)
  const allCourseItems = await prisma.studentTermPaymentItem.findMany({
    where: { itemType: 'COURSE' },
    select: { description: true, refId: true, finalCents: true },
  });
  const courseStatsMap = new Map<string, { count: number; revenue: number }>();
  for (const it of allCourseItems) {
    const key = it.description;
    if (!courseStatsMap.has(key)) {
      courseStatsMap.set(key, { count: 0, revenue: 0 });
    }
    const b = courseStatsMap.get(key)!;
    b.count++;
    b.revenue += it.finalCents;
  }
  const topCourses = Array.from(courseStatsMap.entries())
    .map(([name, v]) => ({ name, ...v }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);

  // 4. 学年汇总
  const totalYearRevenue = cyclePayments.reduce((s, p) => s + p.totalCents, 0);
  const totalYearPayments = cyclePayments.length;
  const uniqueYearStudents = new Set(cyclePayments.map((p) => p.studentId)).size;

  return {
    currentTerm,
    termLabels,
    termRevenueMap,
    currentTermStats,
    topCourses,
    totalYearRevenue,
    totalYearPayments,
    uniqueYearStudents,
  };
}

const ITEM_TYPE_LABELS: Record<string, { label: string; color: string; icon: string }> = {
  COURSE: { label: '课程', color: 'bg-blue-100 text-blue-800', icon: '📚' },
  EXTRA_FEE: { label: '额外费用', color: 'bg-orange-100 text-orange-800', icon: '🍽️' },
  TEMP_EXTRA_FEE: { label: '临时费用', color: 'bg-amber-100 text-amber-800', icon: '🚌' },
  CUSTOM_FEE: { label: '自定义', color: 'bg-purple-100 text-purple-800', icon: '✏️' },
};

export default async function ReportsPage({
  searchParams,
}: {
  searchParams?: { year?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <Link className="text-blue-600 hover:underline" href="/login">立即登录</Link>
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: session.user?.name || '' },
    include: { roles: { include: { role: true } } },
  });
  const hasAccess = user?.roles.some((r) => ['ADMIN', 'RECIPIENT'].includes(r.role.code));
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">只有管理员和收费员可以访问此页面</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">← 返回工作台</Link>
        </div>
      </div>
    );
  }

  const data = await getReportData();

  return (
    <div className="min-h-screen p-6 space-y-6">
      {/* 标题 */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">📊</span>
            报表中心
          </h1>
          <p className="text-gray-600 mt-1">财务收入、未付分析、课程统计</p>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/admin"
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
          >
            ← 返回
          </Link>
        </div>
      </div>

      {/* 当前学期未付分析 */}
      {data.currentTermStats && (
        <section className="card-modern p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
                <span>🎯</span>
                当前学期：{formatTermLabelFull(data.currentTermStats.term.year, data.currentTermStats.term.termIndex, data.termLabels)}
              </h2>
              <p className="text-sm text-gray-500 mt-1">
                收缴率: {data.currentTermStats.expectedRevenue > 0
                  ? ((data.currentTermStats.receivedRevenue / data.currentTermStats.expectedRevenue) * 100).toFixed(1)
                  : '0'}%
              </p>
            </div>
            <Link
              href="/billing/unpaid"
              className="text-sm text-blue-600 hover:underline"
            >
              查看待支付学生 →
            </Link>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
            <StatBox
              label="预期总收入"
              value={formatMoney(data.currentTermStats.expectedRevenue)}
              color="text-blue-600"
            />
            <StatBox
              label="已收金额"
              value={formatMoney(data.currentTermStats.receivedRevenue)}
              color="text-emerald-600"
            />
            <StatBox
              label="未付金额"
              value={formatMoney(data.currentTermStats.unpaidRevenue)}
              color="text-red-600"
            />
            <StatBox
              label="未付学生"
              value={`${data.currentTermStats.unpaidStudents} / ${data.currentTermStats.totalStudents}`}
              color="text-amber-600"
            />
          </div>

          {/* 进度条 */}
          <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-emerald-400 to-emerald-600 transition-all"
              style={{
                width: `${data.currentTermStats.expectedRevenue > 0
                  ? Math.min(100, (data.currentTermStats.receivedRevenue / data.currentTermStats.expectedRevenue) * 100)
                  : 0
                }%`,
              }}
            />
          </div>

          {/* 按年级未付分布 */}
          {data.currentTermStats.unpaidByGrade.length > 0 && (
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-700 mb-3">未付按年级分布</h3>
              <div className="space-y-2">
                {data.currentTermStats.unpaidByGrade.map((g) => (
                  <div key={g.gradeName} className="flex items-center gap-3">
                    <div className="w-24 text-sm text-gray-700 truncate">{g.gradeName}</div>
                    <div className="flex-1 bg-gray-100 rounded-full h-6 relative overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-red-300 to-red-500 flex items-center justify-end pr-2"
                        style={{
                          width: `${(g.unpaid / data.currentTermStats!.unpaidRevenue) * 100}%`,
                        }}
                      >
                        <span className="text-xs font-medium text-white whitespace-nowrap">
                          {g.count} 人
                        </span>
                      </div>
                    </div>
                    <div className="w-24 text-sm text-right font-medium text-red-600">
                      {formatMoney(g.unpaid)}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>
      )}

      {/* 年度汇总 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>📅</span>
          2026 学年汇总
        </h2>
        <div className="grid grid-cols-3 gap-4 mb-6">
          <StatBox
            label="总收入"
            value={formatMoney(data.totalYearRevenue)}
            color="text-emerald-600"
          />
          <StatBox
            label="账单笔数"
            value={String(data.totalYearPayments)}
            color="text-blue-600"
          />
          <StatBox
            label="缴费学生"
            value={String(data.uniqueYearStudents)}
            color="text-purple-600"
          />
        </div>

        {/* 各学期柱状图 */}
        <h3 className="text-sm font-medium text-gray-700 mb-3">各学期收入对比</h3>
        {(() => {
          const maxRevenue = Math.max(
            ...Array.from(data.termRevenueMap.values()).map((v) => v.revenue),
            1
          );
          const sortedTerms = Array.from(data.termRevenueMap.entries()).sort((a, b) => a[0] - b[0]);
          if (sortedTerms.length === 0) {
            return <div className="text-sm text-gray-500 text-center py-8">2026 学年暂无账单数据</div>;
          }
          return (
            <div className="space-y-2">
              {sortedTerms.map(([period, stat]) => (
                <div key={period} className="flex items-center gap-3">
                  <div className="w-24 text-sm text-gray-700">第{period}期</div>
                  <div className="flex-1 bg-gray-100 rounded h-8 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-blue-400 to-blue-600 flex items-center justify-end pr-2 transition-all"
                      style={{ width: `${(stat.revenue / maxRevenue) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white whitespace-nowrap">
                        {stat.count} 笔
                      </span>
                    </div>
                  </div>
                  <div className="w-32 text-sm text-right font-semibold text-gray-800">
                    {formatMoney(stat.revenue)}
                  </div>
                </div>
              ))}
            </div>
          );
        })()}

        {/* 项目类型分布 */}
        <h3 className="text-sm font-medium text-gray-700 mt-6 mb-3">项目类型分布</h3>
        {(() => {
          // 累计所有学期的项目类型
          const allItemTypes = new Map<string, { revenue: number; count: number }>();
          for (const [, stat] of data.termRevenueMap) {
            for (const [type, sub] of stat.itemBreakdown) {
              if (!allItemTypes.has(type)) {
                allItemTypes.set(type, { revenue: 0, count: 0 });
              }
              const b = allItemTypes.get(type)!;
              b.revenue += sub.revenue;
              b.count += sub.count;
            }
          }
          const totalYearRevenue = data.totalYearRevenue || 1;
          const entries = Array.from(allItemTypes.entries()).sort(
            (a, b) => b[1].revenue - a[1].revenue
          );
          if (entries.length === 0) {
            return <div className="text-sm text-gray-500 text-center py-4">无数据</div>;
          }
          return (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {entries.map(([type, v]) => {
                const meta = ITEM_TYPE_LABELS[type] || { label: type, color: 'bg-gray-100 text-gray-800', icon: '📦' };
                const pct = ((v.revenue / totalYearRevenue) * 100).toFixed(1);
                return (
                  <div key={type} className="p-3 bg-gray-50 rounded-lg">
                    <div className="flex items-center justify-between mb-1">
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded ${meta.color}`}>
                        {meta.icon} {meta.label}
                      </span>
                      <span className="text-xs text-gray-500">{pct}%</span>
                    </div>
                    <div className="text-lg font-bold text-gray-800">{formatMoney(v.revenue)}</div>
                    <div className="text-xs text-gray-500">{v.count} 笔</div>
                  </div>
                );
              })}
            </div>
          );
        })()}
      </section>

      {/* 课程热度 TOP 10 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🏆</span>
          课程热度 TOP 10（按缴费次数）
        </h2>
        {data.topCourses.length === 0 ? (
          <div className="text-center py-8 text-gray-500">暂无课程数据</div>
        ) : (
          <div className="space-y-2">
            {data.topCourses.map((c, i) => {
              const maxCount = data.topCourses[0]?.count || 1;
              return (
                <div key={c.name} className="flex items-center gap-3">
                  <div className="w-8 text-center font-bold text-gray-400">#{i + 1}</div>
                  <div className="w-40 text-sm font-medium text-gray-800 truncate">{c.name}</div>
                  <div className="flex-1 bg-gray-100 rounded h-6 overflow-hidden">
                    <div
                      className="h-full bg-gradient-to-r from-purple-400 to-pink-500 flex items-center justify-end pr-2"
                      style={{ width: `${(c.count / maxCount) * 100}%` }}
                    >
                      <span className="text-xs font-medium text-white">{c.count} 次</span>
                    </div>
                  </div>
                  <div className="w-32 text-sm text-right font-semibold text-gray-700">
                    {formatMoney(c.revenue)}
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* 导出 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-3 flex items-center gap-2">
          <span>📥</span>
          导出数据
        </h2>
        <p className="text-sm text-gray-600 mb-4">
          点击下方按钮导出为 CSV 文件，可在 Excel 中打开。
        </p>
        <div className="flex flex-wrap gap-2">
          <a
            href="/api/admin/tools/export/payments"
            download
            className="btn-modern bg-purple-600 hover:bg-purple-700 text-white px-4 py-2"
          >
            💰 导出缴费数据
          </a>
          <a
            href="/api/admin/tools/export/students"
            download
            className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          >
            👥 导出学生数据
          </a>
          <a
            href="/api/admin/tools/export/enrollments"
            download
            className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2"
          >
            📚 导出选课数据
          </a>
        </div>
      </section>
    </div>
  );
}

function StatBox({
  label,
  value,
  color,
}: {
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="p-4 bg-gray-50 rounded-lg">
      <div className="text-xs text-gray-500 mb-1">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
