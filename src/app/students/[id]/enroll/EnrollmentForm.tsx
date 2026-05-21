"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatTermLabel } from "@/lib/term-utils";

interface Course {
  id: number;
  code: string;
  name: string;
  group: string;
  defaultPrice: number;
}

interface Term {
  id: number;
  year: number;
  termIndex: number;
  period: number;
  startDate: string;
  endDate: string;
}

interface ExtraFee {
  id: number;
  code: string;
  name: string;
  defaultPrice: number;
}

interface Props {
  studentId: string;
  coursesByGroup: Record<string, Course[]>;
  enrolledCourseIds: number[];
  terms: Term[];
  extraFees: ExtraFee[];
  courseGroupNames: Record<string, string>;
  courseGroupColors: Record<string, string>;
}

export function EnrollmentForm({
  studentId,
  coursesByGroup,
  enrolledCourseIds,
  terms,
  extraFees,
  courseGroupNames,
  courseGroupColors,
}: Props) {
  const router = useRouter();
  const [selectedCourses, setSelectedCourses] = useState<number[]>([]);
  const [startTermId, setStartTermId] = useState<string>("");
  const [selectedExtraFees, setSelectedExtraFees] = useState<Record<number, { enabled: boolean; customPrice: string }>>({});
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const termLabelTerms = terms.map((t) => ({
    year: t.year,
    termIndex: t.termIndex,
    period: t.period,
  }));

  // 格式化金额
  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  // 格式化日期
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('zh-CN', { 
      month: 'short', 
      day: 'numeric' 
    });
  };

  // 切换课程选择
  const toggleCourse = (courseId: number) => {
    setSelectedCourses(prev => 
      prev.includes(courseId)
        ? prev.filter(id => id !== courseId)
        : [...prev, courseId]
    );
  };

  // 切换额外费用
  const toggleExtraFee = (feeId: number, defaultPrice: number) => {
    setSelectedExtraFees(prev => ({
      ...prev,
      [feeId]: {
        enabled: !prev[feeId]?.enabled,
        customPrice: prev[feeId]?.customPrice || ""
      }
    }));
  };

  // 更新额外费用的自定义价格
  const updateExtraFeePrice = (feeId: number, price: string) => {
    setSelectedExtraFees(prev => ({
      ...prev,
      [feeId]: {
        enabled: prev[feeId]?.enabled || false,
        customPrice: price
      }
    }));
  };

  // 计算总价
  const calculateTotal = () => {
    let total = 0;
    
    // 课程费用
    for (const group of Object.values(coursesByGroup)) {
      for (const course of group) {
        if (selectedCourses.includes(course.id)) {
          total += course.defaultPrice;
        }
      }
    }
    
    // 额外费用
    for (const fee of extraFees) {
      if (selectedExtraFees[fee.id]?.enabled) {
        const customPrice = selectedExtraFees[fee.id]?.customPrice;
        if (customPrice && parseFloat(customPrice) > 0) {
          total += Math.round(parseFloat(customPrice) * 100);
        } else {
          total += fee.defaultPrice;
        }
      }
    }
    
    return total;
  };

  // 提交表单
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (selectedCourses.length === 0) {
      setError("请至少选择一门课程");
      return;
    }
    
    if (!startTermId) {
      setError("请选择开始学期");
      return;
    }
    
    setIsSubmitting(true);
    setError(null);
    
    try {
      // 准备额外费用数据
      const extraFeesData = extraFees
        .filter(fee => selectedExtraFees[fee.id]?.enabled)
        .map(fee => ({
          id: fee.id,
          code: fee.code,
          customPrice: selectedExtraFees[fee.id]?.customPrice 
            ? Math.round(parseFloat(selectedExtraFees[fee.id].customPrice) * 100)
            : null
        }));
      
      const response = await fetch(`/api/enrollments/student/${studentId}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          courseIds: selectedCourses,
          startTermId: parseInt(startTermId),
          extraFees: extraFeesData,
        }),
      });
      
      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || "选课失败");
      }
      
      router.refresh();
      setSelectedCourses([]);
      setStartTermId("");
      setSelectedExtraFees({});
    } catch (err) {
      setError(err instanceof Error ? err.message : "选课失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="card-modern animate-fade-in">
      <div className="p-6">
        <div className="flex items-center space-x-3 mb-6">
          <div className="w-12 h-12 bg-green-100 rounded-xl flex items-center justify-center text-2xl">
            ➕
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-800">新增选课</h2>
            <p className="text-gray-600 text-sm">可多选课程，选择开始学期</p>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">
            ⚠️ {error}
          </div>
        )}

        {/* 检查是否有可选课程 */}
        {Object.keys(coursesByGroup).length === 0 ? (
          <div className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300">
            <div className="text-5xl mb-4">📋</div>
            <h3 className="text-lg font-medium text-gray-800 mb-2">暂无可选课程</h3>
            <p className="text-gray-600 mb-4">
              该学生的年级尚未设置任何课程费用
            </p>
            <a 
              href="/admin/catalog/fees"
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <span className="mr-2">⚙️</span>
              前往科目费用设置
            </a>
          </div>
        ) : (
        <form onSubmit={handleSubmit} className="space-y-6">
          <div className="grid lg:grid-cols-3 gap-6">
            {/* 课程选择 - 多选 */}
            <div className="lg:col-span-2">
              <label className="block text-sm font-medium text-gray-700 mb-3">
                选择课程 
                <span className="text-blue-600 ml-2">
                  (已选 {selectedCourses.length} 门)
                </span>
              </label>
              <div className="space-y-4">
                {Object.entries(coursesByGroup).map(([group, groupCourses]) => (
                  <div key={group} className="border border-gray-200 rounded-lg p-4">
                    <div className="flex items-center space-x-2 mb-3">
                      <span className={`px-2 py-1 rounded text-sm border font-medium ${courseGroupColors[group] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                        {courseGroupNames[group] || group}
                      </span>
                      <span className="text-sm text-gray-500">({groupCourses.length} 个科目)</span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {groupCourses.map(course => {
                        const isEnrolled = enrolledCourseIds.includes(course.id);
                        const isSelected = selectedCourses.includes(course.id);
                        
                        return (
                          <label 
                            key={course.id} 
                            className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${
                              isEnrolled 
                                ? 'bg-gray-100 border-gray-300 opacity-50 cursor-not-allowed' 
                                : isSelected
                                  ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-200'
                                  : 'bg-white border-gray-200 hover:border-blue-300 hover:bg-blue-50'
                            }`}
                          >
                            <div className="flex items-center space-x-3">
                              <input 
                                type="checkbox" 
                                checked={isSelected}
                                onChange={() => !isEnrolled && toggleCourse(course.id)}
                                disabled={isEnrolled}
                                className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                              />
                              <div>
                                <div className="font-medium text-gray-800">{course.name}</div>
                                <div className="text-xs text-gray-500">{course.code}</div>
                              </div>
                            </div>
                            <div className="text-right">
                              <div className="font-medium text-green-600">
                                {course.defaultPrice > 0 ? formatMoney(course.defaultPrice) : '待设置'}
                              </div>
                              {isEnrolled && (
                                <div className="text-xs text-gray-500">已选课</div>
                              )}
                            </div>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* 学期和费用设置 */}
            <div className="space-y-6">
              {/* 开始学期 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">开始学期</label>
                <select 
                  value={startTermId}
                  onChange={(e) => setStartTermId(e.target.value)}
                  className="input-modern w-full" 
                  required
                >
                  <option value="">选择学期</option>
                  {terms.map(term => (
                    <option key={term.id} value={term.id}>
                      {formatTermLabel(term.year, term.termIndex, termLabelTerms)} ({formatDate(term.startDate)} - {formatDate(term.endDate)})
                    </option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  💡 选择课程开始的学期，之后的学期将自动继续
                </p>
              </div>

              {/* 额外费用 - 支持自定义价格 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">额外费用</label>
                <div className="space-y-3">
                  {extraFees.map(fee => {
                    const isSelected = selectedExtraFees[fee.id]?.enabled || false;
                    const customPrice = selectedExtraFees[fee.id]?.customPrice || "";
                    
                    return (
                      <div 
                        key={fee.id} 
                        className={`p-3 border rounded-lg transition-all ${
                          isSelected ? 'bg-blue-50 border-blue-300' : 'bg-white border-gray-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <label className="flex items-center space-x-2 cursor-pointer">
                            <input 
                              type="checkbox" 
                              checked={isSelected}
                              onChange={() => toggleExtraFee(fee.id, fee.defaultPrice)}
                              className="w-4 h-4 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                            />
                            <span className="text-sm font-medium text-gray-700">{fee.name}</span>
                          </label>
                          <span className="text-sm text-gray-500">
                            默认: {formatMoney(fee.defaultPrice)}
                          </span>
                        </div>
                        
                        {isSelected && (
                          <div className="mt-2 pl-6">
                            <div className="flex items-center space-x-2">
                              <span className="text-xs text-gray-500">自定义价格:</span>
                              <div className="relative flex-1">
                                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-gray-400 text-sm">RM</span>
                                <input 
                                  type="number"
                                  step="0.01"
                                  min="0"
                                  placeholder={`${(fee.defaultPrice / 100).toFixed(2)}`}
                                  value={customPrice}
                                  onChange={(e) => updateExtraFeePrice(fee.id, e.target.value)}
                                  className="input-modern w-full pl-10 py-1 text-sm"
                                />
                              </div>
                            </div>
                            <p className="text-xs text-gray-400 mt-1">
                              留空使用默认价格
                            </p>
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 费用预览 */}
              {(selectedCourses.length > 0 || Object.values(selectedExtraFees).some(f => f.enabled)) && (
                <div className="bg-gray-50 rounded-lg p-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">费用预览</h4>
                  <div className="space-y-2 text-sm">
                    {selectedCourses.map(courseId => {
                      const course = Object.values(coursesByGroup)
                        .flat()
                        .find(c => c.id === courseId);
                      return course ? (
                        <div key={courseId} className="flex justify-between">
                          <span className="text-gray-600">{course.name}</span>
                          <span className="text-gray-800">{formatMoney(course.defaultPrice)}</span>
                        </div>
                      ) : null;
                    })}
                    {extraFees.filter(fee => selectedExtraFees[fee.id]?.enabled).map(fee => {
                      const customPrice = selectedExtraFees[fee.id]?.customPrice;
                      const price = customPrice && parseFloat(customPrice) > 0
                        ? Math.round(parseFloat(customPrice) * 100)
                        : fee.defaultPrice;
                      return (
                        <div key={fee.id} className="flex justify-between">
                          <span className="text-gray-600">{fee.name}</span>
                          <span className="text-gray-800">
                            {formatMoney(price)}
                            {customPrice && parseFloat(customPrice) > 0 && (
                              <span className="text-xs text-blue-500 ml-1">(自定义)</span>
                            )}
                          </span>
                        </div>
                      );
                    })}
                    <div className="border-t pt-2 mt-2 flex justify-between font-medium">
                      <span className="text-gray-700">总计</span>
                      <span className="text-green-600">{formatMoney(calculateTotal())}</span>
                    </div>
                  </div>
                </div>
              )}

              <button 
                type="submit"
                disabled={isSubmitting || selectedCourses.length === 0}
                className={`btn-modern w-full py-3 font-medium transition-all ${
                  isSubmitting || selectedCourses.length === 0
                    ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center space-x-2">
                    <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                    </svg>
                    <span>处理中...</span>
                  </span>
                ) : (
                  `🎯 确认选课 (${selectedCourses.length} 门)`
                )}
              </button>
            </div>
          </div>
        </form>
        )}
      </div>
    </div>
  );
}
