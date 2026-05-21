"use client";

import { useState } from "react";

interface Props {
  studentIds: string[];
  year: number;
  termIndex: number;
}

export function NotifyButton({ studentIds, year, termIndex }: Props) {
  const [isLoading, setIsLoading] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [result, setResult] = useState<{
    success: number;
    failed: number;
    errors: string[];
  } | null>(null);

  const handleNotify = async () => {
    setIsLoading(true);
    setResult(null);

    try {
      const response = await fetch("/api/billing/notify-unpaid", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          studentIds,
          year,
          termIndex,
        }),
      });

      const data = await response.json();

      if (response.ok) {
        setResult({
          success: data.success || 0,
          failed: data.failed || 0,
          errors: data.errors || [],
        });
      } else {
        setResult({
          success: 0,
          failed: studentIds.length,
          errors: [data.error || "发送失败"],
        });
      }
    } catch (error) {
      setResult({
        success: 0,
        failed: studentIds.length,
        errors: ["网络错误，请稍后重试"],
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <>
      <button
        onClick={() => setShowModal(true)}
        className="px-4 py-2 bg-amber-600 text-white rounded-lg hover:bg-amber-700 transition-colors flex items-center gap-2"
      >
        <span>📱</span>
        <span>发送缴费提醒</span>
      </button>

      {/* 确认弹窗 */}
      {showModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4">
            {!result ? (
              <>
                <div className="text-center mb-6">
                  <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                    📢
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">发送缴费提醒</h3>
                  <p className="text-gray-600 mt-2">
                    将向 <span className="font-semibold text-amber-600">{studentIds.length}</span> 名学生的监护人发送缴费提醒
                  </p>
                </div>

                <div className="bg-amber-50 rounded-lg p-4 mb-6">
                  <div className="text-sm text-amber-800">
                    <p className="font-medium mb-2">📋 通知内容包括：</p>
                    <ul className="list-disc list-inside space-y-1 text-amber-700">
                      <li>学生姓名和年级</li>
                      <li>{year}年第{termIndex}期未支付项目</li>
                      <li>未支付金额</li>
                    </ul>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowModal(false)}
                    className="flex-1 px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                  >
                    取消
                  </button>
                  <button
                    onClick={handleNotify}
                    disabled={isLoading}
                    className={`flex-1 px-4 py-3 rounded-lg transition-colors flex items-center justify-center gap-2 ${
                      isLoading
                        ? "bg-gray-400 text-gray-200 cursor-not-allowed"
                        : "bg-amber-600 text-white hover:bg-amber-700"
                    }`}
                  >
                    {isLoading ? (
                      <>
                        <span className="animate-spin">⏳</span>
                        发送中...
                      </>
                    ) : (
                      <>
                        <span>📱</span>
                        确认发送
                      </>
                    )}
                  </button>
                </div>
              </>
            ) : (
              <>
                <div className="text-center mb-6">
                  <div
                    className={`w-16 h-16 rounded-full flex items-center justify-center text-3xl mx-auto mb-4 ${
                      result.failed === 0
                        ? "bg-green-100"
                        : result.success === 0
                        ? "bg-red-100"
                        : "bg-amber-100"
                    }`}
                  >
                    {result.failed === 0 ? "✅" : result.success === 0 ? "❌" : "⚠️"}
                  </div>
                  <h3 className="text-xl font-bold text-gray-800">
                    {result.failed === 0
                      ? "发送成功！"
                      : result.success === 0
                      ? "发送失败"
                      : "部分发送成功"}
                  </h3>
                </div>

                <div className="space-y-3 mb-6">
                  <div className="flex justify-between items-center p-3 bg-green-50 rounded-lg">
                    <span className="text-green-700">✅ 成功发送</span>
                    <span className="font-bold text-green-700">{result.success} 条</span>
                  </div>
                  {result.failed > 0 && (
                    <div className="flex justify-between items-center p-3 bg-red-50 rounded-lg">
                      <span className="text-red-700">❌ 发送失败</span>
                      <span className="font-bold text-red-700">{result.failed} 条</span>
                    </div>
                  )}
                </div>

                {result.errors.length > 0 && (
                  <div className="bg-red-50 rounded-lg p-3 mb-6 max-h-32 overflow-y-auto">
                    <p className="text-sm font-medium text-red-800 mb-1">错误信息：</p>
                    <ul className="text-xs text-red-700 space-y-1">
                      {result.errors.slice(0, 5).map((err, i) => (
                        <li key={i}>• {err}</li>
                      ))}
                      {result.errors.length > 5 && (
                        <li>... 还有 {result.errors.length - 5} 条错误</li>
                      )}
                    </ul>
                  </div>
                )}

                <button
                  onClick={() => {
                    setShowModal(false);
                    setResult(null);
                  }}
                  className="w-full px-4 py-3 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300 transition-colors"
                >
                  关闭
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
