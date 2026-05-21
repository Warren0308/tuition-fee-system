import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

const PAGE_SIZE = 50;

const ENTITY_LABELS: Record<string, string> = {
  StudentTermPayment: "账单",
  Term: "学期",
  School: "学校",
  Grade: "年级",
  GuardianType: "监护人关系",
  Course: "课程",
  CourseType: "课程类型",
  Teacher: "教师",
  Student: "学生",
  CourseSchedule: "课表",
};

const ACTION_LABELS: Record<string, string> = {
  CREATE: "创建",
  UPDATE: "更新",
  DELETE: "删除",
  CREATE_OR_UPDATE: "保存账单",
  BATCH_CREATE: "批量创建",
  EDIT: "编辑账单",
  UPDATE_DATE: "调整日期",
};

const ACTION_COLORS: Record<string, string> = {
  CREATE: "bg-emerald-100 text-emerald-700",
  CREATE_OR_UPDATE: "bg-blue-100 text-blue-700",
  BATCH_CREATE: "bg-purple-100 text-purple-700",
  UPDATE: "bg-blue-100 text-blue-700",
  UPDATE_DATE: "bg-amber-100 text-amber-700",
  EDIT: "bg-blue-100 text-blue-700",
  DELETE: "bg-red-100 text-red-700",
};

export default async function AuditLogPage({
  searchParams,
}: {
  searchParams?: { page?: string; entity?: string; action?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) redirect("/login?callbackUrl=/admin/audit");

  const roles = (session as any).roles as string[] | undefined;
  if (!roles?.includes("ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">只有管理员可以查看审计日志</p>
          <Link href="/dashboard" className="text-blue-600 hover:underline">← 返回工作台</Link>
        </div>
      </div>
    );
  }

  const page = Math.max(1, Number(searchParams?.page) || 1);
  const skip = (page - 1) * PAGE_SIZE;
  const filter: any = {};
  if (searchParams?.entity) filter.entityName = searchParams.entity;
  if (searchParams?.action) filter.action = searchParams.action;

  const [logs, total] = await Promise.all([
    prisma.auditLog.findMany({
      where: filter,
      orderBy: { createdAt: "desc" },
      skip,
      take: PAGE_SIZE,
    }),
    prisma.auditLog.count({ where: filter }),
  ]);

  // 用户名映射
  const userIds = Array.from(new Set(logs.map((l) => l.actorUserId).filter((id): id is string => !!id)));
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, username: true },
  });
  const userMap = new Map(users.map((u) => [u.id, u.username]));

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  // 所有可选的实体和动作（用于筛选）
  const [entitiesAgg, actionsAgg] = await Promise.all([
    prisma.auditLog.findMany({ select: { entityName: true }, distinct: ["entityName"] }),
    prisma.auditLog.findMany({ select: { action: true }, distinct: ["action"] }),
  ]);

  const buildUrl = (overrides: Partial<{ page: number; entity: string; action: string }>) => {
    const params = new URLSearchParams();
    const e = overrides.entity ?? searchParams?.entity;
    const a = overrides.action ?? searchParams?.action;
    const p = overrides.page ?? page;
    if (e) params.set("entity", e);
    if (a) params.set("action", a);
    if (p > 1) params.set("page", String(p));
    return `?${params.toString()}`;
  };

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-6xl mx-auto space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
              <span className="text-3xl">📜</span>
              审计日志
            </h1>
            <p className="text-gray-600 mt-1">
              记录所有关键的数据变更操作 · 共 {total} 条
            </p>
          </div>
          <Link
            href="/admin"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← 返回管理面板
          </Link>
        </div>

        {/* 筛选 */}
        <div className="card-modern p-3">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm text-gray-600">筛选：</span>
            <Link
              href="/admin/audit"
              className={`px-3 py-1.5 rounded text-sm ${
                !searchParams?.entity && !searchParams?.action
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 hover:bg-gray-200 text-gray-700"
              }`}
            >
              全部
            </Link>
            {entitiesAgg.map((e) => (
              <Link
                key={e.entityName}
                href={buildUrl({ page: 1, entity: e.entityName })}
                className={`px-3 py-1.5 rounded text-sm ${
                  searchParams?.entity === e.entityName
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                }`}
              >
                {ENTITY_LABELS[e.entityName] || e.entityName}
              </Link>
            ))}
          </div>
        </div>

        {/* 日志列表 */}
        <div className="card-modern overflow-hidden">
          {logs.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <div className="text-4xl mb-3">📭</div>
              <p>暂无日志</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {logs.map((log) => {
                const before = log.before ? safeParseJson(log.before) : null;
                const after = log.after ? safeParseJson(log.after) : null;
                const username = log.actorUserId ? userMap.get(log.actorUserId) || "未知用户" : "系统";
                const actionColor = ACTION_COLORS[log.action] || "bg-gray-100 text-gray-700";
                const actionLabel = ACTION_LABELS[log.action] || log.action;
                const entityLabel = ENTITY_LABELS[log.entityName] || log.entityName;

                return (
                  <div key={log.id} className="p-4 hover:bg-gray-50">
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 text-xs font-medium rounded ${actionColor}`}>
                          {actionLabel}
                        </span>
                        <span className="font-semibold text-gray-800">{entityLabel}</span>
                        {log.entityId && (
                          <span className="text-xs text-gray-400 font-mono">#{log.entityId.slice(0, 8)}</span>
                        )}
                      </div>
                      <div className="text-xs text-gray-500 whitespace-nowrap">
                        {new Date(log.createdAt).toLocaleString("zh-CN", { hour12: false })}
                      </div>
                    </div>
                    <div className="text-sm text-gray-600 mb-2">
                      操作人：<span className="font-medium">{username}</span>
                    </div>
                    {(before || after) && (
                      <details className="text-xs">
                        <summary className="cursor-pointer text-blue-600 hover:underline">
                          查看变更详情
                        </summary>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mt-2">
                          {before && (
                            <div className="bg-red-50 border border-red-100 p-2 rounded">
                              <div className="font-semibold text-red-700 mb-1">变更前</div>
                              <pre className="text-xs overflow-x-auto text-gray-700">
                                {JSON.stringify(before, null, 2)}
                              </pre>
                            </div>
                          )}
                          {after && (
                            <div className="bg-emerald-50 border border-emerald-100 p-2 rounded">
                              <div className="font-semibold text-emerald-700 mb-1">变更后</div>
                              <pre className="text-xs overflow-x-auto text-gray-700">
                                {JSON.stringify(after, null, 2)}
                              </pre>
                            </div>
                          )}
                        </div>
                      </details>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {totalPages > 1 && (
            <div className="flex items-center justify-between px-4 py-3 border-t bg-gray-50">
              <div className="text-sm text-gray-500">
                第 {page} / {totalPages} 页
              </div>
              <div className="flex gap-1">
                {page > 1 && (
                  <Link
                    href={buildUrl({ page: page - 1 })}
                    className="px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-100"
                  >
                    ← 上一页
                  </Link>
                )}
                {page < totalPages && (
                  <Link
                    href={buildUrl({ page: page + 1 })}
                    className="px-3 py-1.5 bg-white border rounded text-sm hover:bg-gray-100"
                  >
                    下一页 →
                  </Link>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function safeParseJson(text: string) {
  try {
    return JSON.parse(text);
  } catch {
    return text;
  }
}
