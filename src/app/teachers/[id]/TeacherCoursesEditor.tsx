"use client";

import React, { useState } from "react";

interface Course {
  id: number;
  name: string;
  code: string;
  typeName: string;
}

export function TeacherCoursesEditor({
  teacherId,
  allCourses,
  initialSelected,
}: {
  teacherId: string;
  allCourses: Course[];
  initialSelected: number[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set(initialSelected));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filtered = search
    ? allCourses.filter(
        (c) =>
          c.name.toLowerCase().includes(search.toLowerCase()) ||
          c.code.toLowerCase().includes(search.toLowerCase()) ||
          c.typeName.toLowerCase().includes(search.toLowerCase())
      )
    : allCourses;

  // 按类型分组
  const grouped = filtered.reduce<Record<string, Course[]>>((acc, c) => {
    if (!acc[c.typeName]) acc[c.typeName] = [];
    acc[c.typeName].push(c);
    return acc;
  }, {});

  const toggle = (id: number) => {
    const ns = new Set(selected);
    if (ns.has(id)) ns.delete(id);
    else ns.add(id);
    setSelected(ns);
  };

  const hasChange =
    selected.size !== initialSelected.length ||
    initialSelected.some((id) => !selected.has(id)) ||
    Array.from(selected).some((id) => !initialSelected.includes(id));

  async function handleSave() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers/${teacherId}/courses`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ courseIds: Array.from(selected) }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "保存失败");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setError("网络错误");
      setBusy(false);
    }
  }

  return (
    <div>
      <div className="mb-3 flex items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索课程..."
          className="input-modern flex-1 text-sm"
        />
        <div className="text-sm text-gray-600 whitespace-nowrap">
          已选 <span className="font-bold text-blue-600">{selected.size}</span> / {allCourses.length}
        </div>
      </div>

      {allCourses.length === 0 ? (
        <div className="text-center py-6 text-gray-500 text-sm">
          系统中暂无课程，请先在 <a href="/admin/catalog" className="text-blue-600 hover:underline">课程管理</a> 中添加。
        </div>
      ) : (
        <div className="max-h-96 overflow-y-auto border border-gray-200 rounded-lg divide-y">
          {Object.entries(grouped).map(([typeName, courses]) => (
            <div key={typeName} className="bg-gray-50">
              <div className="px-3 py-2 text-xs font-semibold text-gray-600 bg-gray-100 sticky top-0">
                {typeName}（{courses.length}）
              </div>
              <div className="p-2 grid grid-cols-2 md:grid-cols-3 gap-1 bg-white">
                {courses.map((c) => {
                  const isSelected = selected.has(c.id);
                  return (
                    <label
                      key={c.id}
                      className={`flex items-center gap-2 px-2 py-1.5 rounded cursor-pointer text-sm ${
                        isSelected ? "bg-blue-50 border border-blue-200" : "hover:bg-gray-50 border border-transparent"
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggle(c.id)}
                        className="w-4 h-4"
                      />
                      <span className="truncate">{c.name}</span>
                    </label>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {error && <div className="mt-3 text-sm text-red-600">❌ {error}</div>}

      {hasChange && (
        <div className="mt-3 flex gap-2">
          <button
            onClick={handleSave}
            disabled={busy}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "保存中..." : `💾 保存绑定（${selected.size}）`}
          </button>
          <button
            onClick={() => {
              setSelected(new Set(initialSelected));
              setError(null);
            }}
            disabled={busy}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
          >
            重置
          </button>
        </div>
      )}
    </div>
  );
}
