"use client";

import React, { useState, useRef, useEffect } from "react";

interface DictItemRowProps {
  type: "grade" | "school" | "guardian";
  id: number;
  name: string;
  /** 仅 grade 类型使用 */
  orderIndex?: number;
  /** 颜色主题 */
  accentColor: "blue" | "green" | "orange";
}

const ACCENT_CLASSES: Record<
  DictItemRowProps["accentColor"],
  { badge: string; ring: string; saveBtn: string }
> = {
  blue: {
    badge: "bg-blue-600 text-white",
    ring: "focus:ring-blue-500 focus:border-blue-500",
    saveBtn: "bg-blue-600 hover:bg-blue-700",
  },
  green: {
    badge: "bg-green-600 text-white",
    ring: "focus:ring-green-500 focus:border-green-500",
    saveBtn: "bg-green-600 hover:bg-green-700",
  },
  orange: {
    badge: "bg-orange-600 text-white",
    ring: "focus:ring-orange-500 focus:border-orange-500",
    saveBtn: "bg-orange-600 hover:bg-orange-700",
  },
};

export function DictItemRow({ type, id, name, orderIndex, accentColor }: DictItemRowProps) {
  const [editing, setEditing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [newName, setNewName] = useState(name);
  const [newOrder, setNewOrder] = useState(String(orderIndex ?? 0));
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const accent = ACCENT_CLASSES[accentColor];

  useEffect(() => {
    if (editing) inputRef.current?.focus();
  }, [editing]);

  async function handleSave() {
    if (!newName.trim()) {
      setError("名称不能为空");
      return;
    }
    if (newName === name && (type !== "grade" || Number(newOrder) === orderIndex)) {
      setEditing(false);
      return;
    }

    setBusy(true);
    setError(null);

    try {
      const payload: any = { id, name: newName.trim() };
      if (type === "grade") payload.orderIndex = Number(newOrder);

      const res = await fetch(`/api/admin/dicts/${type}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "更新失败");
        setBusy(false);
        return;
      }
      window.location.reload();
    } catch (e) {
      setError("网络错误");
      setBusy(false);
    }
  }

  async function handleDelete() {
    const confirmMessage = `确定要删除"${name}"吗？\n\n历史数据不会受影响，仅删除字典项。`;
    if (!confirm(confirmMessage)) return;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/admin/dicts/${type}/delete`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      });
      if (response.ok) {
        window.location.reload();
      } else {
        const err = await response.json();
        setError(err.error || "删除失败");
        setBusy(false);
      }
    } catch (e) {
      setError("网络错误");
      setBusy(false);
    }
  }

  if (editing) {
    return (
      <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg space-y-2">
        <div className="flex items-center gap-2">
          {type === "grade" && (
            <input
              type="number"
              value={newOrder}
              onChange={(e) => setNewOrder(e.target.value)}
              className={`w-16 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 ${accent.ring}`}
              placeholder="排序"
              disabled={busy}
            />
          )}
          <input
            ref={inputRef}
            type="text"
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleSave();
              if (e.key === "Escape") setEditing(false);
            }}
            className={`flex-1 px-2 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 ${accent.ring}`}
            disabled={busy}
          />
        </div>
        {error && <div className="text-xs text-red-600">{error}</div>}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={handleSave}
            disabled={busy}
            className={`flex-1 px-3 py-1.5 text-white rounded text-xs font-medium ${accent.saveBtn} disabled:opacity-50`}
          >
            {busy ? "保存中..." : "保存"}
          </button>
          <button
            type="button"
            onClick={() => {
              setEditing(false);
              setNewName(name);
              setNewOrder(String(orderIndex ?? 0));
              setError(null);
            }}
            disabled={busy}
            className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-xs hover:bg-gray-300 disabled:opacity-50"
          >
            取消
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group">
      <div className="flex items-center space-x-3 flex-1 min-w-0">
        {type === "grade" ? (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 ${accent.badge}`}
          >
            {orderIndex}
          </div>
        ) : (
          <div
            className={`w-8 h-8 rounded-full flex items-center justify-center text-xs flex-shrink-0 ${accent.badge}`}
          >
            {type === "school" ? "🏫" : "👤"}
          </div>
        )}
        <span className="font-medium text-gray-800 truncate">{name}</span>
      </div>
      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
        <button
          type="button"
          onClick={() => setEditing(true)}
          disabled={busy}
          className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-all disabled:opacity-50"
          title={`编辑 ${name}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
            />
          </svg>
        </button>
        <button
          type="button"
          onClick={handleDelete}
          disabled={busy}
          className="p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all disabled:opacity-50"
          title={`删除 ${name}`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
