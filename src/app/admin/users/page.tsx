import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

async function getData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "asc" },
    include: { roles: { include: { role: true } } },
  });
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  return { users, roles };
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams?: { msg?: string };
}) {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  const { users, roles } = await getData();

  const msgMap: Record<string, string> = {
    password_reset: "✅ 密码已修改，该用户当前 session 将在 60 秒内自动失效",
    logged_out: "✅ 已强制登出，该用户当前 session 将在 60 秒内自动失效",
  };
  const msg = searchParams?.msg ? msgMap[searchParams.msg] : null;

  return (
    <div className="p-6 space-y-6 max-w-4xl">
      <h1 className="text-xl font-semibold">用户与权限管理</h1>

      {msg && (
        <div className="bg-green-50 border border-green-200 rounded-lg px-4 py-3 text-green-800 text-sm">
          {msg}
        </div>
      )}

      {/* 创建用户 */}
      <div className="border rounded-lg p-4 bg-gray-50">
        <h2 className="font-medium mb-3">创建新用户</h2>
        <form action="/api/admin/users/create" method="post" className="flex flex-wrap gap-2 items-end">
          <div>
            <label className="block text-xs mb-1 text-gray-600">用户名</label>
            <input name="username" className="border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1 text-gray-600">初始密码</label>
            <input name="password" type="password" className="border rounded px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-xs mb-1 text-gray-600">角色</label>
            <select name="roleCode" className="border rounded px-3 py-2 text-sm">
              {roles.map((r) => (
                <option key={r.id} value={r.code}>{r.name}</option>
              ))}
            </select>
          </div>
          <button className="px-4 py-2 bg-blue-600 text-white rounded text-sm">创建</button>
        </form>
      </div>

      {/* 用户列表 */}
      <div className="border rounded-lg overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="bg-gray-100 text-left">
              <th className="p-3 border-b">用户名</th>
              <th className="p-3 border-b">角色</th>
              <th className="p-3 border-b">状态</th>
              <th className="p-3 border-b min-w-[380px]">操作</th>
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b last:border-0 align-top">
                <td className="p-3 font-medium">{u.username}</td>
                <td className="p-3 text-gray-600">{u.roles.map((ur) => ur.role.name).join("、") || "-"}</td>
                <td className="p-3">
                  <span className={`px-2 py-0.5 rounded text-xs font-medium ${u.isActive ? "bg-green-100 text-green-700" : "bg-red-100 text-red-700"}`}>
                    {u.isActive ? "启用" : "禁用"}
                  </span>
                </td>
                <td className="p-3">
                  <div className="flex flex-wrap gap-2 items-center">
                    {/* 启用/禁用 */}
                    <form action="/api/admin/users/toggle" method="post" className="inline">
                      <input type="hidden" name="userId" value={u.id} />
                      <button className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">
                        {u.isActive ? "禁用" : "启用"}
                      </button>
                    </form>

                    {/* 强制登出 */}
                    <form action="/api/admin/users/force-logout" method="post" className="inline">
                      <input type="hidden" name="userId" value={u.id} />
                      <button
                        className="px-2 py-1 bg-orange-100 text-orange-700 rounded text-xs hover:bg-orange-200"
                        title="使该用户当前所有 session 失效（≤60s 生效）"
                      >
                        强制登出
                      </button>
                    </form>

                    {/* 修改密码 */}
                    <details className="inline relative">
                      <summary className="px-2 py-1 bg-yellow-100 text-yellow-800 rounded text-xs cursor-pointer hover:bg-yellow-200 list-none">
                        修改密码 ▾
                      </summary>
                      <div className="absolute z-10 mt-1 bg-white border rounded-lg shadow-lg p-3 min-w-[220px]">
                        <form action="/api/admin/users/reset-password" method="post" className="space-y-2">
                          <input type="hidden" name="userId" value={u.id} />
                          <div>
                            <label className="block text-xs text-gray-600 mb-1">新密码（≥4位）</label>
                            <input
                              name="newPassword"
                              type="password"
                              placeholder="输入新密码"
                              className="border rounded px-2 py-1 text-sm w-full"
                              required
                              minLength={4}
                            />
                          </div>
                          <button className="w-full px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700">
                            确认修改（同时登出）
                          </button>
                        </form>
                      </div>
                    </details>

                    {/* 角色管理 */}
                    <form action="/api/admin/users/role" method="post" className="inline flex gap-1">
                      <input type="hidden" name="userId" value={u.id} />
                      <select name="roleCode" className="border rounded px-1 py-1 text-xs">
                        {roles.map((r) => (
                          <option key={r.id} value={r.code}>{r.name}</option>
                        ))}
                      </select>
                      <button name="_action" value="add" className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">+角色</button>
                      <button name="_action" value="remove" className="px-2 py-1 bg-gray-200 rounded text-xs hover:bg-gray-300">-角色</button>
                    </form>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="pt-2">
        <Link href="/admin" className="text-blue-600 text-sm">← 返回管理首页</Link>
      </div>
    </div>
  );
}
