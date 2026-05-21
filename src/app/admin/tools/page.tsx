import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function AdminToolsPage() {
  const session = await getServerSession(authOptions);
  if (!session) return <div className="p-6">未登录</div>;
  return (
    <div className="p-6 space-y-6">
      <h1 className="text-xl font-semibold">管理工具</h1>
      <div className="p-4 border rounded space-y-3">
        <h2 className="font-medium">邮件测试</h2>
        <form action="/api/admin/tools/mail-test" method="post" className="grid md:grid-cols-2 gap-3">
          <div>
            <label className="block text-sm mb-1">收件人</label>
            <input name="to" type="email" className="w-full border rounded px-3 py-2" placeholder="name@example.com" required />
          </div>
          <div>
            <label className="block text-sm mb-1">主题</label>
            <input name="subject" className="w-full border rounded px-3 py-2" defaultValue="测试邮件" />
          </div>
          <div className="md:col-span-2">
            <label className="block text-sm mb-1">内容</label>
            <textarea name="body" className="w-full border rounded px-3 py-2" rows={4} defaultValue="这是一封测试邮件。" />
          </div>
          <div className="md:col-span-2"><button className="px-4 py-2 bg-blue-600 text-white rounded">发送</button></div>
        </form>
      </div>
      <div><Link href="/admin" className="text-blue-600">返回管理首页</Link></div>
    </div>
  );
}



