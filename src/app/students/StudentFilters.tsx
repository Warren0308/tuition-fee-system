"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";

interface Grade { id: number; name: string }
interface School { id: number; name: string }

export function StudentFilters({
  initialQ,
  initialGradeId,
  initialSchoolId,
  initialClassName,
  initialStatus,
  grades,
  schools,
  classNames,
}: {
  initialQ: string;
  initialGradeId: string;
  initialSchoolId: string;
  initialClassName: string;
  initialStatus: string;
  grades: Grade[];
  schools: School[];
  classNames: string[];
}) {
  const router = useRouter();
  const [q, setQ] = useState(initialQ);
  const [gradeId, setGradeId] = useState(initialGradeId);
  const [schoolId, setSchoolId] = useState(initialSchoolId);
  const [className, setClassName] = useState(initialClassName);
  const [status, setStatus] = useState(initialStatus);
  const [showAdvanced, setShowAdvanced] = useState(
    !!(initialGradeId || initialSchoolId || initialClassName) ||
      (initialStatus && initialStatus !== "active")
  );

  function buildUrl(overrides?: Partial<{
    q: string; gradeId: string; schoolId: string; className: string; status: string;
  }>) {
    const params = new URLSearchParams();
    const finalQ = overrides?.q ?? q;
    const finalGrade = overrides?.gradeId ?? gradeId;
    const finalSchool = overrides?.schoolId ?? schoolId;
    const finalClass = overrides?.className ?? className;
    const finalStatus = overrides?.status ?? status;

    if (finalQ) params.set("q", finalQ);
    if (finalGrade) params.set("gradeId", finalGrade);
    if (finalSchool) params.set("schoolId", finalSchool);
    if (finalClass) params.set("className", finalClass);
    if (finalStatus && finalStatus !== "active") params.set("status", finalStatus);

    return `/students${params.toString() ? `?${params.toString()}` : ""}`;
  }

  function applyFilters() {
    router.push(buildUrl());
  }

  function clearAll() {
    setQ("");
    setGradeId("");
    setSchoolId("");
    setClassName("");
    setStatus("active");
    router.push("/students");
  }

  return (
    <div className="card-modern p-4 space-y-3">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔍</span>
          <input
            type="text"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") applyFilters();
            }}
            placeholder="搜索学生姓名..."
            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
          />
        </div>
        <button
          onClick={applyFilters}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
        >
          搜索
        </button>
        <button
          onClick={() => setShowAdvanced(!showAdvanced)}
          className={`px-3 py-2 rounded-lg text-sm border ${
            showAdvanced
              ? "bg-blue-50 border-blue-200 text-blue-700"
              : "bg-white border-gray-200 text-gray-700 hover:bg-gray-50"
          }`}
        >
          {showAdvanced ? "▴ 收起" : "▾ 筛选"}
        </button>
      </div>

      {showAdvanced && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-3 border-t border-gray-100">
          <div>
            <label className="block text-xs text-gray-600 mb-1">年级</label>
            <select
              value={gradeId}
              onChange={(e) => setGradeId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">全部年级</option>
              {grades.map((g) => (
                <option key={g.id} value={g.id}>{g.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">学校</label>
            <select
              value={schoolId}
              onChange={(e) => setSchoolId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">全部学校</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>{s.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">班级</label>
            <select
              value={className}
              onChange={(e) => setClassName(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="">全部班级</option>
              {classNames.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs text-gray-600 mb-1">状态</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              <option value="active">仅在读</option>
              <option value="inactive">仅已停用</option>
              <option value="all">全部</option>
            </select>
          </div>

          <div className="col-span-2 md:col-span-4 flex gap-2 pt-2">
            <button
              onClick={applyFilters}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm font-medium"
            >
              应用筛选
            </button>
            <button
              onClick={clearAll}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 text-sm"
            >
              清除全部
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
