import Link from "next/link";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";

export default async function HomePage() {
  const session = await getServerSession(authOptions);
  const isAuthed = Boolean(session);
  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold">学生收费系统</h1>
        <p className="text-gray-600">优特补习学院</p>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {!isAuthed && (
          <Link href="/login" className="px-4 py-3 bg-blue-600 text-white rounded text-center">登录</Link>
        )}
        {isAuthed && (
          <>
            <Link href="/dashboard" className="px-4 py-3 bg-blue-600 text-white rounded text-center">主页面</Link>
            <Link href="/students" className="px-4 py-3 bg-gray-200 rounded text-center">学生资料</Link>
            <Link href="/teachers" className="px-4 py-3 bg-gray-200 rounded text-center">老师资料</Link>
            <Link href="/profile" className="px-4 py-3 bg-gray-200 rounded text-center">个人资料</Link>
            <Link href="/admin" className="px-4 py-3 bg-gray-200 rounded text-center">管理层</Link>
          </>
        )}
        <Link href="/admin/terms" className="px-4 py-3 bg-gray-200 rounded text-center">学期设置</Link>
      </div>
    </main>
  );
}
