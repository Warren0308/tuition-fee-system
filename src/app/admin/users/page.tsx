import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

async function getData() {
  const users = await prisma.user.findMany({
    orderBy: { createdAt: "desc" },
    include: { roles: { include: { role: true } } },
  });
  const roles = await prisma.role.findMany({ orderBy: { id: "asc" } });
  return { users, roles };
}

export default async function AdminUsersPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  const { users, roles } = await getData();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">用户与权限</h1>
      <form action="/api/admin/users/create" method="post" className="flex gap-2 items-end">
        <div>
          <label className="block text-sm mb-1">用户名</label>
          <input name="username" className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">初始密码</label>
          <input name="password" className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">角色</label>
          <select name="roleCode" className="border rounded px-3 py-2">
            {roles.map(r => (<option key={r.id} value={r.code}>{r.name}</option>))}
          </select>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">创建</button>
      </form>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">用户名</th>
            <th className="p-2 border">角色</th>
            <th className="p-2 border">状态</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {users.map(u => (
            <tr key={u.id}>
              <td className="p-2 border">{u.username}</td>
              <td className="p-2 border">{u.roles.map(ur => ur.role.name).join("、")}</td>
              <td className="p-2 border">{u.isActive ? "启用" : "禁用"}</td>
              <td className="p-2 border">
                <form action="/api/admin/users/toggle" method="post" className="inline">
                  <input type="hidden" name="userId" value={u.id} />
                  <button className="px-3 py-1 bg-gray-200 rounded">{u.isActive ? "禁用" : "启用"}</button>
                </form>
                <form action="/api/admin/users/role" method="post" className="inline ml-2">
                  <input type="hidden" name="userId" value={u.id} />
                  <select name="roleCode" className="border rounded px-2 py-1">
                    {roles.map(r => (<option key={r.id} value={r.code}>{r.name}</option>))}
                  </select>
                  <button name="_action" value="add" className="px-3 py-1 bg-gray-200 rounded ml-1">添加角色</button>
                  <button name="_action" value="remove" className="px-3 py-1 bg-gray-200 rounded ml-1">移除角色</button>
                </form>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="pt-2"><Link href="/admin" className="text-blue-600">返回管理首页</Link></div>
    </div>
  );
}


