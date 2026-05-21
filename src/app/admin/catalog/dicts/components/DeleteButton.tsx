"use client";

import React, { useState } from 'react';

interface DeleteButtonProps {
  type: 'grade' | 'school' | 'guardian';
  id: number;
  name: string;
  className?: string;
}

export function DeleteButton({ type, id, name, className = '' }: DeleteButtonProps) {
  const [isDeleting, setIsDeleting] = useState(false);

  const handleDelete = async () => {
    const confirmMessage = `确定要删除"${name}"吗？\n\n历史数据不会受影响，仅删除字典项。`;
    
    if (!confirm(confirmMessage)) {
      return;
    }

    setIsDeleting(true);
    
    try {
      const response = await fetch(`/api/admin/dicts/${type}/delete`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ id }),
      });

      if (response.ok) {
        // 刷新页面以显示更新后的数据
        window.location.reload();
      } else {
        const error = await response.json();
        alert(`删除失败：${error.error || '未知错误'}`);
      }
    } catch (error) {
      alert('删除失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <button
      onClick={handleDelete}
      disabled={isDeleting}
      className={`p-2 text-red-500 hover:text-red-700 hover:bg-red-50 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed ${className}`}
      title={`删除 ${name}`}
    >
      {isDeleting ? (
        <div className="w-4 h-4 border-2 border-red-500 border-t-transparent rounded-full animate-spin" />
      ) : (
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
        </svg>
      )}
    </button>
  );
}
