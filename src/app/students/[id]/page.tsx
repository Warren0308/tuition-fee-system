import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getData(id: string) {
  return prisma.student.findUnique({
    where: { id },
    include: {
      grade: true,
      school: true,
      guardians: { include: { relationType: true } },
      enrollments: { include: { course: true }, orderBy: { id: "desc" } },
    },
  });
}

export default async function StudentDetailPage({ params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const student = await getData(params.id);
  if (!student) return notFound();
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">{student.fullName}</h1>
        <Link className="px-3 py-2 bg-gray-200 rounded" href="/students">返回列表</Link>
      </div>

      <div className="grid md:grid-cols-2 gap-4">
        <div className="p-4 border rounded">
          <h2 className="font-medium mb-2">基本信息</h2>
          <p>年级：{student.grade?.name}</p>
          <p>班级：{student.className ?? "-"}</p>
          <p>学校：{student.school?.name ?? "-"}</p>
          <p>地址：{student.address ?? "-"}</p>
        </div>
        <div className="p-4 border rounded">
          <h2 className="font-medium mb-2">监护人</h2>
          <ul className="space-y-1 text-sm">
            {student.guardians.map(g => (
              <li key={g.id}>
                {g.name}（{g.relationType?.name ?? "-"}） - {g.phone} {g.isPrimary ? "[主要]" : ""}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="p-4 border rounded">
        <h2 className="font-medium mb-2">课程（历史）</h2>
        <ul className="list-disc pl-6 text-sm">
          {student.enrollments.map(e => (
            <li key={e.id}>
              {e.course.name}（自 Term#{e.startTermId} 起{e.endTermId ? `，至 Term#${e.endTermId}` : "，进行中"}）
            </li>
          ))}
        </ul>
      </div>

      <div className="flex gap-2">
        <Link href={`/billing/${student.id}`} className="px-4 py-2 bg-blue-600 text-white rounded">本学期结算</Link>
      </div>
    </div>
  );
}


