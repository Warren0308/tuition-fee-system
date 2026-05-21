"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteTeacherButton({
  teacherId,
  teacherName,
}: {
  teacherId: string;
  teacherName: string;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  const handleDelete = async () => {
    if (!confirm(`确定要删除教师 ${teacherName}？\n所有课程绑定将解除。`)) return;

    setLoading(true);
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, { method: "DELETE" });
      if (res.ok) {
        router.push("/teachers");
      } else {
        const data = await res.json().catch(() => null);
        alert(data?.error || "删除失败");
      }
    } catch {
      alert("请求失败");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={loading}
      className="text-sm px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 disabled:opacity-50"
    >
      {loading ? "删除中…" : "🗑️ 删除教师"}
    </button>
  );
}
