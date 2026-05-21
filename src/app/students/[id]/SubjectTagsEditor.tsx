"use client";

import { useState } from "react";

interface SubjectOption {
  id: number;
  name: string; // 完整名字，如 补习班-华文
  shortName: string; // 短名字，如 华文
}

interface Props {
  enrollmentId: number;
  courseName: string; // 主课程，如 补习班
  availableSubjects: SubjectOption[];
  initialSubjectIds: number[];
  canEdit: boolean;
}

export function SubjectTagsEditor({
  enrollmentId,
  courseName,
  availableSubjects,
  initialSubjectIds,
  canEdit,
}: Props) {
  const [selectedIds, setSelectedIds] = useState<number[]>(initialSubjectIds);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);

  const toggle = async (subjectId: number) => {
    if (!canEdit || saving) return;
    const newIds = selectedIds.includes(subjectId)
      ? selectedIds.filter((id) => id !== subjectId)
      : [...selectedIds, subjectId];
    setSelectedIds(newIds);
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch(
        `/api/enrollments/enrollment/${enrollmentId}/update-subjects`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ subjectCourseIds: newIds }),
        }
      );
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.error || "保存失败");
      }
      setMessage({ type: "ok", text: "已保存" });
      setTimeout(() => setMessage(null), 2000);
    } catch (e: any) {
      setSelectedIds(initialSubjectIds);
      setMessage({ type: "err", text: e.message });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
      <div className="flex items-center justify-between mb-2">
        <div className="text-xs font-medium text-blue-700">
          📚 {courseName} 细分科目
          <span className="ml-2 text-gray-500 font-normal">(仅作展示，不影响价格)</span>
        </div>
        {message && (
          <span
            className={`text-xs ${
              message.type === "ok" ? "text-green-600" : "text-red-600"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
      <div className="flex flex-wrap gap-2">
        {availableSubjects.map((s) => {
          const checked = selectedIds.includes(s.id);
          return (
            <label
              key={s.id}
              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm cursor-pointer transition-colors ${
                checked
                  ? "bg-blue-500 text-white border-blue-500"
                  : "bg-white text-gray-700 border-gray-300 hover:bg-blue-50"
              } border ${!canEdit ? "cursor-not-allowed opacity-60" : ""}`}
            >
              <input
                type="checkbox"
                className="hidden"
                checked={checked}
                disabled={!canEdit || saving}
                onChange={() => toggle(s.id)}
              />
              <span>{checked ? "✓" : "○"}</span>
              <span>{s.shortName}</span>
            </label>
          );
        })}
      </div>
      {!canEdit && (
        <div className="text-xs text-gray-500 mt-1">
          只有管理员/收银员可以修改
        </div>
      )}
    </div>
  );
}
