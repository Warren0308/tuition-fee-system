import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";

async function getTeachers() {
  return prisma.teacher.findMany({ include: { courses: { include: { course: true } } } });
}

export default async function TeachersPage() {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const list = await getTeachers();
  return (
    <div className="p-6 space-y-4">
      <h1 className="text-xl font-semibold">老师资料</h1>
      <table className="w-full border text-sm">
        <thead>
          <tr className="bg-gray-100">
            <th className="p-2 border">姓名</th>
            <th className="p-2 border">邮箱</th>
            <th className="p-2 border">电话</th>
            <th className="p-2 border">课程</th>
          </tr>
        </thead>
        <tbody>
          {list.map(t => (
            <tr key={t.id}>
              <td className="p-2 border">{t.name}</td>
              <td className="p-2 border">{t.email ?? "-"}</td>
              <td className="p-2 border">{t.phone ?? "-"}</td>
              <td className="p-2 border">{t.courses.map(c => c.course.name).join("、")}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


