import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getStudents() {
  return prisma.student.findMany({
    orderBy: { createdAt: "desc" },
    include: { grade: true, school: true },
    take: 50,
  });
}

export default async function StudentsPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const list = await getStudents();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">学生资料</h1>
        <Link className="px-3 py-2 bg-blue-600 text-white rounded" href="/students/new">注册学生资料</Link>
      </div>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">姓名</th>
            <th className="p-2 border">班级</th>
            <th className="p-2 border">学校</th>
            <th className="p-2 border">操作</th>
          </tr>
        </thead>
        <tbody>
          {list.map(s => (
            <tr key={s.id}>
              <td className="p-2 border">{s.fullName}</td>
              <td className="p-2 border">{s.className ?? "-"}（{s.grade?.name}）</td>
              <td className="p-2 border">{s.school?.name ?? "-"}</td>
              <td className="p-2 border"><Link className="text-blue-600" href={`/students/${s.id}`}>查看/编辑</Link></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


