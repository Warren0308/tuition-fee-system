'use client';

import { useState } from 'react';
import type { TermStatistics } from '@/lib/statistics';

interface TermStatsCardProps {
  term: {
    year: number;
    termIndex: number;
    startDate: Date;
    endDate: Date;
  };
  stats: TermStatistics;
}

export function TermStatsCard({ term, stats }: TermStatsCardProps) {
  const [expanded, setExpanded] = useState(false);

  const formatMoney = (cents: number) => {
    return `RM ${(cents / 100).toFixed(2)}`;
  };

  const formatPercent = (value: number) => {
    return `${value.toFixed(1)}%`;
  };

  return (
    <div className="card-modern animate-fade-in">
      <div className="p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h3 className="text-lg font-semibold text-gray-800">
              Term {term.termIndex}
            </h3>
            <p className="text-sm text-gray-600">
              {new Date(term.startDate).toLocaleDateString()} - {new Date(term.endDate).toLocaleDateString()}
            </p>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="text-gray-400 hover:text-gray-600"
          >
            {expanded ? '收起' : '展开'}
          </button>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-4">
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="text-sm text-blue-600">学生总数</div>
            <div className="text-2xl font-bold text-blue-700">
              {stats.studentCount}
            </div>
            <div className="text-xs text-blue-500">
              活跃: {stats.activeStudentCount} ({formatPercent(stats.activeStudentCount / stats.studentCount * 100)})
            </div>
          </div>

          <div className="bg-green-50 rounded-lg p-4">
            <div className="text-sm text-green-600">收费情况</div>
            <div className="text-2xl font-bold text-green-700">
              {formatMoney(stats.paidPayments)}
            </div>
            <div className="text-xs text-green-500">
              付款率: {formatPercent(stats.paymentRate)}
            </div>
          </div>
        </div>

        {expanded && (
          <div className="space-y-4 border-t pt-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <div className="text-sm font-medium text-gray-600">课程数量</div>
                <div className="text-lg text-gray-800">{stats.courseCount}</div>
              </div>
              <div>
                <div className="text-sm font-medium text-gray-600">课程安排</div>
                <div className="text-lg text-gray-800">{stats.scheduleCount}</div>
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-600">平均班级大小</div>
              <div className="text-lg text-gray-800">
                {stats.averageClassSize.toFixed(1)} 人/班
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-gray-600">未付款金额</div>
              <div className="text-lg text-red-600">
                {formatMoney(stats.unpaidPayments)}
              </div>
            </div>

            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
              <div className="text-sm font-medium text-gray-700 mb-2">付款进度</div>
              <div className="relative h-2 bg-gray-200 rounded-full overflow-hidden">
                <div 
                  className="absolute top-0 left-0 h-full bg-green-500 rounded-full"
                  style={{ width: `${stats.paymentRate}%` }}
                />
              </div>
              <div className="text-xs text-gray-500 mt-1">
                已收款 {formatMoney(stats.paidPayments)} / {formatMoney(stats.totalPayments)}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}








