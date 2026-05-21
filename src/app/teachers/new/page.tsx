import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";

export default async function NewTeacherPage() {
  const session = await getServerSession(authOptions);
  const roles = (session as any)?.roles as string[] | undefined;
  if (!session) redirect("/login?callbackUrl=/teachers/new");
  if (!roles?.includes("ADMIN")) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="card-modern p-8 text-center">
          <div className="text-4xl mb-3">⛔</div>
          <h2 className="text-xl font-bold mb-2">访问受限</h2>
          <p className="text-gray-600 mb-4">只有管理员可以添加教师</p>
          <Link href="/teachers" className="text-blue-600 hover:underline">← 返回</Link>
        </div>
      </div>
    );
  }

  // 列出未绑定 Teacher 的有 TEACHER 角色的 User
  const teacherUsers = await prisma.user.findMany({
    where: {
      roles: { some: { role: { code: "TEACHER" } } },
      teacher: null,
    },
    select: { id: true, username: true, email: true, phone: true },
    orderBy: { username: "asc" },
  });

  return (
    <div className="min-h-screen p-6">
      <div className="max-w-2xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold text-gray-800">➕ 添加教师</h1>
          <Link
            href="/teachers"
            className="text-sm text-gray-600 hover:text-gray-800"
          >
            ← 返回教师列表
          </Link>
        </div>

        <form action="/api/teachers" method="post" className="card-modern p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              教师姓名 <span className="text-red-500">*</span>
            </label>
            <input
              name="name"
              required
              className="input-modern w-full"
              placeholder="例如：李老师"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">邮箱</label>
              <input
                name="email"
                type="email"
                className="input-modern w-full"
                placeholder="可选"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">电话</label>
              <input
                name="phone"
                className="input-modern w-full"
                placeholder="可选"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              绑定登录账号（可选）
            </label>
            <select name="userId" className="input-modern w-full" defaultValue="">
              <option value="">不绑定 - 之后可在后台绑定</option>
              {teacherUsers.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.username}
                  {u.email ? ` (${u.email})` : ""}
                </option>
              ))}
            </select>
            <p className="mt-1 text-xs text-gray-500">
              绑定后，该用户登录可以看到自己负责的课程
            </p>
          </div>

          <div className="flex gap-3 pt-2">
            <Link
              href="/teachers"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
            >
              取消
            </Link>
            <button
              type="submit"
              className="flex-1 btn-modern bg-blue-600 hover:bg-blue-700 text-white py-2.5 font-semibold"
            >
              创建教师
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
