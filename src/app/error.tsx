"use client";

import { useEffect } from "react";
import Link from "next/link";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[GlobalError]", error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-6">
      <div className="card-modern p-8 max-w-lg w-full text-center">
        <div className="w-20 h-20 bg-red-100 rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
          ⚠️
        </div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">出错了</h1>
        <p className="text-gray-600 mb-4">
          抱歉，系统遇到了一个问题。请尝试重新加载页面，或返回主页。
        </p>

        {process.env.NODE_ENV === "development" && error.message && (
          <details className="text-left bg-red-50 border border-red-200 rounded p-3 mb-4 text-sm">
            <summary className="cursor-pointer text-red-700 font-medium">
              错误详情（开发模式）
            </summary>
            <pre className="mt-2 text-xs text-red-600 overflow-x-auto whitespace-pre-wrap break-all">
              {error.message}
              {error.digest && `\nDigest: ${error.digest}`}
              {error.stack && `\n\n${error.stack}`}
            </pre>
          </details>
        )}

        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
          >
            🔄 重试
          </button>
          <Link
            href="/dashboard"
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 font-medium"
          >
            🏠 返回主页
          </Link>
        </div>
      </div>
    </div>
  );
}
