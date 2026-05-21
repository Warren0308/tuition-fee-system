"use client";

import React, { useState, useRef } from "react";
import Link from "next/link";

interface ImportResult {
  dryRun: boolean;
  total: number;
  created: number;
  skipped: number;
  errors: Array<{ row: number; line: string; error: string }>;
  students: Array<{ id: string; name: string }>;
}

export function ImportClient() {
  const [csvText, setCsvText] = useState("");
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setCsvText(String(reader.result || ""));
      setResult(null);
      setError(null);
    };
    reader.readAsText(file, "utf-8");
  }

  function downloadTemplate() {
    const csv = `fullName,gradeName,gender,dateOfBirth,schoolName,className,guardianName,guardianPhone,guardianRelation
张小明,五年级,M,2014-03-15,优特小学,5甲,张爸爸,0123456789,父亲
李小华,四年级,F,2015-06-20,优特小学,4乙,李妈妈,0198765432,母亲`;
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "student-import-template.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  }

  async function handleImport(dryRun: boolean) {
    if (!csvText.trim()) {
      setError("请先选择文件或粘贴 CSV 内容");
      return;
    }
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch("/api/students/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csvText, dryRun }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "导入失败");
        setBusy(false);
        return;
      }
      setResult(data);
    } catch (e) {
      setError("网络错误");
    } finally {
      setBusy(false);
    }
  }

  function clearAll() {
    setCsvText("");
    setResult(null);
    setError(null);
    if (fileRef.current) fileRef.current.value = "";
  }

  return (
    <div className="space-y-4">
      <div className="card-modern p-6 space-y-4">
        <h2 className="text-lg font-semibold text-gray-800">📁 选择文件</h2>

        <div className="flex flex-wrap items-center gap-3">
          <input
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={handleFileChange}
            className="block text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
          />
          <button
            type="button"
            onClick={downloadTemplate}
            className="text-sm text-blue-600 hover:underline"
          >
            💾 下载模板 CSV
          </button>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-gray-700 hover:text-gray-900">
            或直接粘贴 CSV 内容（点击展开）
          </summary>
          <textarea
            value={csvText}
            onChange={(e) => setCsvText(e.target.value)}
            placeholder="fullName,gradeName,gender,..."
            rows={10}
            className="mt-2 w-full p-3 border border-gray-300 rounded-lg font-mono text-xs"
          />
        </details>

        {csvText && (
          <div className="bg-gray-50 p-3 rounded text-xs text-gray-600">
            <strong>预览：</strong>共 {csvText.split(/\r?\n/).filter((l) => l.trim()).length - 1} 行数据
          </div>
        )}

        {error && (
          <div className="bg-red-50 border border-red-200 text-red-700 p-3 rounded text-sm">
            ❌ {error}
          </div>
        )}

        <div className="flex flex-wrap gap-2">
          <button
            onClick={() => handleImport(true)}
            disabled={busy || !csvText.trim()}
            className="px-4 py-2 bg-amber-100 text-amber-800 rounded-lg hover:bg-amber-200 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "处理中..." : "🔍 试运行（不写入数据）"}
          </button>
          <button
            onClick={() => handleImport(false)}
            disabled={busy || !csvText.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "导入中..." : "✓ 正式导入"}
          </button>
          {csvText && (
            <button
              onClick={clearAll}
              disabled={busy}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              清除
            </button>
          )}
        </div>
      </div>

      {/* 结果 */}
      {result && (
        <div className="card-modern p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-800 flex items-center gap-2">
            {result.dryRun ? (
              <>
                <span className="text-amber-600">🔍</span>
                <span>试运行结果</span>
              </>
            ) : (
              <>
                <span className="text-emerald-600">✓</span>
                <span>导入完成</span>
              </>
            )}
          </h2>

          <div className="grid grid-cols-3 gap-3">
            <Stat label="总行数" value={result.total} color="text-blue-600" />
            <Stat
              label={result.dryRun ? "将创建" : "已创建"}
              value={result.created}
              color="text-emerald-600"
            />
            <Stat label="跳过/失败" value={result.skipped} color="text-red-600" />
          </div>

          {result.errors.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-red-700 mb-2">
                ❌ 失败明细（{result.errors.length}）
              </h3>
              <div className="bg-red-50 border border-red-200 rounded-lg max-h-64 overflow-y-auto divide-y divide-red-100">
                {result.errors.map((err) => (
                  <div key={err.row} className="p-2 text-xs">
                    <div className="font-semibold text-red-700">第 {err.row} 行: {err.error}</div>
                    <div className="text-red-500 font-mono mt-0.5 truncate">{err.line}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!result.dryRun && result.students.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-emerald-700 mb-2">
                ✓ 已创建学生（{result.students.length}）
              </h3>
              <div className="max-h-64 overflow-y-auto bg-emerald-50 border border-emerald-200 rounded-lg divide-y divide-emerald-100">
                {result.students.slice(0, 100).map((s) => (
                  <Link
                    key={s.id}
                    href={`/students/${s.id}`}
                    className="block p-2 text-sm text-emerald-700 hover:bg-emerald-100"
                  >
                    {s.name} →
                  </Link>
                ))}
                {result.students.length > 100 && (
                  <div className="p-2 text-xs text-gray-500 text-center">
                    ... 还有 {result.students.length - 100} 位
                  </div>
                )}
              </div>
            </div>
          )}

          {!result.dryRun && result.created > 0 && (
            <Link
              href="/students"
              className="inline-block px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              查看学生列表 →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div className="p-3 bg-gray-50 rounded-lg text-center">
      <div className="text-xs text-gray-500 mb-0.5">{label}</div>
      <div className={`text-2xl font-bold ${color}`}>{value}</div>
    </div>
  );
}
