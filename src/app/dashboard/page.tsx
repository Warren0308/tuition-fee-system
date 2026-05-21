import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function DashboardPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  return (
    <main className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">主页面</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        <Link href="/students/new" className="px-4 py-3 bg-blue-600 text-white rounded text-center">注册学生资料</Link>
        <Link href="/students" className="px-4 py-3 bg-gray-200 rounded text-center">修改学生资料</Link>
        <Link href="/billing" className="px-4 py-3 bg-gray-200 rounded text-center">学生课程与费用</Link>
        <Link href="/search" className="px-4 py-3 bg-gray-200 rounded text-center">查询学生/班级</Link>
      </div>
    </main>
  );
}


