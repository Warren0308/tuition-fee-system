import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { YearCalendar } from "./components/YearCalendar";
import { EditDateButton } from "./components/EditDateButton";
import { TermForm } from "./components/TermForm";
import { getAcademicYearContext } from "@/lib/academic-year";
import {
  ACADEMIC_YEAR,
  ACADEMIC_YEAR_LABEL,
  formatTermLabel,
  getBillingPeriodColorClass,
} from "@/lib/term-utils";

async function getData() {
  const { config, terms } = await getAcademicYearContext();
  return { config, terms };
}

export default async function AdminTermsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">
        未登录。请先
        <Link className="text-blue-600" href="/login">
          登录
        </Link>
      </div>
    );
  }

  const { config, terms } = await getData();

  return (
    <div className="min-h-screen p-6 space-y-8">
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📅 学期管理</h1>
            <p className="text-gray-600">
              {ACADEMIC_YEAR_LABEL} · 第1期自 12/29 起，共 13 期（与收费、Excel 一致）
            </p>
          </div>
          <Link
            href="/admin"
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            ← 返回管理面板
          </Link>
        </div>
      </div>

      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6 flex-wrap gap-3">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
                📅
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">学期日历视图</h2>
                <p className="text-gray-600 text-sm">按 {ACADEMIC_YEAR_LABEL} 第1–13期 着色</p>
              </div>
            </div>
            <span className="px-4 py-2 bg-indigo-100 text-indigo-800 rounded-lg text-sm font-medium">
              {ACADEMIC_YEAR_LABEL}
            </span>
          </div>

          <YearCalendar terms={terms} />

          <div className="mt-6 flex flex-wrap gap-3">
            <div className="text-sm text-gray-600 w-full mb-1">学期颜色说明：</div>
            {[...Array(13)].map((_, i) => {
              const period = i + 1;
              return (
                <div
                  key={period}
                  className={`px-3 py-1 rounded-full text-sm ${getBillingPeriodColorClass(period, false)}`}
                >
                  第{period}期
                </div>
              );
            })}
          </div>

          <div className="mt-8 border-t pt-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">学期详细信息</h3>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-gray-200 bg-gray-50">
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">学期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">开始日期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">结束日期</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">天数</th>
                    <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                  </tr>
                </thead>
                <tbody>
                  {terms.map((term, index) => {
                    const startDate = new Date(term.startDate);
                    const endDate = new Date(term.endDate);
                    const daysDiff = Math.ceil(
                      (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24)
                    );
                    const period = term.period;

                    return (
                      <tr
                        key={term.id}
                        className={`border-b border-gray-100 ${index % 2 === 0 ? "bg-white" : "bg-gray-50"}`}
                      >
                        <td className="px-4 py-3">
                          <div
                            className={`inline-flex px-2 py-1 rounded text-sm font-medium ${getBillingPeriodColorClass(period, false)}`}
                          >
                            {formatTermLabel(term.year, term.termIndex, terms)}
                          </div>
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {startDate.toLocaleDateString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">
                          {endDate.toLocaleDateString("zh-CN")}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-600">{daysDiff} 天</td>
                        <td className="px-4 py-3">
                          <EditDateButton termId={term.id} startDate={startDate} />
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              {terms.length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  尚未配置 {ACADEMIC_YEAR_LABEL} 学期，请在下方设置第1期起始日期
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="card-modern animate-fade-in">
        <div className="p-6">
          <div className="flex items-center space-x-3 mb-6">
            <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
              📋
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">第1期起始设置</h2>
              <p className="text-gray-600 text-sm">
                设置 {ACADEMIC_YEAR_LABEL} 第1期开始日期（通常为 12/29），自动生成 13 期
              </p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2 gap-6">
            <TermForm
              defaultTerm1Date={
                config?.term1Date
                  ? new Date(config.term1Date).toISOString().slice(0, 10)
                  : "2025-12-29"
              }
            />
            <div className="space-y-4">
              <div className="p-3 bg-blue-50 rounded-lg">
                <p className="text-sm text-blue-700">
                  💡 第1期 = 12/29 起（4 周一期）。第2期起于次年 1 月，与 Excel 29-Dec / JAN 列对应。
                </p>
              </div>
              <div className="p-3 bg-yellow-50 rounded-lg">
                <p className="text-sm text-yellow-700">
                  ⚠️ 保存后将更新 {ACADEMIC_YEAR_LABEL} 全部 13 期的日期（内部写入 2025T13 + 2026T1–T12）。
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {config && (
        <div className="card-modern animate-fade-in">
          <div className="p-6">
            <h3 className="text-lg font-semibold text-gray-800 mb-4">当前配置</h3>
            <table className="w-full">
              <tbody>
                <tr className="border-b border-gray-100">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">学年</td>
                  <td className="px-4 py-3 text-sm text-gray-600">{ACADEMIC_YEAR_LABEL}</td>
                </tr>
                <tr>
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">第1期起始</td>
                  <td className="px-4 py-3 text-sm text-gray-600">
                    {new Date(config.term1Date).toLocaleDateString("zh-CN")}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
