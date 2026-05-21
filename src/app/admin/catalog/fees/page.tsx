import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

async function getData() {
  const [grades, courses] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.course.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { grades, courses };
}

export default async function FeesPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  const { grades, courses } = await getData();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">课程费用（按年级）</h1>
      <form action="/api/admin/catalog/fees" method="post" className="space-y-3">
        <div className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">课程</label>
            <select name="courseId" className="w-full border rounded px-3 py-2">
              {courses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">年级</label>
            <select name="gradeId" className="w-full border rounded px-3 py-2">
              {grades.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">金额（分）</label>
            <input name="amountCents" className="w-full border rounded px-3 py-2" placeholder="如 20000 表示 200.00" />
          </div>
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">新增/更新</button>
      </form>
      <div><Link href="/admin/catalog" className="text-blue-600">返回分类与费用</Link></div>
    </div>
  );
}


