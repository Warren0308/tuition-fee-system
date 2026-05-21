"use client";

import React, { useState } from 'react';

interface CourseType {
  id: number;
  name: string;
  orderIndex: number;
}

interface Course {
  id: number;
  name: string;
  typeId: number;
  type: CourseType;
}

interface CourseManagerProps {
  types: CourseType[];
  courses: Course[];
}

export function CourseManager({ types, courses }: CourseManagerProps) {
  const [showTypeModal, setShowTypeModal] = useState(false);
  const [showCourseModal, setShowCourseModal] = useState(false);
  const [newTypeName, setNewTypeName] = useState('');
  const [newCourseName, setNewCourseName] = useState('');
  const [selectedTypeId, setSelectedTypeId] = useState<number>(0);
  const [editingTypeId, setEditingTypeId] = useState<number | null>(null);
  const [editingTypeName, setEditingTypeName] = useState('');
  const [editingCourseId, setEditingCourseId] = useState<number | null>(null);
  const [editingCourseName, setEditingCourseName] = useState('');
  const [editingCourseTypeId, setEditingCourseTypeId] = useState<number>(0);

  const coursesByType = courses.reduce((acc, course) => {
    if (!acc[course.typeId]) acc[course.typeId] = [];
    acc[course.typeId].push(course);
    return acc;
  }, {} as Record<number, Course[]>);

  const handleAddType = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTypeName.trim()) return;
    try {
      const res = await fetch('/api/admin/catalog/dicts/course-type', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newTypeName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '添加失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '添加失败');
    }
  };

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCourseName.trim() || !selectedTypeId) return;
    try {
      const res = await fetch('/api/admin/catalog/dicts/course', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newCourseName.trim(), typeId: selectedTypeId }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '添加失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '添加失败');
    }
  };

  const handleSaveTypeEdit = async (typeId: number) => {
    if (!editingTypeName.trim()) {
      alert('名称不能为空');
      return;
    }
    try {
      const res = await fetch('/api/admin/catalog/dicts/course-type', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: typeId, name: editingTypeName.trim() }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '更新失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  const handleSaveCourseEdit = async (courseId: number) => {
    if (!editingCourseName.trim()) {
      alert('名称不能为空');
      return;
    }
    try {
      const res = await fetch('/api/admin/catalog/dicts/course', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: courseId,
          name: editingCourseName.trim(),
          typeId: editingCourseTypeId,
        }),
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '更新失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '更新失败');
    }
  };

  const handleDeleteType = async (typeId: number, typeName: string) => {
    if (!confirm(`确定要删除课程类型"${typeName}"吗？\n注意：该类型下的所有课程都会被删除。`)) return;
    try {
      const res = await fetch(`/api/admin/catalog/dicts/course-type?id=${typeId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '删除失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  const handleDeleteCourse = async (courseId: number, courseName: string) => {
    if (!confirm(`确定要删除课程"${courseName}"吗？`)) return;
    try {
      const res = await fetch(`/api/admin/catalog/dicts/course?id=${courseId}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const d = await res.json();
        throw new Error(d.error || '删除失败');
      }
      window.location.reload();
    } catch (e: any) {
      alert(e.message || '删除失败');
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setShowTypeModal(true)}
          className="btn-modern bg-blue-600 hover:bg-blue-700 text-white px-4 py-2"
        >
          ➕ 添加课程类型
        </button>
        <button
          onClick={() => setShowCourseModal(true)}
          className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2"
          disabled={types.length === 0}
        >
          ➕ 添加课程
        </button>
      </div>

      <div className="grid gap-6">
        {types.map((type) => (
          <div key={type.id} className="card-modern">
            <div className="p-6">
              <div className="flex items-center justify-between mb-4 gap-2">
                {editingTypeId === type.id ? (
                  <div className="flex-1 flex items-center gap-2">
                    <input
                      type="text"
                      value={editingTypeName}
                      onChange={(e) => setEditingTypeName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveTypeEdit(type.id);
                        if (e.key === 'Escape') setEditingTypeId(null);
                      }}
                      autoFocus
                      className="flex-1 px-3 py-1.5 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      onClick={() => handleSaveTypeEdit(type.id)}
                      className="px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                    >
                      保存
                    </button>
                    <button
                      onClick={() => setEditingTypeId(null)}
                      className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                    >
                      取消
                    </button>
                  </div>
                ) : (
                  <>
                    <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
                      <span>{type.name}</span>
                      <span className="text-sm text-gray-500 font-normal">
                        ({coursesByType[type.id]?.length || 0} 个课程)
                      </span>
                    </h3>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => {
                          setEditingTypeId(type.id);
                          setEditingTypeName(type.name);
                        }}
                        className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg"
                        title="编辑类型名称"
                      >
                        ✏️
                      </button>
                      <button
                        onClick={() => handleDeleteType(type.id, type.name)}
                        className="p-2 text-red-600 hover:text-red-800 hover:bg-red-50 rounded-lg"
                        title="删除类型"
                      >
                        🗑️
                      </button>
                    </div>
                  </>
                )}
              </div>
              <div className="grid gap-2">
                {coursesByType[type.id]?.map((course) =>
                  editingCourseId === course.id ? (
                    <div key={course.id} className="p-3 bg-amber-50 border border-amber-200 rounded space-y-2">
                      <input
                        type="text"
                        value={editingCourseName}
                        onChange={(e) => setEditingCourseName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') handleSaveCourseEdit(course.id);
                          if (e.key === 'Escape') setEditingCourseId(null);
                        }}
                        autoFocus
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                        placeholder="课程名称"
                      />
                      <select
                        value={editingCourseTypeId}
                        onChange={(e) => setEditingCourseTypeId(Number(e.target.value))}
                        className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:ring-2 focus:ring-blue-500"
                      >
                        {types.map((t) => (
                          <option key={t.id} value={t.id}>
                            归属：{t.name}
                          </option>
                        ))}
                      </select>
                      <div className="flex gap-2">
                        <button
                          onClick={() => handleSaveCourseEdit(course.id)}
                          className="flex-1 px-3 py-1.5 bg-blue-600 text-white rounded text-sm hover:bg-blue-700"
                        >
                          保存
                        </button>
                        <button
                          onClick={() => setEditingCourseId(null)}
                          className="px-3 py-1.5 bg-gray-200 text-gray-700 rounded text-sm hover:bg-gray-300"
                        >
                          取消
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={course.id}
                      className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded group hover:bg-gray-100 transition-colors"
                    >
                      <span className="font-medium text-gray-800">{course.name}</span>
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingCourseId(course.id);
                            setEditingCourseName(course.name);
                            setEditingCourseTypeId(course.typeId);
                          }}
                          className="p-1.5 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded"
                          title="编辑"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => handleDeleteCourse(course.id, course.name)}
                          className="p-1.5 text-red-600 hover:text-red-800 hover:bg-red-50 rounded"
                          title="删除"
                        >
                          🗑️
                        </button>
                      </div>
                    </div>
                  )
                )}
                {(!coursesByType[type.id] || coursesByType[type.id].length === 0) && (
                  <div className="text-center py-4 text-gray-500 text-sm">暂无课程</div>
                )}
              </div>
            </div>
          </div>
        ))}
        {types.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <div className="text-4xl mb-2">📚</div>
            <p>暂无课程类型</p>
            <p className="text-sm text-gray-400 mt-1">请先添加课程类型</p>
          </div>
        )}
      </div>

      {/* 添加课程类型模态框 */}
      {showTypeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加课程类型</h3>
            <form onSubmit={handleAddType} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">类型名称</label>
                <input
                  type="text"
                  value={newTypeName}
                  onChange={(e) => setNewTypeName(e.target.value)}
                  className="input-modern w-full"
                  placeholder="如：补习班、写作班"
                  required
                  autoFocus
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowTypeModal(false);
                    setNewTypeName('');
                  }}
                  className="btn-modern bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  取消
                </button>
                <button type="submit" className="btn-modern bg-blue-600 hover:bg-blue-700 text-white">
                  确认添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* 添加课程模态框 */}
      {showCourseModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg p-6 w-full max-w-md">
            <h3 className="text-lg font-semibold mb-4">添加课程</h3>
            <form onSubmit={handleAddCourse} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">课程类型</label>
                <select
                  value={selectedTypeId}
                  onChange={(e) => setSelectedTypeId(Number(e.target.value))}
                  className="input-modern w-full"
                  required
                >
                  <option value="">选择课程类型</option>
                  {types.map((type) => (
                    <option key={type.id} value={type.id}>
                      {type.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">课程名称</label>
                <input
                  type="text"
                  value={newCourseName}
                  onChange={(e) => setNewCourseName(e.target.value)}
                  className="input-modern w-full"
                  placeholder="如：华文、数学"
                  required
                />
              </div>
              <div className="flex justify-end gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowCourseModal(false);
                    setNewCourseName('');
                    setSelectedTypeId(0);
                  }}
                  className="btn-modern bg-gray-100 hover:bg-gray-200 text-gray-700"
                >
                  取消
                </button>
                <button type="submit" className="btn-modern bg-green-600 hover:bg-green-700 text-white">
                  确认添加
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
