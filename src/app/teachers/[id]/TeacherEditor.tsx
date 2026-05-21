"use client";

import React, { useState } from "react";

interface Props {
  teacherId: string;
  initialName: string;
  initialEmail: string;
  initialPhone: string;
  initialUserId: string;
  availableUsers: Array<{ id: string; username: string; email: string | null }>;
}

export function TeacherEditor({
  teacherId,
  initialName,
  initialEmail,
  initialPhone,
  initialUserId,
  availableUsers,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(initialName);
  const [email, setEmail] = useState(initialEmail);
  const [phone, setPhone] = useState(initialPhone);
  const [userId, setUserId] = useState(initialUserId);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!name.trim()) {
      setError("姓名不能为空");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/teachers/${teacherId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          _method: "PATCH",
          name: name.trim(),
          email: email.trim(),
          phone: phone.trim(),
          userId,
        }),
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

  if (!editing) {
    return (
      <div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm text-gray-700">
          <div>
            <div className="text-xs text-gray-500 mb-0.5">邮箱</div>
            <div>{initialEmail || <span className="text-gray-400">未填写</span>}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">电话</div>
            <div>{initialPhone || <span className="text-gray-400">未填写</span>}</div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-0.5">绑定账号</div>
            <div>
              {initialUserId
                ? availableUsers.find((u) => u.id === initialUserId)?.username || initialUserId
                : <span className="text-gray-400">未绑定</span>}
            </div>
          </div>
        </div>
        <button
          onClick={() => setEditing(true)}
          className="mt-3 text-sm px-3 py-1.5 bg-blue-50 text-blue-700 rounded hover:bg-blue-100"
        >
          ✏️ 编辑基本信息
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">姓名 *</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="input-modern w-full"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">邮箱</label>
          <input
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            type="email"
            className="input-modern w-full"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">电话</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            className="input-modern w-full"
            disabled={busy}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-700 mb-1">绑定登录账号</label>
          <select
            value={userId}
            onChange={(e) => setUserId(e.target.value)}
            className="input-modern w-full"
            disabled={busy}
          >
            <option value="">不绑定</option>
            {availableUsers.map((u) => (
              <option key={u.id} value={u.id}>
                {u.username}{u.email ? ` (${u.email})` : ""}
              </option>
            ))}
          </select>
        </div>
      </div>
      {error && <div className="text-sm text-red-600">❌ {error}</div>}
      <div className="flex gap-2">
        <button
          onClick={handleSave}
          disabled={busy}
          className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
        >
          {busy ? "保存中..." : "保存"}
        </button>
        <button
          onClick={() => {
            setEditing(false);
            setName(initialName);
            setEmail(initialEmail);
            setPhone(initialPhone);
            setUserId(initialUserId);
            setError(null);
          }}
          disabled={busy}
          className="px-4 py-2 bg-gray-200 text-gray-700 rounded hover:bg-gray-300 text-sm"
        >
          取消
        </button>
      </div>
    </div>
  );
}
