"use client";
import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    const res = await signIn("credentials", { redirect: false, username, password });
    if (res?.ok) router.push("/");
    else setError("用户名或密码错误");
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-sm bg-white shadow rounded p-6">
        <h1 className="text-xl font-semibold mb-2">学生收费系统</h1>
        <p className="text-sm text-gray-500 mb-6">优特补习学院</p>
        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="block text-sm mb-1">用户名</label>
            <input value={username} onChange={e=>setUsername(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          <div>
            <label className="block text-sm mb-1">密码</label>
            <input type="password" value={password} onChange={e=>setPassword(e.target.value)} className="w-full border rounded px-3 py-2" />
          </div>
          {error && <p className="text-red-600 text-sm">{error}</p>}
          <button type="submit" className="w-full bg-blue-600 text-white py-2 rounded">登录</button>
        </form>
        <form action="/api/auth/forgot" method="post" className="mt-6 space-y-2">
          <div className="text-sm text-gray-600">忘记密码？输入邮箱重置：</div>
          <input name="email" type="email" className="w-full border rounded px-3 py-2" placeholder="name@example.com" />
          <button className="w-full bg-gray-100 py-2 rounded">发送重置链接</button>
        </form>
      </div>
    </div>
  );
}
