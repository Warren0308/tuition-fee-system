import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import Link from "next/link";

export default async function ResetPasswordPage({ params }: { params: { token: string } }) {
  const session = await getServerSession(authOptions);
  if (session) {
    return <div className="p-6">已登录，无需重置。前往<Link className="text-blue-600" href="/profile">个人资料</Link></div>;
  }
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow rounded p-6">
        <h1 className="text-xl font-semibold mb-2">重置密码</h1>
        <form action="/api/auth/reset" method="post" className="space-y-3">
          <input type="hidden" name="token" value={params.token} />
          <div>
            <label className="block text-sm mb-1">新密码</label>
            <input name="password" type="password" className="w-full border rounded px-3 py-2" required />
          </div>
          <div>
            <label className="block text-sm mb-1">确认新密码</label>
            <input name="confirm" type="password" className="w-full border rounded px-3 py-2" required />
          </div>
          <button className="w-full bg-blue-600 text-white py-2 rounded">提交</button>
        </form>
      </div>
    </div>
  );
}


