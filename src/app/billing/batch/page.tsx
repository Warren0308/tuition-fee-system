import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getCurrentOrLatestTerm } from "@/lib/billing-utils";
import { getAcademicYearTerms } from "@/lib/academic-year";
import Link from "next/link";
import { BatchBillingClient } from "./BatchBillingClient";

export default async function BatchBillingPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <Link className="text-blue-600 hover:underline" href="/login">请先登录</Link>
        </div>
      </div>
    );
  }

  const user = await prisma.user.findUnique({
    where: { username: session.user?.name || "" },
    include: { roles: { include: { role: true } } },
  });
  const hasAccess = user?.roles.some((r) => ["ADMIN", "RECIPIENT"].includes(r.role.code));
  if (!hasAccess) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">只有管理员和收费员可以使用批量结算</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">← 返回工作台</Link>
        </div>
      </div>
    );
  }

  let grades, schools, currentTerm, allTerms;
  try {
    [grades, schools, currentTerm, allTerms] = await Promise.all([
      prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
      prisma.school.findMany({ orderBy: { name: "asc" } }),
      getCurrentOrLatestTerm(),
      getAcademicYearTerms(),
    ]);
  } catch (e) {
    console.error("BatchBillingPage data fetch error:", e);
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-4">⚠️</div>
          <h2 className="text-xl font-bold mb-2">数据加载失败</h2>
          <p className="text-gray-600 mb-4">请刷新页面重试</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">← 返回工作台</Link>
        </div>
      </div>
    );
  }

  const initialTerm = currentTerm
    ? { year: currentTerm.year, termIndex: currentTerm.termIndex }
    : allTerms[0]
      ? { year: allTerms[0].year, termIndex: allTerms[0].termIndex }
      : { year: new Date().getFullYear(), termIndex: 1 };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">⚡</span>
              批量结算
            </h1>
            <p className="text-gray-600 mt-1">
              按年级、班级或学校筛选学生，批量为他们生成本学期账单
            </p>
          </div>
          <Link
            href="/dashboard"
            className="btn-modern bg-white shadow-sm text-gray-700 px-4 py-2 border border-gray-200 hover:bg-gray-50"
          >
            ← 返回工作台
          </Link>
        </div>

        <BatchBillingClient
          grades={grades}
          schools={schools}
          terms={allTerms.map((t) => ({
            year: t.year,
            termIndex: t.termIndex,
            period: t.period,
          }))}
          initialYear={initialTerm.year}
          initialTermIndex={initialTerm.termIndex}
        />
      </div>
    </div>
  );
}
