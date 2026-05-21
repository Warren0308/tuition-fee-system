'use client';

import { useState, useEffect } from 'react';
import type { TermPeriod } from '@/lib/term-utils';

interface TermDatePickerProps {
  term?: TermPeriod;
  value?: Date;
  onChange: (date: Date) => void;
  minBuffer?: number;
  maxBuffer?: number;
  disabled?: boolean;
  className?: string;
}

export function TermDatePicker({
  term,
  value,
  onChange,
  minBuffer = 0,
  maxBuffer = 0,
  disabled = false,
  className = ''
}: TermDatePickerProps) {
  const [selectedDate, setSelectedDate] = useState<string>('');
  const [error, setError] = useState<string>('');

  useEffect(() => {
    if (value) {
      setSelectedDate(value.toISOString().split('T')[0]);
    }
  }, [value]);

  // 计算可选择的日期范围
  const getDateLimits = () => {
    if (!term) return {};

    const minDate = new Date(term.startDate);
    const maxDate = new Date(term.endDate);
    
    minDate.setDate(minDate.getDate() - minBuffer);
    maxDate.setDate(maxDate.getDate() + maxBuffer);

    return {
      min: minDate.toISOString().split('T')[0],
      max: maxDate.toISOString().split('T')[0]
    };
  };

  const { min, max } = getDateLimits();

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newDate = e.target.value;
    setSelectedDate(newDate);
    setError('');

    try {
      // 验证日期
      const date = new Date(newDate);
      if (term) {
        const termStart = new Date(term.startDate);
        const termEnd = new Date(term.endDate);
        
        // 考虑缓冲期
        const minDate = new Date(termStart);
        const maxDate = new Date(termEnd);
        minDate.setDate(minDate.getDate() - minBuffer);
        maxDate.setDate(maxDate.getDate() + maxBuffer);

        if (date < minDate || date > maxDate) {
          setError(`日期必须在 ${minDate.toLocaleDateString()} 和 ${maxDate.toLocaleDateString()} 之间`);
          return;
        }
      }

      onChange(date);
    } catch (error) {
      setError('无效的日期格式');
    }
  };

  return (
    <div className="space-y-1">
      <input
        type="date"
        value={selectedDate}
        onChange={handleChange}
        min={min}
        max={max}
        disabled={disabled}
        className={`input-modern w-full ${className} ${error ? 'border-red-500' : ''}`}
      />
      {error && (
        <p className="text-xs text-red-500">{error}</p>
      )}
    </div>
  );
}








