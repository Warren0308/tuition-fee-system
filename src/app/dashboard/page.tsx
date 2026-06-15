import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { calculateUnpaidForStudents, getCurrentOrLatestTerm } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import { studentBillableInTermWhere } from "@/lib/student-billing-eligibility";
import { formatTermLabelFull } from "@/lib/term-utils";

async function getDashboardData() {
  try {
    const [termToUse, academicTerms] = await Promise.all([
      getCurrentOrLatestTerm(),
      getAcademicYearTerms(),
    ]);
    const termLabels = academicTerms.map((t) => ({
      year: t.year,
      termIndex: t.termIndex,
      period: t.period,
    }));

    const [studentsCount, teachersCount, totalEnrollments] = await Promise.all([
      prisma.student.count({ where: { isActive: true } }),
      prisma.teacher.count(),
      prisma.studentEnrollment.count({ where: { endTermId: null } }),
    ]);

    // 统一使用 billing-utils 计算未支付
    let unpaidStudentsCount = 0;
    if (termToUse) {
      const studentsWithEnrollments = await prisma.student.findMany({
        where: studentBillableInTermWhere(termToUse.id, academicTerms),
        select: { id: true },
      });

      const unpaidMap = await calculateUnpaidForStudents(
        studentsWithEnrollments.map((s) => s.id),
        termToUse.id
      );

      for (const summary of unpaidMap.values()) {
        if (summary.unpaidTotal > 0) unpaidStudentsCount++;
      }
    }

    const recentStudents = await prisma.student.findMany({
      take: 5,
      orderBy: { createdAt: 'desc' },
      include: { grade: true },
    });

    return {
      studentsCount,
      teachersCount,
      totalEnrollments,
      unpaidStudentsCount,
      currentTerm: termToUse,
      termLabels,
      recentStudents,
    };
  } catch (error) {
    console.error('获取仪表板数据失败:', error);
    return {
      studentsCount: 0,
      teachersCount: 0,
      totalEnrollments: 0,
      unpaidStudentsCount: 0,
      currentTerm: null,
      termLabels: [] as Array<{ year: number; termIndex: number; period: number }>,
      recentStudents: [],
    };
  }
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
          <p className="text-gray-600 mb-6">请先登录以访问工作台</p>
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
  
  const isAdmin = (session as any).roles?.includes("ADMIN");
  const data = await getDashboardData();

  return (
    <main className="min-h-screen p-6 space-y-8">
      {/* 欢迎区域 */}
      <div className="animate-fade-in-up">
        <div className="flex items-center space-x-4 mb-2">
          <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-2xl">
            👋
          </div>
          <div>
            <h1 className="text-3xl font-bold text-gray-800">欢迎回来，{session.user?.name}</h1>
            <p className="text-gray-600">让我们开始今天的工作吧</p>
          </div>
        </div>
        <div className="text-gray-500 text-sm">
          {new Date().toLocaleDateString('zh-CN', { 
            year: 'numeric', 
            month: 'long', 
            day: 'numeric',
            weekday: 'long'
          })}
        </div>
      </div>
      
      {/* 数据概览卡片 */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 animate-fade-in">
        <div className="card-modern p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">学生总数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{data.studentsCount}</p>
              <p className="text-emerald-600 text-sm mt-1">活跃学生</p>
            </div>
            <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              👥
            </div>
          </div>
        </div>

        <div className="card-modern p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">活跃课程</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{data.totalEnrollments}</p>
              <p className="text-blue-600 text-sm mt-1">当前学期</p>
            </div>
            <div className="w-12 h-12 bg-gradient-success rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              📚
            </div>
          </div>
        </div>

        <Link href="/billing/unpaid" className="card-modern p-6 group cursor-pointer hover:shadow-lg transition-shadow">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">待支付学生</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{data.unpaidStudentsCount}</p>
              <p className="text-amber-600 text-sm mt-1">
                {data.currentTerm 
                  ? formatTermLabelFull(data.currentTerm.year, data.currentTerm.termIndex, data.termLabels) 
                  : '未设置学期'}
              </p>
            </div>
            <div className="w-12 h-12 bg-gradient-warning rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              💰
            </div>
          </div>
          <div className="mt-3 text-xs text-gray-500 group-hover:text-amber-600 transition-colors">
            点击查看详情 →
          </div>
        </Link>

        <div className="card-modern p-6 group">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-gray-600 text-sm font-medium">教师人数</p>
              <p className="text-3xl font-bold text-gray-800 mt-1">{data.teachersCount}</p>
              <p className="text-purple-600 text-sm mt-1">授课教师</p>
            </div>
            <div className="w-12 h-12 bg-gradient-secondary rounded-xl flex items-center justify-center text-2xl group-hover:scale-110 transition-transform">
              👨‍🏫
            </div>
          </div>
        </div>
      </div>

      {/* 功能区域 */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* 常用功能 */}
        <div className="lg:col-span-2">
          <div className="card-modern p-6 animate-fade-in">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-800">快速操作</h2>
              <span className="text-sm text-gray-500">常用功能</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Link href="/students/new" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-primary rounded-lg flex items-center justify-center text-white">
                      📝
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">注册学生</h3>
                      <p className="text-sm text-gray-500">添加新的学生信息</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/students" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-success rounded-lg flex items-center justify-center text-white">
                      👥
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-emerald-600 transition-colors">学生管理</h3>
                      <p className="text-sm text-gray-500">查看和编辑学生信息</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/search" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-secondary rounded-lg flex items-center justify-center text-white">
                      🔍
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-purple-600 transition-colors">智能查询</h3>
                      <p className="text-sm text-gray-500">快速查找学生</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/teachers" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-amber-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-warning rounded-lg flex items-center justify-center text-white">
                      👨‍🏫
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-amber-600 transition-colors">教师管理</h3>
                      <p className="text-sm text-gray-500">管理教师信息</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/billing/batch" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-blue-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-blue-500 to-cyan-500 rounded-lg flex items-center justify-center text-white">
                      ⚡
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-blue-600 transition-colors">批量结算</h3>
                      <p className="text-sm text-gray-500">按年级/班级批量生成账单</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/billing/ledger" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-emerald-500 to-green-500 rounded-lg flex items-center justify-center text-white">
                      📋
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-emerald-600 transition-colors">缴费台账</h3>
                      <p className="text-sm text-gray-500">Excel式查看每期缴费明细</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/stats" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-violet-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-violet-500 to-purple-500 rounded-lg flex items-center justify-center text-white">
                      📊
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-violet-600 transition-colors">统计分析</h3>
                      <p className="text-sm text-gray-500">多维度可选统计图表</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/admin/reports" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-pink-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-pink-500 to-rose-500 rounded-lg flex items-center justify-center text-white">
                      📊
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-pink-600 transition-colors">报表中心</h3>
                      <p className="text-sm text-gray-500">收入分析与未付统计</p>
                    </div>
                  </div>
                </div>
              </Link>

              <Link href="/schedule" className="group">
                <div className="p-4 border border-gray-200 rounded-xl hover:border-cyan-300 transition-all duration-200 hover:shadow-md">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 bg-gradient-to-r from-cyan-500 to-teal-500 rounded-lg flex items-center justify-center text-white">
                      📅
                    </div>
                    <div>
                      <h3 className="font-medium text-gray-800 group-hover:text-cyan-600 transition-colors">课表管理</h3>
                      <p className="text-sm text-gray-500">查看与管理每周课时</p>
                    </div>
                  </div>
                </div>
              </Link>
            </div>
          </div>
        </div>

        {/* 最近学生 */}
        <div className="card-modern p-6 animate-fade-in">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">最新学生</h2>
            <Link href="/students" className="text-sm text-indigo-600 hover:text-indigo-800">查看全部</Link>
          </div>
          <div className="space-y-3">
            {data.recentStudents.length > 0 ? (
              data.recentStudents.map((student) => (
                <Link key={student.id} href={`/students/${student.id}`} className="block group">
                  <div className="flex items-center space-x-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <div className="w-8 h-8 bg-gradient-primary rounded-full flex items-center justify-center text-white text-sm font-semibold">
                      {student.fullName.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">
                        {student.fullName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {student.grade?.name || '未分配年级'}
                      </p>
                    </div>
                    <svg className="w-4 h-4 text-gray-400 group-hover:text-indigo-600 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  </div>
                </Link>
              ))
            ) : (
              <div className="text-center py-8">
                <div className="w-12 h-12 bg-gray-100 rounded-xl flex items-center justify-center text-2xl mx-auto mb-3">
                  📝
                </div>
                <p className="text-gray-500 text-sm">暂无学生记录</p>
                <Link href="/students/new" className="text-indigo-600 text-sm hover:underline">
                  开始注册学生
                </Link>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 管理功能（仅管理员可见） */}
      {isAdmin && (
        <div className="card-modern p-6 animate-fade-in-up">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-semibold text-gray-800">管理功能</h2>
            <span className="px-3 py-1 bg-gradient-primary text-white text-xs rounded-full">管理员专用</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <Link href="/admin/reports" className="group">
              <div className="p-4 border border-gray-200 rounded-xl hover:border-indigo-300 transition-all duration-200 hover:shadow-md">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-primary rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 group-hover:scale-110 transition-transform">
                    📊
                  </div>
                  <h3 className="font-medium text-gray-800 group-hover:text-indigo-600 transition-colors">数据报表</h3>
                  <p className="text-sm text-gray-500 mt-1">统计分析</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/catalog" className="group">
              <div className="p-4 border border-gray-200 rounded-xl hover:border-amber-300 transition-all duration-200 hover:shadow-md">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-warning rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 group-hover:scale-110 transition-transform">
                    💰
                  </div>
                  <h3 className="font-medium text-gray-800 group-hover:text-amber-600 transition-colors">费用管理</h3>
                  <p className="text-sm text-gray-500 mt-1">费用设置</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/terms" className="group">
              <div className="p-4 border border-gray-200 rounded-xl hover:border-emerald-300 transition-all duration-200 hover:shadow-md">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-success rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 group-hover:scale-110 transition-transform">
                    📅
                  </div>
                  <h3 className="font-medium text-gray-800 group-hover:text-emerald-600 transition-colors">学期设置</h3>
                  <p className="text-sm text-gray-500 mt-1">学期管理</p>
                </div>
              </div>
            </Link>

            <Link href="/admin/users" className="group">
              <div className="p-4 border border-gray-200 rounded-xl hover:border-purple-300 transition-all duration-200 hover:shadow-md">
                <div className="text-center">
                  <div className="w-12 h-12 bg-gradient-secondary rounded-xl flex items-center justify-center text-2xl mx-auto mb-3 group-hover:scale-110 transition-transform">
                    👤
                  </div>
                  <h3 className="font-medium text-gray-800 group-hover:text-purple-600 transition-colors">用户管理</h3>
                  <p className="text-sm text-gray-500 mt-1">权限控制</p>
                </div>
              </div>
            </Link>
          </div>
        </div>
      )}
    </main>
  );
}
