import Link from "next/link";

export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="card-modern p-8 max-w-md w-full text-center">
        <div className="text-6xl mb-3">🔍</div>
        <h1 className="text-3xl font-bold text-gray-800 mb-2">404</h1>
        <p className="text-gray-600 mb-6">
          页面不存在或已被删除
        </p>
        <Link
          href="/dashboard"
          className="inline-block px-5 py-2.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          🏠 返回主页
        </Link>
      </div>
    </div>
  );
}
