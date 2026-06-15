"use client";

import React, { useState, useEffect } from 'react';
import { getCourseTypeName, getCourseDisplayName } from '@/lib/course-utils';

interface Grade {
  id: number;
  name: string;
  orderIndex: number;
}

interface Course {
  id: number;
  code: string;
  name: string;
  group: 'HOMEWORK' | 'TUITION' | 'WRITING' | 'SEC_ENGLISH' | 'SEC_MALAY' | 'SEC_MATH' | 'SEC_HISTORY' | 'SEC_EN_WRITING';
  isActive: boolean;
}

interface Fee {
  id: number;
  courseId: number;
  gradeId: number;
  amountCents: number;
  course: Course;
  grade: Grade;
}

interface SubjectFeeManagerProps {
  grades: Grade[];
  courses: Course[];
  fees: Fee[];
}

export function SubjectFeeManager({ grades, courses, fees }: SubjectFeeManagerProps) {
  const [selectedGrade, setSelectedGrade] = useState<number>(grades[0]?.id || 0);
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showBatchEditModal, setShowBatchEditModal] = useState(false);
  const [selectedFeesForEdit, setSelectedFeesForEdit] = useState<number[]>([]);
  const [availableCourses, setAvailableCourses] = useState<Record<string, { id: number; name: string; isExisting: boolean }[]>>({});
  const [error, setError] = useState<string | null>(null);

  // 课程类型颜色映射
  const typeColors = {
    '小学课程': 'bg-blue-100 text-blue-800 border-blue-200',
    '中学课程': 'bg-green-100 text-green-800 border-green-200',
    '独立课程': 'bg-purple-100 text-purple-800 border-purple-200',
    '其他': 'bg-gray-100 text-gray-800 border-gray-200'
  };

  // 获取当前年级的费用
  const getCurrentGradeFees = () => {
    return fees.filter(fee => fee.gradeId === selectedGrade);
  };

  // 获取可用课程
  const fetchAvailableCourses = async () => {
    try {
      setError(null);
      const response = await fetch(`/api/admin/catalog/fees/available-courses?gradeId=${selectedGrade}`);
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || '获取失败');
      }
      const data = await response.json();
      console.log('获取到的课程数据:', data);
      setAvailableCourses(data);
    } catch (error) {
      console.error('获取可用课程失败:', error);
      setError(error instanceof Error ? error.message : '获取可用课程失败，请重试');
    }
  };

  // 当年级改变时，重新获取可用课程
  useEffect(() => {
    if (showAddModal) {
      fetchAvailableCourses();
    }
  }, [selectedGrade, showAddModal]);

  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  // 批量更新费用
  const handleBatchUpdate = async (newAmount: number) => {
    try {
      const response = await fetch('/api/admin/catalog/fees/batch-update', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          feeIds: selectedFeesForEdit,
          amountCents: newAmount,
        }),
      });

      if (!response.ok) throw new Error('更新失败');

      alert('更新成功');
      window.location.reload();
    } catch (error) {
      alert('更新失败，请重试');
    }
  };

  // 按课程类型分组当前年级的费用
  const groupFeesByType = () => {
    const grouped: Record<string, Fee[]> = {
      '小学课程': [],
      '中学课程': [],
      '独立课程': [],
      '其他': []
    };

    const currentFees = getCurrentGradeFees();
    currentFees.forEach(fee => {
      const typeName = getCourseTypeName(fee.course.group);
      grouped[typeName].push(fee);
    });

    // 移除空数组
    Object.keys(grouped).forEach(key => {
      if (grouped[key].length === 0) {
        delete grouped[key];
      }
    });

    return grouped;
  };

  return (
    <div className="space-y-6">
      {/* 年级选择 */}
      <div className="card-modern">
        <div className="p-6">
          <div className="flex items-center space-x-4">
            <label className="text-sm font-medium text-gray-700">选择年级：</label>
            <select
              value={selectedGrade}
              onChange={(e) => setSelectedGrade(Number(e.target.value))}
              className="input-modern px-3 py-2"
            >
              {grades.map(grade => (
                <option key={grade.id} value={grade.id}>{grade.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* 科目费用设置 */}
      <div className="card-modern">
        <div className="p-6">
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center space-x-3">
              <div className="w-12 h-12 bg-blue-100 rounded-xl flex items-center justify-center text-2xl">
                📚
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-800">科目费用设置</h2>
                <p className="text-gray-600 text-sm">为每个科目设置收费标准</p>
              </div>
            </div>
            <div className="flex items-center space-x-3">
              {selectedFeesForEdit.length > 0 && (
                <button
                  type="button"
                  onClick={() => setShowBatchEditModal(true)}
                  className="btn-modern bg-yellow-600 hover:bg-yellow-700 text-white px-4 py-2 flex items-center space-x-2"
                >
                  <span>✏️</span>
                  <span>修改金额</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setShowAddModal(true)}
                className="btn-modern bg-green-600 hover:bg-green-700 text-white px-4 py-2 flex items-center space-x-2"
              >
                <span>➕</span>
                <span>添加课程</span>
              </button>
            </div>
          </div>

          {/* 当前年级的费用列表 */}
          <div>
            <h3 className="text-lg font-semibold text-gray-800 mb-4">
              {grades.find(g => g.id === selectedGrade)?.name} - 已设置费用
            </h3>
            <div className="grid gap-4">
              {Object.entries(groupFeesByType()).map(([typeName, typeFees]) => {
                if (typeFees.length === 0) return null;
                
                return (
                  <div key={typeName} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className={`px-2 py-1 rounded text-sm border ${(typeColors as Record<string, string>)[typeName] || typeColors['其他']}`}>
                        {typeName}
                      </span>
                      <span className="text-sm text-gray-500">({typeFees.length} 个科目)</span>
                    </div>
                    <div className="grid gap-2">
                      {typeFees.map(fee => (
                        <div key={fee.id} className="flex items-center justify-between py-2 px-3 bg-gray-50 rounded group">
                          <div className="flex items-center space-x-3">
                            <input
                              type="checkbox"
                              checked={selectedFeesForEdit.includes(fee.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedFeesForEdit([...selectedFeesForEdit, fee.id]);
                                } else {
                                  setSelectedFeesForEdit(selectedFeesForEdit.filter(id => id !== fee.id));
                                }
                              }}
                              className="form-checkbox h-4 w-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="font-medium text-gray-800">
                              {getCourseDisplayName(fee.course.name)}
                            </span>
                          </div>
                          <div className="flex items-center space-x-3">
                            <span className="text-lg font-semibold text-green-600">
                              {formatMoney(fee.amountCents)}
                            </span>
                            <button
                              type="button"
                              onClick={async () => {
                                if (confirm(`确定要删除 ${getCourseDisplayName(fee.course.name)} 的费用设置吗？`)) {
                                  try {
                                    const response = await fetch(`/api/admin/catalog/fees/delete?id=${fee.id}`, {
                                      method: 'DELETE'
                                    });
                                    
                                    if (!response.ok) throw new Error('删除失败');
                                    
                                    alert('删除成功');
                                    window.location.reload();
                                  } catch (error) {
                                    alert('删除失败，请重试');
                                  }
                                }
                              }}
                              className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 text-red-600 hover:text-red-800"
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M9 2a1 1 0 00-.894.553L7.382 4H4a1 1 0 000 2v10a2 2 0 002 2h8a2 2 0 002-2V6a1 1 0 100-2h-3.382l-.724-1.447A1 1 0 0011 2H9zM7 8a1 1 0 012 0v6a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v6a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
              
              {getCurrentGradeFees().length === 0 && (
                <div className="text-center py-8 text-gray-500">
                  <div className="text-4xl mb-2">💰</div>
                  <p>该年级暂无费用设置</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* 添加课程模态框 */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">添加课程费用</h3>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700">
                {error}
              </div>
            )}
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">选择课程</label>
                <div className="grid gap-2">
                  {Object.entries(availableCourses).map(([typeName, courses]) => (
                    <div key={typeName} className="border rounded p-3">
                      <div className="font-medium mb-2">{typeName}</div>
                      <div className="space-y-2">
                        {courses.map(course => (
                          <label 
                            key={course.id} 
                            className={`flex items-center space-x-2 ${
                              course.isExisting 
                                ? 'opacity-50 cursor-not-allowed bg-gray-50 rounded px-2 py-1' 
                                : 'cursor-pointer hover:bg-gray-50 rounded px-2 py-1'
                            }`}
                          >
                            <input
                              type="checkbox"
                              checked={selectedCourses.includes(course.id)}
                              onChange={(e) => {
                                if (e.target.checked) {
                                  setSelectedCourses([...selectedCourses, course.id]);
                                } else {
                                  setSelectedCourses(selectedCourses.filter(id => id !== course.id));
                                }
                              }}
                              disabled={course.isExisting}
                              className={`form-checkbox h-4 w-4 rounded border-gray-300 focus:ring-blue-500 ${
                                course.isExisting 
                                  ? 'text-gray-400 cursor-not-allowed' 
                                  : 'text-blue-600 cursor-pointer'
                              }`}
                            />
                            <div className="flex-1">
                              <span className={course.isExisting ? 'text-gray-400' : 'text-gray-700'}>
                                {course.name}
                              </span>
                              {course.isExisting && (
                                <span className="ml-2 inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-gray-100 text-gray-500">
                                  已添加
                                </span>
                              )}
                            </div>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                  {Object.keys(availableCourses).length === 0 && !error && (
                    <div className="text-center py-8 text-gray-500">
                      <div className="text-4xl mb-2">📚</div>
                      <p>该年级已添加所有可用课程</p>
                    </div>
                  )}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">金额 (RM)</label>
                <input
                  type="number"
                  name="amount"
                  step="0.01"
                  placeholder="输入金额"
                  className="input-modern w-full"
                  required
                />
              </div>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowAddModal(false);
                  setSelectedCourses([]);
                  setError(null);
                }}
                className="btn-modern bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  if (selectedCourses.length === 0) {
                    alert('请选择至少一个课程');
                    return;
                  }

                  const amountInput = document.querySelector('input[name="amount"]') as HTMLInputElement;
                  if (!amountInput?.value) {
                    alert('请输入金额');
                    return;
                  }

                  const amountCents = Math.round(parseFloat(amountInput.value) * 100);

                  try {
                    const response = await fetch('/api/admin/catalog/fees', {
                      method: 'POST',
                      headers: {
                        'Content-Type': 'application/json',
                      },
                      body: JSON.stringify({
                        courseIds: selectedCourses,
                        gradeId: selectedGrade,
                        amountCents,
                      }),
                    });

                    if (!response.ok) {
                      const errorData = await response.json();
                      throw new Error(errorData.error || '保存失败');
                    }

                    alert('添加成功');
                    window.location.reload();
                  } catch (error) {
                    alert(error instanceof Error ? error.message : '添加失败，请重试');
                  }
                }}
                className="btn-modern bg-blue-600 hover:bg-blue-700 text-white"
              >
                确认添加
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 批量修改金额模态框 */}
      {showBatchEditModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-lg">
            <h3 className="text-lg font-semibold mb-4">批量修改金额</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">新金额 (RM)</label>
                <input
                  type="number"
                  name="batchAmount"
                  step="0.01"
                  placeholder="输入新金额"
                  className="input-modern w-full"
                  required
                />
              </div>
              <p className="text-sm text-gray-500">
                将修改 {selectedFeesForEdit.length} 个已选择的课程费用
              </p>
            </div>
            <div className="mt-6 flex justify-end space-x-3">
              <button
                type="button"
                onClick={() => {
                  setShowBatchEditModal(false);
                }}
                className="btn-modern bg-gray-100 hover:bg-gray-200 text-gray-700"
              >
                取消
              </button>
              <button
                type="button"
                onClick={async () => {
                  const amountInput = document.querySelector('input[name="batchAmount"]') as HTMLInputElement;
                  if (!amountInput?.value) {
                    alert('请输入金额');
                    return;
                  }

                  const amountCents = Math.round(parseFloat(amountInput.value) * 100);
                  await handleBatchUpdate(amountCents);
                }}
                className="btn-modern bg-blue-600 hover:bg-blue-700 text-white"
              >
                确认修改
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}