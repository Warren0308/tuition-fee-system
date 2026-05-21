import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getProfile(userId: string) {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  return user;
}

export default async function ProfilePage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const userId = (session as any).userId as string;
  const me = await getProfile(userId);
  if (!me) return <div className="p-6">用户不存在</div>;
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">个人资料</h1>
      <form action="/api/profile" method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">用户名</label>
          <input name="username" defaultValue={me.username} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">邮箱</label>
          <input name="email" defaultValue={me.email ?? ''} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">电话</label>
          <input name="phone" defaultValue={me.phone ?? ''} className="w-full border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">头像 URL</label>
          <input name="avatarUrl" defaultValue={me.avatarUrl ?? ''} className="w-full border rounded px-3 py-2" />
        </div>
        <div className="md:col-span-2 border-t pt-3">
          <h2 className="font-medium mb-2">安全</h2>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm mb-1">当前密码</label>
              <input name="currentPassword" type="password" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">新密码</label>
              <input name="newPassword" type="password" className="w-full border rounded px-3 py-2" />
            </div>
            <div>
              <label className="block text-sm mb-1">确认新密码</label>
              <input name="confirmPassword" type="password" className="w-full border rounded px-3 py-2" />
            </div>
          </div>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
        </div>
      </form>
    </div>
  );
}


