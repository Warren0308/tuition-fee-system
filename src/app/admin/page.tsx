import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminIndexPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">管理层</h1>
      <div className="grid sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Link href="/admin/terms" className="px-4 py-3 bg-gray-200 rounded text-center">学期设置</Link>
        <Link href="/admin/catalog" className="px-4 py-3 bg-gray-200 rounded text-center">分类与费用</Link>
        <Link href="/admin/users" className="px-4 py-3 bg-gray-200 rounded text-center">用户与权限</Link>
        <Link href="/admin/reports" className="px-4 py-3 bg-gray-200 rounded text-center">报表</Link>
        <Link href="/admin/tools" className="px-4 py-3 bg-gray-200 rounded text-center">管理工具</Link>
      </div>
    </div>
  );
}


