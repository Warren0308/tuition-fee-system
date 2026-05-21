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

export default async function EditPaymentPage({ params }: { params: { paymentId: string } }) {
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
        <h1 className="text-xl font-semibold">编辑账单</h1>
        <div className="flex gap-2">
          <Link className="px-3 py-2 bg-gray-200 rounded" href={`/billing/receipt/${data.id}`}>返回预览</Link>
          <Link className="px-3 py-2 bg-gray-200 rounded" href={`/students/${data.studentId}`}>返回学生</Link>
        </div>
      </div>
      <form action={`/api/billing/payment/${data.id}/items`} method="post" className="space-y-3">
        <input type="hidden" name="paymentId" value={data.id} />
        <table className="w-full border text-sm">
          <thead>
            <tr className="bg-gray-100">
              <th className="p-2 border text-left">项目</th>
              <th className="p-2 border">原价</th>
              <th className="p-2 border">份额</th>
              <th className="p-2 border">数量</th>
              <th className="p-2 border">最终金额</th>
              <th className="p-2 border">备注</th>
            </tr>
          </thead>
          <tbody>
            {data.items.map(item => (
              <tr key={item.id}>
                <td className="p-2 border">{item.description}</td>
                <td className="p-2 border text-center">{centsToStr(item.unitCents)}</td>
                <td className="p-2 border text-center">
                  <input name={`fraction_${item.id}`} defaultValue={String(item.fraction)} className="w-20 border rounded px-2 py-1 text-center" />
                </td>
                <td className="p-2 border text-center">
                  <input name={`quantity_${item.id}`} defaultValue={String(item.quantity)} className="w-20 border rounded px-2 py-1 text-center" />
                </td>
                <td className="p-2 border text-center">
                  <input name={`finalCents_${item.id}`} defaultValue={String(item.finalCents)} className="w-28 border rounded px-2 py-1 text-center" />
                </td>
                <td className="p-2 border text-center">
                  <input name={`note_${item.id}`} defaultValue={item.note ?? ''} className="w-full border rounded px-2 py-1" />
                </td>
              </tr>
            ))}
            <tr>
              <td className="p-2 border text-right" colSpan={4}>当前合计</td>
              <td className="p-2 border text-center font-medium">{centsToStr(sum)}</td>
              <td className="p-2 border"></td>
            </tr>
          </tbody>
        </table>
        <div className="flex gap-2">
          <button name="_action" value="save" className="px-4 py-2 bg-blue-600 text-white rounded">保存</button>
          <button name="_action" value="markPaid" className="px-4 py-2 bg-green-600 text-white rounded">标记支付</button>
        </div>
      </form>
    </div>
  );
}


