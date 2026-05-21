"use client";

import React, { useState } from 'react';

export function ExportButtons() {
  const [loading, setLoading] = useState<string | null>(null);

  const handleExport = async (type: 'students' | 'payments' | 'enrollments') => {
    setLoading(type);
    try {
      const response = await fetch(`/api/admin/tools/export/${type}`, {
        method: 'GET',
      });
      
      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `${type}_export_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      } else {
        alert('导出失败，请重试');
      }
    } catch (error) {
      alert('导出失败，请重试');
    } finally {
      setLoading(null);
    }
  };

  return (
    <div className="space-y-3">
      <button 
        className="w-full px-4 py-2 bg-gradient-primary text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 font-medium"
        onClick={() => handleExport('students')}
        disabled={loading !== null}
      >
        {loading === 'students' ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>导出中...</span>
          </span>
        ) : (
          <span>👥 导出学生数据 (CSV)</span>
        )}
      </button>
      <button 
        className="w-full px-4 py-2 bg-gradient-success text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 font-medium"
        onClick={() => handleExport('payments')}
        disabled={loading !== null}
      >
        {loading === 'payments' ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>导出中...</span>
          </span>
        ) : (
          <span>💰 导出账单数据 (CSV)</span>
        )}
      </button>
      <button 
        className="w-full px-4 py-2 bg-gradient-warning text-white rounded-lg hover:shadow-lg transition-all duration-300 disabled:opacity-50 font-medium"
        onClick={() => handleExport('enrollments')}
        disabled={loading !== null}
      >
        {loading === 'enrollments' ? (
          <span className="flex items-center justify-center space-x-2">
            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
            <span>导出中...</span>
          </span>
        ) : (
          <span>📚 导出课程注册数据 (CSV)</span>
        )}
      </button>
    </div>
  );
}
