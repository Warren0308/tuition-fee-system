'use client';
import { useState } from 'react';

interface EditDateButtonProps {
  termId: number;
  startDate: Date;
}

export function EditDateButton({ termId, startDate }: EditDateButtonProps) {
  const [busy, setBusy] = useState(false);

  const handleClick = async () => {
    const defaultDate = new Date(startDate).toISOString().split('T')[0];
    const date = prompt(
      '请输入新的开始日期 (YYYY-MM-DD)\n\n注意：修改后会自动调整所有后续学期的日期。',
      defaultDate
    );

    if (!date) return;

    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
      alert('请使用正确的日期格式：YYYY-MM-DD');
      return;
    }

    setBusy(true);
    try {
      // 1. 先做影响检查
      const checkRes = await fetch(`/api/term/${termId}/impact?startDate=${date}`);
      if (checkRes.ok) {
        const checkData = await checkRes.json();
        if (checkData?.impact?.hasImpact) {
          const { payments, enrollments, schedules } = checkData.impact.impacts;
          const parts: string[] = [];
          if (payments > 0) parts.push(`${payments} 条账单`);
          if (enrollments > 0) parts.push(`${enrollments} 条选课`);
          if (schedules > 0) parts.push(`${schedules} 条课表`);
          const msg = `⚠️ 修改此学期日期会影响：\n\n${parts.join('、')}\n\n这些记录的实际有效期判断会随之变化。是否继续？`;
          if (!confirm(msg)) {
            setBusy(false);
            return;
          }
        } else {
          if (!confirm('修改此学期的开始日期将会自动调整后续所有学期的日期，是否继续？')) {
            setBusy(false);
            return;
          }
        }
      } else {
        // impact API 不可用时回落到基本确认
        if (!confirm('修改此学期的开始日期将会自动调整后续所有学期的日期，是否继续？')) {
          setBusy(false);
          return;
        }
      }

      // 2. 执行修改
      const response = await fetch(`/api/term/${termId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: `startDate=${date}`,
      });

      const data = await response.json();
      if (!response.ok) {
        throw new Error(data.error || '修改失败');
      }
      if (data.ok) {
        window.location.reload();
      } else {
        throw new Error(data.error || '修改失败');
      }
    } catch (error) {
      console.error('修改失败:', error);
      alert(error instanceof Error ? error.message : '修改失败，请重试');
    } finally {
      setBusy(false);
    }
  };

  return (
    <button
      onClick={handleClick}
      disabled={busy}
      className="px-3 py-1 bg-gray-100 text-gray-700 text-xs rounded hover:bg-gray-200 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {busy ? '检查中...' : '📝 修改开始日期'}
    </button>
  );
}