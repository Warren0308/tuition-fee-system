import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { canAccessStats } from "@/lib/roles";
import Link from "next/link";
import { StatsClient } from "./StatsClient";

export default async function StatsPage() {
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

  const roles = ((session as any).roles as string[]) || [];
  if (!canAccessStats(roles)) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center max-w-md">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">统计分析仅管理员可查看</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">
            ← 返回工作台
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen p-4 md:p-6 space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">📊</span>
            统计分析
          </h1>
          <p className="text-gray-600 mt-1 text-sm">
            2026 学年全方位数据概览，可自由选择显示维度
          </p>
        </div>
        <Link
          href="/dashboard"
          className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50 text-sm"
        >
          ← 返回工作台
        </Link>
      </div>

      <StatsClient />
    </div>
  );
}
