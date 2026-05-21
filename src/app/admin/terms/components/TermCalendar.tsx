"use client";

import React, { useState } from 'react';

interface Term {
  id: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
}

interface Config {
  id: number;
  year: number;
  term1Date: Date;
}

interface TermCalendarProps {
  terms: Term[];
  configs: Config[];
}

export function TermCalendar({ terms, configs }: TermCalendarProps) {
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [editingTerm, setEditingTerm] = useState<number | null>(null);
  const [newStartDate, setNewStartDate] = useState('');

  // 过滤当前年份的学期
  const currentYearTerms = terms.filter(term => term.year === selectedYear);
  
  // 生成日历月份
  const months = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December'
  ];

  const getTermsForMonth = (monthIndex: number) => {
    return currentYearTerms.filter(term => {
      const startMonth = new Date(term.startDate).getMonth();
      const endMonth = new Date(term.endDate).getMonth();
      return monthIndex >= startMonth && monthIndex <= endMonth;
    });
  };

  const getTermColor = (termIndex: number) => {
    const colors = [
      'bg-blue-100 text-blue-800 border-blue-200',
      'bg-green-100 text-green-800 border-green-200', 
      'bg-orange-100 text-orange-800 border-orange-200',
      'bg-purple-100 text-purple-800 border-purple-200',
      'bg-pink-100 text-pink-800 border-pink-200',
      'bg-indigo-100 text-indigo-800 border-indigo-200'
    ];
    return colors[(termIndex - 1) % colors.length];
  };

  const handleEditTerm = async (termId: number, newStartDate: string) => {
    try {
      const response = await fetch(`/api/term/${termId}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `startDate=${newStartDate}`,
      });

      if (response.ok) {
        window.location.reload();
      } else {
        alert('修改失败，请重试');
      }
    } catch (error) {
      alert('修改失败，请重试');
    }
  };

  const availableYears = Array.from(new Set([
    ...terms.map(t => t.year),
    ...configs.map(c => c.year),
    new Date().getFullYear()
  ])).sort((a, b) => b - a);

  return (
    <div className="card-modern">
      <div className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center space-x-3">
            <div className="w-12 h-12 bg-purple-100 rounded-xl flex items-center justify-center text-2xl">
              📅
            </div>
            <div>
              <h2 className="text-xl font-semibold text-gray-800">学期日历视图</h2>
              <p className="text-gray-600 text-sm">可视化查看和编辑学期安排</p>
            </div>
          </div>
          
          <div className="flex items-center space-x-3">
            <label className="text-sm font-medium text-gray-700">选择学年：</label>
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="input-modern px-3 py-2"
            >
              {availableYears.map(year => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>
        </div>

        {/* 日历网格 */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-6">
          {months.map((month, index) => {
            const monthTerms = getTermsForMonth(index);
            return (
              <div key={month} className="border border-gray-200 rounded-lg p-3 bg-gray-50">
                <h3 className="font-medium text-gray-700 mb-2 text-center">{month}</h3>
                <div className="space-y-1">
                  {monthTerms.length > 0 ? (
                    monthTerms.map(term => (
                      <div
                        key={term.id}
                        className={`px-2 py-1 rounded text-xs border ${getTermColor(term.termIndex)}`}
                      >
                        <div className="font-medium">Term {term.termIndex}</div>
                        <div className="text-xs opacity-75">
                          {new Date(term.startDate).getDate()}/{new Date(term.startDate).getMonth() + 1} - 
                          {new Date(term.endDate).getDate()}/{new Date(term.endDate).getMonth() + 1}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="text-xs text-gray-400 text-center py-2">无学期</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* 学期详细列表 */}
        <div className="border-t pt-6">
          <h3 className="text-lg font-semibold text-gray-800 mb-4">{selectedYear} 学年学期详情</h3>
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50">
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">学期</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">开始日期</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">结束日期</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">天数</th>
                  <th className="px-4 py-3 text-left text-sm font-semibold text-gray-700">操作</th>
                </tr>
              </thead>
              <tbody>
                {currentYearTerms.map((term, index) => {
                  const startDate = new Date(term.startDate);
                  const endDate = new Date(term.endDate);
                  const daysDiff = Math.ceil((endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

                  return (
                    <tr key={term.id} className={`border-b border-gray-100 ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50'}`}>
                      <td className="px-4 py-3">
                        <div className={`inline-flex px-2 py-1 rounded text-sm ${getTermColor(term.termIndex)}`}>
                          Term {term.termIndex}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {startDate.toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {endDate.toLocaleDateString('zh-CN')}
                      </td>
                      <td className="px-4 py-3 text-sm text-gray-600">
                        {daysDiff} 天
                      </td>
                      <td className="px-4 py-3">
                        {editingTerm === term.id ? (
                          <div className="flex items-center space-x-2">
                            <input
                              type="date"
                              value={newStartDate}
                              onChange={(e) => setNewStartDate(e.target.value)}
                              className="input-modern text-xs px-2 py-1"
                            />
                            <button
                              onClick={() => handleEditTerm(term.id, newStartDate)}
                              className="px-2 py-1 bg-blue-600 text-white text-xs rounded hover:bg-blue-700"
                            >
                              保存
                            </button>
                            <button
                              onClick={() => setEditingTerm(null)}
                              className="px-2 py-1 bg-gray-300 text-gray-700 text-xs rounded hover:bg-gray-400"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={() => {
                              setEditingTerm(term.id);
                              setNewStartDate(startDate.toISOString().split('T')[0]);
                            }}
                            className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors"
                          >
                            📝 修改开始日期
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            {currentYearTerms.length === 0 && (
              <div className="text-center py-8 text-gray-500">
                <div className="text-4xl mb-2">📅</div>
                <p>该学年暂无学期数据</p>
                <p className="text-sm text-gray-400 mt-1">请先配置Term1起始日期并生成学期</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
