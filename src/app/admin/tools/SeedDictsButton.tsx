"use client";

import { useState } from "react";

export function SeedDictsButton() {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    if (!confirm("确定要初始化字典数据吗？")) return;

    setLoading(true);
    try {
      const res = await fetch("/api/admin/tools/seed-dicts", { method: "POST" });
      if (res.ok) {
        window.location.href = "/admin/tools?success=seed-done";
      } else {
        alert("初始化失败，请查看控制台");
      }
    } catch {
      alert("请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      className="btn-modern bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 disabled:opacity-50"
    >
      {loading ? "执行中…" : "初始化字典数据"}
    </button>
  );
}
