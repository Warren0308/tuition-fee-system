import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getTermStatistics, getYearStatistics, getTrendAnalysis } from "@/lib/statistics";
import { TermStatsCard } from "@/components/TermStatsCard";
import { TermDatePicker } from "@/components/TermDatePicker";
import Link from "next/link";

async function getData() {
  const currentYear = new Date().getFullYear();
  
  // 获取最近三年的数据
  const years = [currentYear - 2, currentYear - 1, currentYear];
  
  const [terms, yearStats, trends] = await Promise.all([
    // 获取当前年份的所有学期
    prisma.term.findMany({
      where: { year: currentYear },
      orderBy: { termIndex: 'asc' }
    }),
    // 获取年度统计
    getYearStatistics(currentYear),
    // 获取趋势分析
    getTrendAnalysis(years)
  ]);

  // 获取每个学期的统计信息
  const termStats = await Promise.all(
    terms.map(term => 
      getTermStatistics(term.year, term.termIndex)
    )
  );

  return {
    terms,
    termStats,
    yearStats,
    trends
  };
}

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center animate-fade-in">
          <div className="w-16 h-16 bg-gradient-primary rounded-2xl flex items-center justify-center text-3xl mx-auto mb-4">
            🔒
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">需要登录</h2>
          <p className="text-gray-600 mb-6">请先登录以访问管理面板</p>
          <Link 
            className="btn-modern bg-gradient-primary text-white px-6 py-3 inline-flex items-center space-x-2" 
            href="/login"
          >
            <span>🚀</span>
            <span>立即登录</span>
          </Link>
        </div>
      </div>
    );
  }

  const data = await getData();

  return (
    <div className="min-h-screen p-6 space-y-8">
      {/* 页面标题 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-800 mb-2">📊 管理面板</h1>
            <p className="text-gray-600">查看学期统计和趋势分析</p>
          </div>
          <Link 
            href="/admin/terms" 
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 transition-all duration-300"
          >
            前往学期管理 →
          </Link>
        </div>
      </div>

      {/* 年度统计概览 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="card-modern p-6">
          <div className="text-sm text-gray-600">总学生数</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {data.yearStats.summary.totalStudents}
          </div>
          <div className="text-xs text-gray-500">
            较上年
            {data.trends.growth.studentGrowth[0] > 0 ? (
              <span className="text-green-600">↑ {data.trends.growth.studentGrowth[0].toFixed(1)}%</span>
            ) : (
              <span className="text-red-600">↓ {Math.abs(data.trends.growth.studentGrowth[0]).toFixed(1)}%</span>
            )}
          </div>
        </div>

        <div className="card-modern p-6">
          <div className="text-sm text-gray-600">年度收入</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            RM {(data.yearStats.summary.totalRevenue / 100).toFixed(2)}
          </div>
          <div className="text-xs text-gray-500">
            较上年
            {data.trends.growth.revenueGrowth[0] > 0 ? (
              <span className="text-green-600">↑ {data.trends.growth.revenueGrowth[0].toFixed(1)}%</span>
            ) : (
              <span className="text-red-600">↓ {Math.abs(data.trends.growth.revenueGrowth[0]).toFixed(1)}%</span>
            )}
          </div>
        </div>

        <div className="card-modern p-6">
          <div className="text-sm text-gray-600">平均付款率</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {data.yearStats.summary.averagePaymentRate.toFixed(1)}%
          </div>
          <div className="text-xs text-gray-500">
            目标: 95%
          </div>
        </div>

        <div className="card-modern p-6">
          <div className="text-sm text-gray-600">平均班级大小</div>
          <div className="text-3xl font-bold text-gray-800 mb-2">
            {data.yearStats.summary.averageClassSize.toFixed(1)}
          </div>
          <div className="text-xs text-gray-500">
            目标: 15-20人/班
          </div>
        </div>
      </div>

      {/* 学期统计卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {data.terms.map((term, index) => (
          <TermStatsCard
            key={term.id}
            term={term}
            stats={data.termStats[index]}
          />
        ))}
      </div>

      {/* 趋势图表 */}
      <div className="card-modern p-6">
        <h2 className="text-xl font-semibold text-gray-800 mb-6">趋势分析</h2>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {data.trends.years.map(year => (
            <div key={year.year} className="space-y-4">
              <div className="text-lg font-medium text-gray-700">{year.year} 学年</div>
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">学生数</span>
                  <span className="font-medium">{year.totalStudents}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">收入</span>
                  <span className="font-medium">RM {(year.totalRevenue / 100).toFixed(2)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">课程数</span>
                  <span className="font-medium">{year.totalCourses}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}








