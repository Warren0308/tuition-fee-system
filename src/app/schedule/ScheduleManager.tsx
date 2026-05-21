"use client";

import React, { useState } from "react";

interface Course {
  id: number;
  name: string;
  typeName: string;
  teacherNames: string[];
}

interface Schedule {
  id: string;
  courseId: number;
  courseName: string;
  typeName: string;
  teacherNames: string[];
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

const DAY_NAMES = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
const DAY_COLORS = [
  "bg-rose-50 border-rose-200",
  "bg-blue-50 border-blue-200",
  "bg-emerald-50 border-emerald-200",
  "bg-amber-50 border-amber-200",
  "bg-purple-50 border-purple-200",
  "bg-cyan-50 border-cyan-200",
  "bg-pink-50 border-pink-200",
];

const TYPE_COLOR_MAP: Record<string, string> = {};
function getTypeColor(typeName: string) {
  if (!TYPE_COLOR_MAP[typeName]) {
    const colors = [
      "bg-blue-100 text-blue-800",
      "bg-emerald-100 text-emerald-800",
      "bg-amber-100 text-amber-800",
      "bg-purple-100 text-purple-800",
      "bg-rose-100 text-rose-800",
      "bg-cyan-100 text-cyan-800",
    ];
    TYPE_COLOR_MAP[typeName] = colors[Object.keys(TYPE_COLOR_MAP).length % colors.length];
  }
  return TYPE_COLOR_MAP[typeName];
}

export function ScheduleManager({
  termId,
  termLabel,
  canEdit,
  courses,
  schedules,
}: {
  termId: number;
  termLabel: string;
  canEdit: boolean;
  courses: Course[];
  schedules: Schedule[];
}) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 按星期分组
  const byDay = new Map<number, Schedule[]>();
  for (let i = 0; i < 7; i++) byDay.set(i, []);
  for (const s of schedules) {
    byDay.get(s.dayOfWeek)?.push(s);
  }

  async function handleDelete(id: string, label: string) {
    if (!confirm(`确定要删除 "${label}" 的这个时间段吗？`)) return;
    try {
      const res = await fetch(`/api/schedules/${id}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ _method: "DELETE" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "删除失败");
      window.location.reload();
    } catch (e: any) {
      alert(e.message || "网络错误");
    }
  }

  return (
    <>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold text-gray-800">
          {termLabel} · 共 {schedules.length} 节
        </h2>
        {canEdit && (
          <button
            onClick={() => setShowAddModal(true)}
            className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 text-sm"
          >
            ➕ 添加课时
          </button>
        )}
      </div>

      {schedules.length === 0 ? (
        <div className="card-modern p-12 text-center">
          <div className="text-5xl mb-3">📅</div>
          <p className="text-gray-600 mb-3">本学期暂无课表安排</p>
          {canEdit && (
            <button
              onClick={() => setShowAddModal(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
            >
              添加第一个课时
            </button>
          )}
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-7 gap-3">
          {Array.from(byDay.entries())
            .sort(([a], [b]) => {
              const order = [1, 2, 3, 4, 5, 6, 0];
              return order.indexOf(a) - order.indexOf(b);
            })
            .map(([day, daySchedules]) => (
              <div
                key={day}
                className={`p-3 rounded-xl border ${DAY_COLORS[day]} min-h-[100px]`}
              >
                <div className="text-xs font-bold text-gray-700 mb-2 pb-2 border-b border-gray-200">
                  {DAY_NAMES[day]}
                  <span className="text-gray-400 ml-1 font-normal">({daySchedules.length})</span>
                </div>
                <div className="space-y-2">
                  {daySchedules.length === 0 ? (
                    <div className="text-xs text-gray-400 text-center py-4">无安排</div>
                  ) : (
                    daySchedules.map((s) => (
                      <div
                        key={s.id}
                        className="bg-white p-2 rounded border border-gray-200 hover:shadow-sm transition-shadow"
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="text-xs font-mono text-gray-600">
                            {s.startTime} - {s.endTime}
                          </div>
                          {canEdit && (
                            <button
                              onClick={() => handleDelete(s.id, s.courseName)}
                              className="text-red-500 hover:text-red-700 text-xs"
                              title="删除"
                            >
                              ✕
                            </button>
                          )}
                        </div>
                        <div className="font-medium text-sm text-gray-800 mt-1">
                          {s.courseName}
                        </div>
                        <div className="mt-1 flex items-center gap-1 flex-wrap">
                          <span
                            className={`inline-block px-1.5 py-0.5 text-[10px] rounded ${getTypeColor(
                              s.typeName
                            )}`}
                          >
                            {s.typeName}
                          </span>
                          {s.teacherNames.length > 0 && (
                            <span className="text-[10px] text-gray-500">
                              👨‍🏫 {s.teacherNames.join(", ")}
                            </span>
                          )}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            ))}
        </div>
      )}

      {showAddModal && (
        <AddScheduleModal
          termId={termId}
          courses={courses}
          onClose={() => setShowAddModal(false)}
        />
      )}
    </>
  );
}

function AddScheduleModal({
  termId,
  courses,
  onClose,
}: {
  termId: number;
  courses: Course[];
  onClose: () => void;
}) {
  const [courseId, setCourseId] = useState("");
  const [dayOfWeek, setDayOfWeek] = useState(1);
  const [startTime, setStartTime] = useState("16:00");
  const [endTime, setEndTime] = useState("17:30");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    if (!courseId) {
      setError("请选择课程");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/schedules", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          termId,
          courseId: Number(courseId),
          dayOfWeek,
          startTime,
          endTime,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "创建失败");
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold mb-4">添加课时安排</h3>

        <div className="space-y-3">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">课程 *</label>
            <select
              value={courseId}
              onChange={(e) => setCourseId(e.target.value)}
              className="input-modern w-full"
            >
              <option value="">请选择课程</option>
              {courses.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.typeName})
                  {c.teacherNames.length > 0 ? ` - ${c.teacherNames.join(", ")}` : ""}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">星期 *</label>
            <div className="grid grid-cols-7 gap-1">
              {[1, 2, 3, 4, 5, 6, 0].map((d) => (
                <button
                  key={d}
                  type="button"
                  onClick={() => setDayOfWeek(d)}
                  className={`py-2 text-sm rounded ${
                    dayOfWeek === d
                      ? "bg-blue-600 text-white"
                      : "bg-gray-100 hover:bg-gray-200 text-gray-700"
                  }`}
                >
                  {DAY_NAMES[d]}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">开始时间 *</label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="input-modern w-full"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">结束时间 *</label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="input-modern w-full"
              />
            </div>
          </div>

          {error && (
            <div className="text-sm text-red-600 bg-red-50 p-2 rounded">❌ {error}</div>
          )}
        </div>

        <div className="mt-4 flex gap-2">
          <button
            onClick={onClose}
            disabled={busy}
            className="flex-1 py-2 bg-gray-100 hover:bg-gray-200 rounded text-sm"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            disabled={busy || !courseId}
            className="flex-1 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50 text-sm font-medium"
          >
            {busy ? "保存中..." : "保存"}
          </button>
        </div>
      </div>
    </div>
  );
}
