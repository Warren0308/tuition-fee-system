import { prisma } from "@/lib/prisma";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

async function getData() {
  const [grades, schools, guardians] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.guardianType.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { grades, schools, guardians };
}

export default async function DictsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  const { grades, schools, guardians } = await getData();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">字典（年级/学校/监护人关系）</h1>
      <div className="grid md:grid-cols-3 gap-4">
        <div>
          <h2 className="font-medium mb-2">年级</h2>
          <form action="/api/admin/dicts/grade" method="post" className="flex gap-2 mb-2">
            <input name="name" placeholder="名称" className="border rounded px-2 py-1" />
            <input name="orderIndex" placeholder="排序" className="border rounded px-2 py-1 w-20" />
            <button className="px-3 py-1 bg-gray-200 rounded">新增</button>
          </form>
          <ul className="text-sm space-y-1">
            {grades.map(g => (<li key={g.id}>{g.orderIndex}. {g.name}</li>))}
          </ul>
        </div>
        <div>
          <h2 className="font-medium mb-2">学校</h2>
          <form action="/api/admin/dicts/school" method="post" className="flex gap-2 mb-2">
            <input name="name" placeholder="名称" className="border rounded px-2 py-1" />
            <button className="px-3 py-1 bg-gray-200 rounded">新增</button>
          </form>
          <ul className="text-sm space-y-1">
            {schools.map(s => (<li key={s.id}>{s.name}</li>))}
          </ul>
        </div>
        <div>
          <h2 className="font-medium mb-2">监护人关系</h2>
          <form action="/api/admin/dicts/guardian" method="post" className="flex gap-2 mb-2">
            <input name="name" placeholder="名称" className="border rounded px-2 py-1" />
            <button className="px-3 py-1 bg-gray-200 rounded">新增</button>
          </form>
          <ul className="text-sm space-y-1">
            {guardians.map(g => (<li key={g.id}>{g.name}</li>))}
          </ul>
        </div>
      </div>
      <div><Link href="/admin/catalog" className="text-blue-600">返回分类与费用</Link></div>
    </div>
  );
}


