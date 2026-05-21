import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ToolActions } from "./ToolActions";
import { SeedDictsButton } from "./SeedDictsButton";

async function getStats() {
  const [
    studentsTotal,
    studentsActive,
    paymentsTotal,
    emptyPayments,
    expiredTokens,
    notificationsPending,
  ] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { isActive: true } }),
    prisma.studentTermPayment.count(),
    prisma.studentTermPayment.count({ where: { items: { none: {} } } }),
    prisma.passwordResetToken.count({
      where: {
        OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
      },
    }),
    prisma.notification.count({ where: { status: 'PENDING' } }),
  ]);
  return {
    studentsTotal,
    studentsActive,
    paymentsTotal,
    emptyPayments,
    expiredTokens,
    notificationsPending,
  };
}

export default async function AdminToolsPage({
  searchParams,
}: {
  searchParams?: { success?: string; error?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">🔒</div>
          <h2 className="text-xl font-bold mb-2">需要登录</h2>
          <Link className="text-blue-600 hover:underline" href="/login">
            立即登录
          </Link>
        </div>
      </div>
    );
  }

  const roles = (session as any).roles as string[] | undefined;
  const isAdmin = roles?.includes("ADMIN");
  if (!isAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center max-w-md">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-xl font-bold mb-2">权限不足</h2>
          <p className="text-gray-600 mb-4">此页面仅管理员可访问</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← 返回工作台
          </Link>
        </div>
      </div>
    );
  }

  const stats = await getStats();

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">🛠️</span>
            管理工具
          </h1>
          <p className="text-gray-600 mt-1">系统数据导出、清理和测试工具</p>
        </div>
        <Link
          href="/admin"
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
        >
          ← 返回管理后台
        </Link>
      </div>

      {searchParams?.success === "mail-sent" && (
        <div className="card-modern p-4 bg-emerald-50 border border-emerald-200 text-emerald-700">
          ✅ 测试邮件已发送
        </div>
      )}
      {searchParams?.error === "mail-failed" && (
        <div className="card-modern p-4 bg-red-50 border border-red-200 text-red-700">
          ❌ 邮件发送失败，请检查 SMTP 配置
        </div>
      )}

      {/* 系统统计 */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard label="学生总数" value={stats.studentsTotal} hint={`活跃 ${stats.studentsActive}`} />
        <StatCard label="账单总数" value={stats.paymentsTotal} hint={`空账单 ${stats.emptyPayments}`} />
        <StatCard label="过期令牌" value={stats.expiredTokens} hint="待清理" />
        <StatCard label="待发通知" value={stats.notificationsPending} hint="PENDING 状态" />
      </div>

      {/* 数据导出 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>📥</span>
          数据导出 (CSV)
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <a
            href="/api/admin/tools/export/students"
            download
            className="block p-4 bg-gradient-to-br from-blue-50 to-indigo-50 border border-blue-200 rounded-lg hover:shadow-md transition-all group"
          >
            <div className="text-3xl mb-2">👥</div>
            <div className="font-medium text-gray-800">学生数据</div>
            <div className="text-xs text-gray-600 mt-1">含监护人、选课信息</div>
            <div className="mt-2 text-xs text-blue-600 group-hover:underline">
              点击下载 →
            </div>
          </a>
          <a
            href="/api/admin/tools/export/enrollments"
            download
            className="block p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-lg hover:shadow-md transition-all group"
          >
            <div className="text-3xl mb-2">📚</div>
            <div className="font-medium text-gray-800">选课数据</div>
            <div className="text-xs text-gray-600 mt-1">所有选课记录</div>
            <div className="mt-2 text-xs text-green-600 group-hover:underline">
              点击下载 →
            </div>
          </a>
          <a
            href="/api/admin/tools/export/payments"
            download
            className="block p-4 bg-gradient-to-br from-purple-50 to-pink-50 border border-purple-200 rounded-lg hover:shadow-md transition-all group"
          >
            <div className="text-3xl mb-2">💰</div>
            <div className="font-medium text-gray-800">缴费数据</div>
            <div className="text-xs text-gray-600 mt-1">账单与明细</div>
            <div className="mt-2 text-xs text-purple-600 group-hover:underline">
              点击下载 →
            </div>
          </a>
        </div>
      </section>

      {/* 数据清理 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>🧹</span>
          数据清理
        </h2>
        <ToolActions
          emptyPayments={stats.emptyPayments}
          expiredTokens={stats.expiredTokens}
        />
      </section>

      {/* 字典初始化 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>📋</span>
          初始化数据
        </h2>
        <p className="text-sm text-gray-600 mb-3">
          一键初始化年级、学校、监护人关系等基础字典。已存在的项目会被跳过。
        </p>
        <SeedDictsButton />
      </section>

      {/* 邮件测试 */}
      <section className="card-modern p-6">
        <h2 className="text-lg font-semibold text-gray-800 mb-4 flex items-center gap-2">
          <span>📧</span>
          邮件功能测试
        </h2>
        <form
          action="/api/admin/tools/mail-test"
          method="post"
          className="flex flex-wrap items-center gap-2"
        >
          <input
            type="email"
            name="email"
            placeholder="收件人邮箱"
            required
            className="flex-1 min-w-[200px] px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          />
          <button
            type="submit"
            className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
          >
            发送测试邮件
          </button>
        </form>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
}: {
  label: string;
  value: number;
  hint?: string;
}) {
  return (
    <div className="card-modern p-4">
      <div className="text-sm text-gray-500">{label}</div>
      <div className="text-3xl font-bold text-gray-800 mt-1">{value}</div>
      {hint && <div className="text-xs text-gray-500 mt-1">{hint}</div>}
    </div>
  );
}
