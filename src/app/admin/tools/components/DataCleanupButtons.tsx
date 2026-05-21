"use client";

import React from 'react';

export function DataCleanupButtons() {
  const handleCleanEmptyBills = async () => {
    if (confirm('确定要清理空的账单记录吗？')) {
      try {
        const response = await fetch('/api/admin/tools/cleanup-bills', {
          method: 'POST',
        });
        if (response.ok) {
          alert('清理完成！');
        } else {
          alert('清理失败，请重试');
        }
      } catch (error) {
        alert('清理失败，请重试');
      }
    }
  };

  const handleCleanResetTokens = async () => {
    if (confirm('确定要重置所有密码重置令牌吗？')) {
      try {
        const response = await fetch('/api/admin/tools/cleanup-tokens', {
          method: 'POST',
        });
        if (response.ok) {
          alert('清理完成！');
        } else {
          alert('清理失败，请重试');
        }
      } catch (error) {
        alert('清理失败，请重试');
      }
    }
  };

  const handleSeedDicts = async () => {
    if (confirm('确定要初始化字典数据吗？这将添加年级、学校和监护人关系的基础数据。')) {
      try {
        const response = await fetch('/api/admin/tools/seed-dicts', {
          method: 'POST',
        });
        if (response.ok) {
          const result = await response.json();
          alert(`初始化完成！\n${result.message}`);
        } else {
          alert('初始化失败，请重试');
        }
      } catch (error) {
        alert('初始化失败，请重试');
      }
    }
  };

  return (
    <div className="space-y-3">
      <button 
        className="w-full px-4 py-2 bg-gradient-success text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
        onClick={handleSeedDicts}
      >
        📚 初始化字典数据
      </button>
      <button 
        className="w-full px-4 py-2 bg-gradient-warning text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
        onClick={handleCleanEmptyBills}
      >
        🗑️ 清理空账单记录
      </button>
      <button 
        className="w-full px-4 py-2 bg-gradient-danger text-white rounded-lg hover:shadow-lg transition-all duration-300 font-medium"
        onClick={handleCleanResetTokens}
      >
        🔑 清理过期重置令牌
      </button>
    </div>
  );
}
