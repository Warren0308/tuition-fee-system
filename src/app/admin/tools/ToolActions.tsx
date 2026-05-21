"use client";
import { useState } from "react";

interface Props {
  emptyPayments: number;
  expiredTokens: number;
}

export function ToolActions({ emptyPayments, expiredTokens }: Props) {
  const [loading, setLoading] = useState<string | null>(null);
  const [result, setResult] = useState<{ kind: 'success' | 'error'; message: string } | null>(null);

  async function callApi(label: string, url: string) {
    if (!confirm(`确定要执行「${label}」吗？此操作不可撤销。`)) return;
    setLoading(url);
    setResult(null);
    try {
      const res = await fetch(url, { method: 'POST' });
      const data = await res.json();
      if (res.ok && data.success !== false) {
        setResult({ kind: 'success', message: data.message || '操作成功' });
        // 1.5 秒后刷新页面更新数据
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setResult({ kind: 'error', message: data.error || '操作失败' });
      }
    } catch (err: any) {
      setResult({ kind: 'error', message: err.message || '网络错误' });
    } finally {
      setLoading(null);
    }
  }

  return (
    <div className="space-y-3">
      {result && (
        <div
          className={`p-3 rounded-lg text-sm ${
            result.kind === 'success'
              ? 'bg-emerald-50 border border-emerald-200 text-emerald-700'
              : 'bg-red-50 border border-red-200 text-red-700'
          }`}
        >
          {result.kind === 'success' ? '✅ ' : '❌ '}
          {result.message}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <ActionCard
          icon="🧾"
          title="清理空账单"
          description={`删除没有任何项目的账单记录（${emptyPayments} 条）`}
          buttonText="清理空账单"
          disabled={loading !== null || emptyPayments === 0}
          loading={loading === '/api/admin/tools/cleanup-bills'}
          onClick={() => callApi('清理空账单', '/api/admin/tools/cleanup-bills')}
        />
        <ActionCard
          icon="🔑"
          title="清理过期令牌"
          description={`删除已过期或已使用的密码重置令牌（${expiredTokens} 条）`}
          buttonText="清理令牌"
          disabled={loading !== null || expiredTokens === 0}
          loading={loading === '/api/admin/tools/cleanup-tokens'}
          onClick={() => callApi('清理过期令牌', '/api/admin/tools/cleanup-tokens')}
        />
      </div>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  buttonText,
  disabled,
  loading,
  onClick,
}: {
  icon: string;
  title: string;
  description: string;
  buttonText: string;
  disabled: boolean;
  loading: boolean;
  onClick: () => void;
}) {
  return (
    <div className="p-4 border border-gray-200 rounded-lg bg-white">
      <div className="flex items-start gap-3 mb-3">
        <div className="text-3xl">{icon}</div>
        <div className="flex-1">
          <h3 className="font-medium text-gray-800">{title}</h3>
          <p className="text-xs text-gray-600 mt-1">{description}</p>
        </div>
      </div>
      <button
        type="button"
        onClick={onClick}
        disabled={disabled}
        className="w-full px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
      >
        {loading ? '处理中...' : buttonText}
      </button>
    </div>
  );
}
