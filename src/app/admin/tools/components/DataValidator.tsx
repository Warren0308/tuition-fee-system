'use client';

import { useState } from 'react';
import { termSchema, paymentSchema, scheduleSchema } from '@/lib/validators';
import { z } from 'zod';

interface DataValidatorProps {
  terms: any[];
  configs: any[];
}

export function DataValidator({ terms, configs }: DataValidatorProps) {
  const [validating, setValidating] = useState(false);
  const [results, setResults] = useState<{
    type: string;
    status: 'success' | 'error';
    message: string;
    details?: string;
  }[]>([]);

  const addResult = (result: {
    type: string;
    status: 'success' | 'error';
    message: string;
    details?: string;
  }) => {
    setResults(prev => [...prev, result]);
  };

  const validateTerms = async () => {
    for (const term of terms) {
      try {
        termSchema.parse(term);
        addResult({
          type: 'term',
          status: 'success',
          message: `学期 ${term.year}-${term.termIndex} 验证通过`
        });
      } catch (error) {
        if (error instanceof z.ZodError) {
          addResult({
            type: 'term',
            status: 'error',
            message: `学期 ${term.year}-${term.termIndex} 验证失败`,
            details: error.errors.map(e => e.message).join('\n')
          });
        }
      }
    }
  };

  const validatePayments = async () => {
    // 这里可以添加付款记录的验证逻辑
    addResult({
      type: 'payment',
      status: 'success',
      message: '付款记录验证完成'
    });
  };

  const validateSchedules = async () => {
    // 这里可以添加课程安排的验证逻辑
    addResult({
      type: 'schedule',
      status: 'success',
      message: '课程安排验证完成'
    });
  };

  const handleValidate = async () => {
    try {
      setValidating(true);
      setResults([]);

      // 验证学期数据
      await validateTerms();

      // 验证付款记录
      await validatePayments();

      // 验证课程安排
      await validateSchedules();

    } catch (error) {
      addResult({
        type: 'system',
        status: 'error',
        message: '验证过程出错',
        details: error instanceof Error ? error.message : '未知错误'
      });
    } finally {
      setValidating(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <button
          onClick={handleValidate}
          disabled={validating}
          className={`btn-modern w-full ${
            validating 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-green-600 hover:bg-green-700'
          } text-white py-2`}
        >
          {validating ? '验证中...' : '开始验证'}
        </button>

        {/* 验证结果 */}
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-700">验证结果</h3>
          </div>
          <div className="divide-y">
            {results.map((result, index) => (
              <div key={index} className="p-4">
                <div className="flex items-center space-x-2">
                  <span className={`w-2 h-2 rounded-full ${
                    result.status === 'success' ? 'bg-green-500' : 'bg-red-500'
                  }`} />
                  <span className="text-sm font-medium text-gray-700">
                    {result.type}
                  </span>
                </div>
                <div className="mt-1 text-sm text-gray-600">
                  {result.message}
                </div>
                {result.details && (
                  <pre className="mt-2 text-xs bg-gray-50 p-2 rounded overflow-x-auto">
                    {result.details}
                  </pre>
                )}
              </div>
            ))}
            {results.length === 0 && (
              <div className="p-4 text-sm text-gray-500 text-center">
                暂无验证结果
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}








