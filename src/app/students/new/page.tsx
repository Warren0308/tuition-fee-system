import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getOptions() {
  const [grades, schools, guardianTypes] = await Promise.all([
    prisma.grade.findMany({ orderBy: { orderIndex: "asc" } }),
    prisma.school.findMany({ orderBy: { name: "asc" } }),
    prisma.guardianType.findMany({ orderBy: { name: "asc" } }),
  ]);
  return { grades, schools, guardianTypes };
}

export default async function NewStudentPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const { grades, schools, guardianTypes } = await getOptions();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">注册学生资料</h1>
      <form action="/api/students" method="post" className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm mb-1">姓名</label>
          <input name="fullName" className="w-full border rounded px-3 py-2" required />
        </div>
        <div>
          <label className="block text-sm mb-1">年级</label>
          <select name="gradeId" className="w-full border rounded px-3 py-2" required>
            {grades.map(g => (<option key={g.id} value={g.id}>{g.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">学校</label>
          <select name="schoolId" className="w-full border rounded px-3 py-2">
            <option value="">-</option>
            {schools.map(s => (<option key={s.id} value={s.id}>{s.name}</option>))}
          </select>
        </div>
        <div>
          <label className="block text-sm mb-1">班级</label>
          <input name="className" className="w-full border rounded px-3 py-2" />
        </div>
        <div className="md:col-span-2">
          <label className="block text-sm mb-1">住址</label>
          <input name="address" className="w-full border rounded px-3 py-2" />
        </div>

        <div className="md:col-span-2 border-t pt-3">
          <h2 className="font-medium mb-2">监护人</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {[1,2].map(i => (
              <div key={i} className="space-y-2 p-3 border rounded">
                <div>
                  <label className="block text-sm mb-1">姓名</label>
                  <input name={`g${i}Name`} className="w-full border rounded px-3 py-2" />
                </div>
                <div>
                  <label className="block text-sm mb-1">关系</label>
                  <select name={`g${i}TypeId`} className="w-full border rounded px-3 py-2">
                    <option value="">-</option>
                    {guardianTypes.map(t => (<option key={t.id} value={t.id}>{t.name}</option>))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">电话</label>
                  <input name={`g${i}Phone`} className="w-full border rounded px-3 py-2" />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" name={`g${i}Primary`} />
                  <span className="text-sm">设为主要联系人</span>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="md:col-span-2 flex gap-2">
          <button className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
          <Link href="/students" className="px-4 py-2 bg-gray-200 rounded">返回</Link>
        </div>
      </form>
    </div>
  );
}


