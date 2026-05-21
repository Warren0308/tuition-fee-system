import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { StudentFilters } from "./StudentFilters";

const PAGE_SIZE = 30;

interface SearchParams {
  q?: string;
  gradeId?: string;
  schoolId?: string;
  className?: string;
  status?: "active" | "inactive" | "all";
  page?: string;
}

async function getFilters() {
  const [grades, schools, classNames] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.student.findMany({
      where: { className: { not: null } },
      select: { className: true },
      distinct: ["className"],
      orderBy: { className: "asc" },
    }),
  ]);
  return {
    grades,
    schools,
    classNames: classNames.map((c) => c.className).filter((c): c is string => !!c),
  };
}

async function getStudents(params: SearchParams) {
  const page = Math.max(1, Number(params.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;

  const where: any = {};
  if (params.q && params.q.trim()) {
    where.fullName = { contains: params.q.trim() };
  }
  if (params.gradeId) where.gradeId = Number(params.gradeId);
  if (params.schoolId) where.schoolId = Number(params.schoolId);
  if (params.className) where.className = params.className;
  if (params.status === "active") where.isActive = true;
  else if (params.status === "inactive") where.isActive = false;
  // default "all" - 不加 isActive 过滤

  const [list, total] = await Promise.all([
    prisma.student.findMany({
      where,
      orderBy: [{ isActive: "desc" }, { createdAt: "desc" }],
      include: {
        grade: true,
        school: true,
        enrollments: {
          where: { endTermId: null },
          include: { course: true },
        },
        guardians: {
          where: { isPrimary: true },
          include: { relationType: true },
          take: 1,
        },
      },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.student.count({ where }),
  ]);

  return { list, total, page, totalPages: Math.max(1, Math.ceil(total / PAGE_SIZE)) };
}

async function getStats() {
  const [totalStudents, activeStudents] = await Promise.all([
    prisma.student.count(),
    prisma.student.count({ where: { isActive: true } }),
  ]);
  return { totalStudents, activeStudents };
}

export default async function StudentsPage({
  searchParams,
}: {
  searchParams?: SearchParams;
}) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">🔒</div>
          <Link className="text-blue-600 hover:underline" href="/login">立即登录</Link>
        </div>
      </div>
    );
  }

  const params = searchParams || {};
  const [{ list, total, page, totalPages }, stats, filters] = await Promise.all([
    getStudents(params),
    getStats(),
    getFilters(),
  ]);

  // 构造分页 URL
  const buildPageUrl = (p: number) => {
    const qs = new URLSearchParams();
    if (params.q) qs.set("q", params.q);
    if (params.gradeId) qs.set("gradeId", params.gradeId);
    if (params.schoolId) qs.set("schoolId", params.schoolId);
    if (params.className) qs.set("className", params.className);
    if (params.status) qs.set("status", params.status);
    qs.set("page", String(p));
    return `?${qs.toString()}`;
  };

  const hasFilter = !!(params.q || params.gradeId || params.schoolId || params.className || (params.status && params.status !== "all"));

  return (
    <div className="min-h-screen p-6 space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <span className="text-3xl">👥</span>
            学生管理
          </h1>
          <p className="text-gray-600 mt-1">
            全部 {stats.totalStudents} 位 · 在读 {stats.activeStudents} 位
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Link
            href="/students/new"
            className="btn-modern bg-gradient-primary text-white px-4 py-2"
          >
            ➕ 注册学生
          </Link>
          <Link
            href="/students/import"
            className="btn-modern bg-white border border-gray-200 text-gray-700 px-4 py-2 hover:bg-gray-50"
          >
            📤 批量导入
          </Link>
        </div>
      </div>

      {/* 搜索与过滤 */}
      <StudentFilters
        initialQ={params.q || ""}
        initialGradeId={params.gradeId || ""}
        initialSchoolId={params.schoolId || ""}
        initialClassName={params.className || ""}
        initialStatus={params.status || "active"}
        grades={filters.grades}
        schools={filters.schools}
        classNames={filters.classNames}
      />

      {/* 结果信息 */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="text-sm text-gray-600">
          {hasFilter ? (
            <>找到 <span className="font-semibold text-gray-800">{total}</span> 位学生</>
          ) : (
            <>共 <span className="font-semibold text-gray-800">{total}</span> 位学生</>
          )}
        </div>
        {totalPages > 1 && (
          <div className="text-sm text-gray-500">
            第 {page} / {totalPages} 页
          </div>
        )}
      </div>

      {/* 学生列表 */}
      <div className="card-modern overflow-hidden">
        {list.length === 0 ? (
          <div className="p-12 text-center">
            <div className="text-5xl mb-3">🔍</div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              {hasFilter ? "未找到匹配的学生" : "暂无学生"}
            </h3>
            <p className="text-gray-500 mb-4">
              {hasFilter ? "试着调整筛选条件" : "开始注册第一位学生吧"}
            </p>
            {hasFilter ? (
              <Link
                href="/students"
                className="inline-block px-4 py-2 bg-gray-100 text-gray-700 rounded hover:bg-gray-200"
              >
                清除筛选
              </Link>
            ) : (
              <Link
                href="/students/new"
                className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              >
                注册学生
              </Link>
            )}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600">学生</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden md:table-cell">年级 / 班级</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden lg:table-cell">学校</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden xl:table-cell">在读课程</th>
                  <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 hidden lg:table-cell">主联系人</th>
                  <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600">操作</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {list.map((s) => (
                  <tr
                    key={s.id}
                    className={`hover:bg-blue-50/50 transition-colors ${s.isActive ? "" : "opacity-60"}`}
                  >
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-gradient-primary rounded-full flex items-center justify-center text-white font-semibold">
                          {s.fullName.charAt(0)}
                        </div>
                        <div>
                          <div className="font-medium text-gray-800">{s.fullName}</div>
                          <div className="text-xs text-gray-500 flex items-center gap-1">
                            {!s.isActive && (
                              <span className="px-1.5 py-0.5 bg-red-100 text-red-700 rounded text-[10px]">已停用</span>
                            )}
                            <span className="md:hidden">{s.grade?.name}{s.className ? ` · ${s.className}` : ""}</span>
                          </div>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="text-sm font-medium text-gray-800">{s.grade?.name || "-"}</div>
                      <div className="text-xs text-gray-500">{s.className || ""}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 hidden lg:table-cell">
                      {s.school?.name || <span className="text-gray-400">-</span>}
                    </td>
                    <td className="px-4 py-3 hidden xl:table-cell">
                      {s.enrollments.length === 0 ? (
                        <span className="text-xs text-gray-400">无</span>
                      ) : (
                        <div className="flex flex-wrap gap-1">
                          {s.enrollments.slice(0, 3).map((en) => (
                            <span
                              key={en.id}
                              className="px-1.5 py-0.5 bg-blue-50 text-blue-700 text-xs rounded"
                            >
                              {en.course.name}
                            </span>
                          ))}
                          {s.enrollments.length > 3 && (
                            <span className="text-xs text-gray-500">+{s.enrollments.length - 3}</span>
                          )}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      {s.guardians[0] ? (
                        <div>
                          <div className="text-sm font-medium text-gray-800">{s.guardians[0].name}</div>
                          <div className="text-xs text-gray-500">{s.guardians[0].phone}</div>
                        </div>
                      ) : (
                        <span className="text-xs text-gray-400">未填写</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Link
                          href={`/students/${s.id}`}
                          className="px-2.5 py-1 bg-blue-100 text-blue-700 rounded text-xs hover:bg-blue-200"
                          title="详情"
                        >
                          详情
                        </Link>
                        <Link
                          href={`/billing/${s.id}`}
                          className="px-2.5 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                          title="结算"
                        >
                          结算
                        </Link>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* 分页 */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 bg-gray-50">
            <div className="text-sm text-gray-500">
              显示 {(page - 1) * PAGE_SIZE + 1} - {Math.min(page * PAGE_SIZE, total)} / {total}
            </div>
            <div className="flex items-center gap-1">
              {page > 1 && (
                <Link
                  href={buildPageUrl(page - 1)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-100"
                >
                  ← 上一页
                </Link>
              )}
              <span className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm">
                {page}
              </span>
              {page < totalPages && (
                <Link
                  href={buildPageUrl(page + 1)}
                  className="px-3 py-1.5 bg-white border border-gray-200 rounded text-sm hover:bg-gray-100"
                >
                  下一页 →
                </Link>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
