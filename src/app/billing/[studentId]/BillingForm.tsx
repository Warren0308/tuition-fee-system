"use client";

import { useState, useRef } from "react";
import { formatTermLabelFull } from "@/lib/term-utils";

interface Course {
  id: number;
  name: string;
  code: string;
  group: string;
}

interface Enrollment {
  id: number;
  price: number;
  course: Course;
  subjects?: string[]; // 子科目名字（仅展示，不影响价格）
}

interface ExtraFee {
  id: number;
  extraFeeTypeId: number;
  amountCents: number;
  extraFeeType: { id: number; name: string; code: string };
  startTerm: { year: number; termIndex: number };
}

interface ExtraFeeType {
  id: number;
  code: string;
  name: string;
  defaultAmountCents?: number;
}

// 自定义额外费用项
interface CustomExtraFeeItem {
  id: string;
  name: string;
  amountCents: number;
}

interface Props {
  studentId: string;
  studentName: string;
  year: number;
  termIndex: number;
  enrollments: Enrollment[];
  extraFees: ExtraFee[];
  extraFeeTypes: ExtraFeeType[];
  gradeId: number;
  termLabels?: Array<{ year: number; termIndex: number; period: number }>;
  courseGroupNames: Record<string, string>;
  courseGroupColors: Record<string, string>;
}

export function BillingForm({
  studentId,
  studentName,
  year,
  termIndex,
  enrollments,
  extraFees,
  extraFeeTypes,
  gradeId,
  termLabels,
  courseGroupNames,
  courseGroupColors,
}: Props) {
  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  
  // 自定义额外费用列表
  const [customFees, setCustomFees] = useState<CustomExtraFeeItem[]>([]);
  const [newCustomName, setNewCustomName] = useState("");
  const [newCustomAmount, setNewCustomAmount] = useState("");
  
  // 临时额外费用选中状态和金额
  const [tempExtraSelected, setTempExtraSelected] = useState<Set<number>>(new Set());
  const [tempExtraPrices, setTempExtraPrices] = useState<Record<number, string>>({});
  
  // 课程价格状态（追踪用户修改）
  const [coursePrices, setCoursePrices] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    enrollments.forEach(e => {
      initial[e.course.id] = (e.price / 100).toFixed(2);
    });
    return initial;
  });
  
  // 已注册额外费用价格状态
  const [extraFeePrices, setExtraFeePrices] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    extraFees.forEach(f => {
      initial[f.extraFeeTypeId] = (f.amountCents / 100).toFixed(2);
    });
    return initial;
  });
  
  // 课程选中状态
  const [selectedCourses, setSelectedCourses] = useState<Set<number>>(() => {
    return new Set(enrollments.map(e => e.course.id));
  });
  
  // 已注册额外费用选中状态
  const [selectedExtraFees, setSelectedExtraFees] = useState<Set<number>>(() => {
    return new Set(extraFees.map(f => f.extraFeeTypeId));
  });

  // 格式化金额
  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  // 按课程组分组
  const coursesByGroup = enrollments.reduce((acc, enrollment) => {
    const group = enrollment.course.group;
    if (!acc[group]) {
      acc[group] = [];
    }
    acc[group].push(enrollment);
    return acc;
  }, {} as Record<string, Enrollment[]>);

  // 处理表单提交
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setShowConfirmModal(true);
  };

  // 确认提交
  const handleConfirm = () => {
    setIsSubmitting(true);
    formRef.current?.submit();
  };

  // 取消提交
  const handleCancel = () => {
    setShowConfirmModal(false);
  };

  // 添加自定义费用
  const addCustomFee = () => {
    if (!newCustomName.trim() || !newCustomAmount) return;
    const amountCents = Math.round(parseFloat(newCustomAmount) * 100);
    if (isNaN(amountCents) || amountCents <= 0) return;
    
    const newItem: CustomExtraFeeItem = {
      id: `custom_${Date.now()}`,
      name: newCustomName.trim(),
      amountCents
    };
    setCustomFees([...customFees, newItem]);
    setNewCustomName("");
    setNewCustomAmount("");
  };
  
  // 删除自定义费用
  const removeCustomFee = (id: string) => {
    setCustomFees(customFees.filter(f => f.id !== id));
  };
  
  // 切换临时额外费用选中状态
  const toggleTempExtra = (typeId: number) => {
    const newSet = new Set(tempExtraSelected);
    if (newSet.has(typeId)) {
      newSet.delete(typeId);
    } else {
      newSet.add(typeId);
    }
    setTempExtraSelected(newSet);
  };
  
  // 计算预计总额（使用用户修改后的价格）
  const calculateTotal = () => {
    let total = 0;
    
    // 课程费用（只计算选中的课程，使用用户输入的价格）
    enrollments.forEach(enrollment => {
      if (selectedCourses.has(enrollment.course.id)) {
        const priceStr = coursePrices[enrollment.course.id];
        if (priceStr) {
          const price = Math.round(parseFloat(priceStr) * 100);
          if (!isNaN(price) && price > 0) {
            total += price;
          }
        } else {
          total += enrollment.price;
        }
      }
    });
    
    // 已注册的额外费用（只计算选中的，使用用户输入的价格）
    extraFees.forEach(fee => {
      if (selectedExtraFees.has(fee.extraFeeTypeId)) {
        const priceStr = extraFeePrices[fee.extraFeeTypeId];
        if (priceStr) {
          const price = Math.round(parseFloat(priceStr) * 100);
          if (!isNaN(price) && price > 0) {
            total += price;
          }
        } else {
          total += fee.amountCents;
        }
      }
    });
    
    // 临时勾选的额外费用
    tempExtraSelected.forEach(typeId => {
      const priceStr = tempExtraPrices[typeId];
      if (priceStr) {
        const price = Math.round(parseFloat(priceStr) * 100);
        if (!isNaN(price) && price > 0) {
          total += price;
        }
      }
    });
    
    // 自定义费用
    customFees.forEach(fee => {
      total += fee.amountCents;
    });
    
    return total;
  };

  return (
    <>
      <form 
        ref={formRef}
        action={`/api/billing/student/${studentId}`} 
        method="post" 
        onSubmit={handleSubmit}
        className="space-y-6"
      >
        <input type="hidden" name="year" value={year} />
        <input type="hidden" name="termIndex" value={termIndex} />

        {/* 课程费用 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <span>📚</span>
            <span>课程费用</span>
          </h3>
          
          {Object.entries(coursesByGroup).map(([group, groupEnrollments]) => (
            <div key={group} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center space-x-2 mb-4">
                <span className={`px-2 py-1 rounded text-sm border font-medium ${courseGroupColors[group] || 'bg-gray-100 text-gray-800 border-gray-200'}`}>
                  {courseGroupNames[group] || group}
                </span>
                <span className="text-sm text-gray-500">({groupEnrollments.length} 门课程)</span>
              </div>

              <div className="space-y-3">
                {groupEnrollments.map(enrollment => {
                  const price = enrollment.price;
                  const isSelected = selectedCourses.has(enrollment.course.id);
                  return (
                    <div key={enrollment.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                      isSelected ? 'bg-gray-50 border-gray-200' : 'bg-gray-100 border-gray-200 opacity-50'
                    }`}>
                      <div className="flex items-center space-x-3">
                        <input 
                          type="checkbox" 
                          name="courseItems" 
                          value={enrollment.course.id}
                          checked={isSelected}
                          onChange={(e) => {
                            const newSet = new Set(selectedCourses);
                            if (e.target.checked) {
                              newSet.add(enrollment.course.id);
                            } else {
                              newSet.delete(enrollment.course.id);
                            }
                            setSelectedCourses(newSet);
                          }}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div>
                          <div className={`font-medium ${isSelected ? 'text-gray-800' : 'text-gray-500 line-through'}`}>
                            {enrollment.course.name}
                          </div>
                          <div className="text-sm text-gray-500">{enrollment.course.code}</div>
                          {enrollment.subjects && enrollment.subjects.length > 0 && (
                            <div className="mt-1 flex flex-wrap gap-1">
                              {enrollment.subjects.map((s) => (
                                <span
                                  key={s}
                                  className="inline-flex px-1.5 py-0.5 text-[10px] bg-blue-50 text-blue-700 border border-blue-200 rounded"
                                >
                                  {s}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                      <div className="text-right">
                        <div className="font-semibold text-gray-500 text-xs">原价: {formatMoney(price)}</div>
                        <input 
                          type="number" 
                          name={`course_${enrollment.course.id}_price`}
                          value={coursePrices[enrollment.course.id] || ''}
                          onChange={(e) => setCoursePrices({
                            ...coursePrices,
                            [enrollment.course.id]: e.target.value
                          })}
                          step="0.01"
                          className="input-modern text-sm w-28 mt-1"
                          placeholder="自定义价格"
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}

          {enrollments.length === 0 && (
            <div className="text-center py-8 text-gray-500 border border-gray-200 rounded-lg">
              <div className="text-4xl mb-2">📚</div>
              <p>该学生暂未选择任何课程</p>
              <a 
                href={`/students/${studentId}/enroll`}
                className="btn-modern bg-blue-600 text-white px-4 py-2 mt-4 inline-flex items-center space-x-2"
              >
                <span>📚</span>
                <span>选择课程</span>
              </a>
            </div>
          )}
        </div>

        {/* 额外费用 - 已注册的 */}
        {extraFees.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
              <span>🍽️</span>
              <span>额外费用</span>
              <span className="text-sm font-normal text-gray-500">(选课时已注册)</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extraFees.map(extraFee => {
                const isSelected = selectedExtraFees.has(extraFee.extraFeeTypeId);
                return (
                  <div key={extraFee.id} className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                    isSelected ? 'bg-orange-50 border-orange-200' : 'bg-gray-100 border-gray-200 opacity-50'
                  }`}>
                    <div className="flex items-center space-x-3">
                      <input 
                        type="checkbox" 
                        name="extraItems" 
                        value={extraFee.extraFeeTypeId}
                        checked={isSelected}
                        onChange={(e) => {
                          const newSet = new Set(selectedExtraFees);
                          if (e.target.checked) {
                            newSet.add(extraFee.extraFeeTypeId);
                          } else {
                            newSet.delete(extraFee.extraFeeTypeId);
                          }
                          setSelectedExtraFees(newSet);
                        }}
                        className="w-5 h-5 text-orange-600 rounded border-gray-300 focus:ring-orange-500"
                      />
                      <div>
                        <div className={`font-medium ${isSelected ? 'text-gray-800' : 'text-gray-500 line-through'}`}>
                          {extraFee.extraFeeType.name}
                        </div>
                        <div className="text-sm text-gray-500">
                          从 {extraFee.startTerm.year} 第{extraFee.startTerm.termIndex}期 开始
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold text-gray-500 text-xs">原价: {formatMoney(extraFee.amountCents)}</div>
                      <input 
                        type="hidden"
                        name={`extra_${extraFee.extraFeeTypeId}_registered`}
                        value={extraFee.amountCents}
                      />
                      <input 
                        type="number" 
                        name={`extra_${extraFee.extraFeeTypeId}_price`}
                        value={extraFeePrices[extraFee.extraFeeTypeId] || ''}
                        onChange={(e) => setExtraFeePrices({
                          ...extraFeePrices,
                          [extraFee.extraFeeTypeId]: e.target.value
                        })}
                        step="0.01"
                        className="input-modern text-sm w-28 mt-1"
                        placeholder="自定义价格"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* 未注册的额外费用选项 - 临时勾选 */}
        {extraFeeTypes.filter(t => !extraFees.some(f => f.extraFeeTypeId === t.id)).length > 0 && (
          <div className="space-y-4">
            <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
              <span>🚌</span>
              <span>临时额外费用</span>
              <span className="text-sm font-normal text-gray-500">(本期勾选即结算)</span>
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {extraFeeTypes
                .filter(t => !extraFees.some(f => f.extraFeeTypeId === t.id))
                .map(extraFeeType => {
                  const isSelected = tempExtraSelected.has(extraFeeType.id);
                  return (
                    <div 
                      key={extraFeeType.id} 
                      className={`flex items-center justify-between p-3 border rounded-lg transition-all ${
                        isSelected 
                          ? 'bg-blue-50 border-blue-300 shadow-sm' 
                          : 'bg-gray-50 border-gray-200 opacity-70'
                      }`}
                    >
                      <div className="flex items-center space-x-3">
                        <input 
                          type="checkbox" 
                          name="tempExtraItems" 
                          value={extraFeeType.id}
                          checked={isSelected}
                          onChange={() => toggleTempExtra(extraFeeType.id)}
                          className="w-5 h-5 text-blue-600 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div>
                          <div className={`font-medium ${isSelected ? 'text-gray-800' : 'text-gray-600'}`}>
                            {extraFeeType.name}
                          </div>
                          <div className="text-sm text-gray-400">仅本期使用</div>
                        </div>
                      </div>
                      <div className="text-right">
                        <input 
                          type="number" 
                          name={`tempExtra_${extraFeeType.id}_price`}
                          step="0.01"
                          value={tempExtraPrices[extraFeeType.id] || ""}
                          onChange={(e) => setTempExtraPrices({
                            ...tempExtraPrices, 
                            [extraFeeType.id]: e.target.value
                          })}
                          className={`input-modern text-sm w-28 ${
                            isSelected ? 'border-blue-300' : ''
                          }`}
                          placeholder="输入金额 (RM)"
                          required={isSelected}
                        />
                        {isSelected && tempExtraPrices[extraFeeType.id] && (
                          <div className="text-xs text-blue-600 mt-1">
                            RM {parseFloat(tempExtraPrices[extraFeeType.id] || "0").toFixed(2)}
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
            </div>
            <p className="text-sm text-gray-500">
              💡 提示：勾选后输入金额即可在本期结算。如需长期使用，请到 <a href={`/students/${studentId}/enroll`} className="text-blue-600 hover:underline">选课管理</a> 页面注册
            </p>
          </div>
        )}

        {/* 自定义额外费用 - 临时填写 */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-800 flex items-center space-x-2">
            <span>✏️</span>
            <span>自定义费用</span>
            <span className="text-sm font-normal text-gray-500">(材料费/其他临时费用)</span>
          </h3>
          
          {/* 已添加的自定义费用列表 */}
          {customFees.length > 0 && (
            <div className="space-y-2">
              {customFees.map((fee, index) => (
                <div 
                  key={fee.id} 
                  className="flex items-center justify-between p-3 bg-purple-50 border border-purple-200 rounded-lg"
                >
                  <div className="flex items-center space-x-3">
                    <span className="w-6 h-6 bg-purple-200 rounded-full flex items-center justify-center text-sm text-purple-700 font-medium">
                      {index + 1}
                    </span>
                    <div className="font-medium text-gray-800">{fee.name}</div>
                    {/* Hidden inputs for form submission */}
                    <input type="hidden" name="customFeeNames" value={fee.name} />
                    <input type="hidden" name="customFeeAmounts" value={fee.amountCents} />
                  </div>
                  <div className="flex items-center space-x-3">
                    <div className="font-semibold text-purple-600">
                      {formatMoney(fee.amountCents)}
                    </div>
                    <button
                      type="button"
                      onClick={() => removeCustomFee(fee.id)}
                      className="w-8 h-8 flex items-center justify-center rounded-full bg-red-100 text-red-600 hover:bg-red-200 transition-colors"
                      title="删除"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
          
          {/* 添加新的自定义费用 */}
          <div className="flex items-end gap-3 p-4 bg-gray-50 border border-gray-200 border-dashed rounded-lg">
            <div className="flex-1">
              <label className="block text-sm font-medium text-gray-600 mb-1">费用名称</label>
              <input 
                type="text"
                value={newCustomName}
                onChange={(e) => setNewCustomName(e.target.value)}
                className="input-modern w-full"
                placeholder="如：材料费、活动费..."
              />
            </div>
            <div className="w-32">
              <label className="block text-sm font-medium text-gray-600 mb-1">金额 (RM)</label>
              <input 
                type="number"
                step="0.01"
                value={newCustomAmount}
                onChange={(e) => setNewCustomAmount(e.target.value)}
                className="input-modern w-full"
                placeholder="0.00"
              />
            </div>
            <button
              type="button"
              onClick={addCustomFee}
              disabled={!newCustomName.trim() || !newCustomAmount}
              className={`px-4 py-2.5 rounded-lg font-medium transition-all ${
                newCustomName.trim() && newCustomAmount
                  ? 'bg-purple-600 hover:bg-purple-700 text-white'
                  : 'bg-gray-200 text-gray-400 cursor-not-allowed'
              }`}
            >
              ➕ 添加
            </button>
          </div>
          
          <p className="text-sm text-gray-500">
            💡 提示：可添加本期临时产生的费用，如材料费、活动费等
          </p>
        </div>

        {/* 备注 */}
        <div className="space-y-2">
          <label className="block text-sm font-medium text-gray-700">备注（可选）</label>
          <textarea 
            name="note" 
            rows={3}
            className="input-modern w-full" 
            placeholder="添加备注信息..."
          />
        </div>

        {/* 提交按钮 */}
        <div className="flex items-center justify-between pt-4 border-t border-gray-200">
          <div className="text-sm text-gray-500">
            💡 价格可以手动调整，调整后会覆盖默认价格
          </div>
          <button 
            type="submit"
            className="btn-modern bg-green-600 hover:bg-green-700 text-white px-8 py-3 font-medium"
          >
            💳 支付账单并生成收据
          </button>
        </div>
      </form>

      {/* 确认弹窗 */}
      {showConfirmModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-xl shadow-2xl p-6 max-w-md w-full mx-4 animate-fade-in">
            <div className="text-center mb-6">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">
                💳
              </div>
              <h3 className="text-xl font-bold text-gray-800">确认支付</h3>
              <p className="text-gray-600 mt-2">
                确定要为 <span className="font-semibold text-blue-600">{studentName}</span> 生成收据吗？
              </p>
            </div>

            <div className="bg-gray-50 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center">
                <span className="text-gray-600">学期</span>
                <span className="font-medium">{formatTermLabelFull(year, termIndex, termLabels)}</span>
              </div>
              <div className="flex justify-between items-center mt-2">
                <span className="text-gray-600">预计总额</span>
                <span className="font-bold text-green-600 text-lg">{formatMoney(calculateTotal())}</span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                className="flex-1 btn-modern bg-gray-200 text-gray-700 py-3 hover:bg-gray-300"
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                disabled={isSubmitting}
                className={`flex-1 btn-modern py-3 ${
                  isSubmitting 
                    ? 'bg-gray-400 text-gray-200 cursor-not-allowed' 
                    : 'bg-green-600 hover:bg-green-700 text-white'
                }`}
              >
                {isSubmitting ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="animate-spin">⏳</span>
                    处理中...
                  </span>
                ) : (
                  '✅ 确认支付'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
