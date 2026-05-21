import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";

async function getData(paymentId: string) {
  return prisma.studentTermPayment.findUnique({
    where: { id: paymentId },
    include: { items: true, student: true },
  });
}

function centsToStr(cents: number) {
  return (cents / 100).toFixed(2);
}

export default async function ReceiptPage({ params }: { params: { paymentId: string } }) {
  const session = await getServerSession(authOptions);
  if (!session) {
    return (
      <div className="p-6">未登录。请先<Link className="text-blue-600" href="/login">登录</Link></div>
    );
  }
  const data = await getData(params.paymentId);
  if (!data) return notFound();
  const sum = data.items.reduce((s, i) => s + i.finalCents, 0);
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold">账单预览</h1>
        <div className="flex gap-2">
          <Link className="px-3 py-2 bg-gray-200 rounded" href={`/billing/edit/${data.id}`}>编辑账单</Link>
          <Link className="px-3 py-2 bg-gray-200 rounded" href={`/students/${data.studentId}`}>返回学生</Link>
        </div>
      </div>
      <div className="p-4 border rounded">
        <div className="text-sm text-gray-600">学生：{data.student.fullName}｜学年：{data.year}｜学期：{data.termIndex}</div>
        <table className="w-full border text-sm mt-3">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left">项目</th>
              <th className="p-2 border">原价</th>
              <th className="p-2 border">份额</th>
              <th className="p-2 border">数量</th>
              <th className="p-2 border">金额</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(item => (
              <tr key={item.id}>
                <td className="p-2 border">{item.description}</td>
                <td className="p-2 border text-center">{centsToStr(item.unitCents)}</td>
                <td className="p-2 border text-center">{item.fraction}</td>
                <td className="p-2 border text-center">{item.quantity}</td>
                <td className="p-2 border text-center">{centsToStr(item.finalCents)}</td>
              </tr>
            ))}
            <tr>
              <td className="p-2 border text-right" colSpan={4}>合计</td>
              <td className="p-2 border text-center font-medium">{centsToStr(sum)}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}


