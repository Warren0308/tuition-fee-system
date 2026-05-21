import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getData(studentId: string) {
  const student = await prisma.student.findUnique({
    where: { id: studentId },
    include: {
      grade: true,
      enrollments: { include: { course: true } },
      payments: { orderBy: { createdAt: "desc" } },
    },
  });
  return student;
}

export default async function BillingForStudentPage({ params }: { params: { studentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const student = await getData(params.studentId);
  if (!student) return notFound();
  const now = new Date();
  const year = now.getFullYear();
  // 简化：学期索引占位，后续以 TermConfig 生成学期区间
  const termIndex = 1;
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">结算 - {student.fullName}</h1>
        <Link className="px-3 py-2 bg-gray-200 rounded" href={`/students/${student.id}`}>返回学生</Link>
      </div>
      <div className="p-4 border rounded">
        <h2 className="font-medium mb-2">本学期课程</h2>
        <ul className="list-disc pl-6 text-sm">
          {student.enrollments.map(e => (
            <li key={e.id}>{e.course.name}</li>
          ))}
        </ul>
      </div>
      <form action={`/api/billing/student/${student.id}`} method="post" className="space-y-3">
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="termIndex" value={termIndex} />
        <div className="flex items-center gap-2">
          <label className="text-sm">备注</label>
          <input name="note" className="border rounded px-3 py-2 flex-1" />
        </div>
        <button className="px-4 py-2 bg-blue-600 text-white rounded">生成账单（可在下一步调整）</button>
      </form>
    </div>
  );
}


