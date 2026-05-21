import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getData(studentId: string) {
  const [student, courses, terms] = await Promise.all([
    prisma.student.findUnique({ where: { id: studentId }, include: { enrollments: { include: { course: true, startTerm: true, endTerm: true } } } }),
    prisma.course.findMany({ where: { isActive: true }, orderBy: { name: "asc" } }),
    prisma.term.findMany({ orderBy: [{ year: "desc" }, { termIndex: "asc" }] }),
  ]);
  return { student, courses, terms };
}

export default async function EnrollManagePage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const { student, courses, terms } = await getData(params.id);
  if (!student) return notFound();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">选课管理 - {student.fullName}</h1>
        <Link className="px-3 py-2 bg-gray-200 rounded" href={`/students/${student.id}`}>返回学生</Link>
      </div>

      <div className="p-4 border rounded space-y-3">
        <h2 className="font-medium">新增选课（从指定学期起生效）</h2>
        <form action={`/api/enrollments/student/${student.id}`} method="post" className="grid md:grid-cols-3 gap-3">
          <div>
            <label className="block text-sm mb-1">课程</label>
            <select name="courseId" className="w-full border rounded px-3 py-2" required>
              {courses.map(c => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
          <div>
            <label className="block text-sm mb-1">开始学期</label>
            <select name="startTermId" className="w-full border rounded px-3 py-2" required>
              {terms.map(t => (
                <option key={t.id} value={t.id}>{t.year} - 第{t.termIndex}学期</option>
              ))}
            </select>
          </div>
          <div className="flex items-end"><button className="px-4 py-2 bg-blue-600 text-white rounded">添加</button></div>
        </form>
      </div>

      <div className="p-4 border rounded">
        <h2 className="font-medium mb-2">当前与历史选课</h2>
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border">课程</th>
              <th className="p-2 border">开始</th>
              <th className="p-2 border">结束</th>
              <th className="p-2 border">操作</th>
            </tr>
          </thead>
          <tbody>
            {student.enrollments.map(e => (
              <tr key={e.id}>
                <td className="p-2 border">{e.course.name}</td>
                <td className="p-2 border">{e.startTerm ? `${e.startTerm.year}-第${e.startTerm.termIndex}` : '-'}</td>
                <td className="p-2 border">{e.endTerm ? `${e.endTerm.year}-第${e.endTerm.termIndex}` : '进行中'}</td>
                <td className="p-2 border">
                  {!e.endTerm && (
                    <form action={`/api/enrollments/enrollment/${e.id}/end`} method="post" className="flex items-center gap-2">
                      <select name="endTermId" className="border rounded px-2 py-1">
                        {terms.filter(t => !e.startTerm || (t.year > e.startTerm.year || (t.year === e.startTerm.year && t.termIndex >= e.startTerm.termIndex))).map(t => (
                          <option key={t.id} value={t.id}>{t.year}-第{t.termIndex}</option>
                        ))}
                      </select>
                      <button className="px-3 py-1 bg-gray-200 rounded">结束</button>
                    </form>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}


