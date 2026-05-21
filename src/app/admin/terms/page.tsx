import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";

async function getData() {
  const year = new Date().getFullYear();
  const configs = await prisma.termConfig.findMany({ where: { year: { gte: year - 1 } }, orderBy: { year: "desc" } });
  const terms = await prisma.term.findMany({ where: { year: { gte: year - 1 } }, orderBy: [{ year: "desc" }, { termIndex: "asc" }] });
  return { configs, terms };
}

export default async function AdminTermsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const { configs, terms } = await getData();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">学期设置（Term1 起始日）</h1>
      <form action="/api/term-config" method="post" className="flex items-end gap-2">
        <div>
          <label className="block text-sm mb-1">学年</label>
          <input name="year" type="number" defaultValue={new Date().getFullYear()} className="border rounded px-3 py-2" />
        </div>
        <div>
          <label className="block text-sm mb-1">Term1 起始日期</label>
          <input name="term1Date" type="date" className="border rounded px-3 py-2" />
        </div>
        <button className="bg-blue-600 text-white rounded px-4 py-2">保存</button>
      </form>
      <div>
        <form action="/api/term/generate" method="post" className="flex items-end gap-2">
          <div>
            <label className="block text-sm mb-1">按学年生成13个学期</label>
            <input name="year" type="number" defaultValue={new Date().getFullYear()} className="border rounded px-3 py-2" />
          </div>
          <button className="bg-gray-800 text-white rounded px-4 py-2">生成/重算</button>
        </form>
      </div>
      <table className="min-w-[400px] border">
        <thead>
          <tr className="bg-gray-100"><th className="p-2 border">学年</th><th className="p-2 border">Term1</th></tr>
        </thead>
        <tbody>
          {configs.map(c => (
            <tr key={c.id}>
              <td className="p-2 border">{c.year}</td>
              <td className="p-2 border">{new Date(c.term1Date).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div>
        <h2 className="font-medium mt-4 mb-2">已生成学期</h2>
        <table className="min-w-[600px] border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">学年</th>
              <th className="p-2 border">学期</th>
              <th className="p-2 border">开始</th>
              <th className="p-2 border">结束</th>
              <th className="p-2 border">操作</th>
            </tr>
          </thead>
          <tbody>
            {terms.map(t => (
              <tr key={t.id}>
                <td className="p-2 border">{t.year}</td>
                <td className="p-2 border">{t.termIndex}</td>
                <td className="p-2 border">{new Date(t.startDate).toLocaleDateString()}</td>
                <td className="p-2 border">{new Date(t.endDate).toLocaleDateString()}</td>
                <td className="p-2 border">
                  <form action={`/api/term/${t.id}`} method="post" className="flex items-center gap-2">
                    <input type="date" name="startDate" className="border rounded px-2 py-1" />
                    <button className="px-3 py-1 bg-gray-200 rounded">修改开始</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
