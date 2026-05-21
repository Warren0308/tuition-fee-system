'use client';

import { useState, useEffect } from 'react';

interface Term {
  id?: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
}

interface Term1FormProps {
  defaultYear: number;
  onPreview: (terms: Term[]) => void;
}

export function Term1Form({ defaultYear, onPreview }: Term1FormProps) {
  const [year, setYear] = useState(defaultYear);
  const [term1Date, setTerm1Date] = useState('');

  // 生成所有学期的预览数据
  const generateTerms = (startDate: string): Term[] => {
    if (!startDate) return [];
    
    const term1Start = new Date(startDate + "T00:00:00Z");
    const terms: Term[] = [];

    for (let i = 0; i < 13; i++) {
      const termStart = new Date(term1Start);
      termStart.setDate(term1Start.getDate() + (i * 28)); // 每个学期28天
      
      const termEnd = new Date(termStart);
      termEnd.setDate(termStart.getDate() + 27); // 结束日期是开始日期+27天

      terms.push({
        year,
        termIndex: i + 1,
        startDate: termStart,
        endDate: termEnd
      });
    }

    return terms;
  };

  // 当年份或日期改变时，更新预览
  useEffect(() => {
    if (term1Date) {
      const terms = generateTerms(term1Date);
      onPreview(terms);
    }
  }, [year, term1Date]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term1Date) {
      alert('请选择Term1起始日期');
      return;
    }

    try {
      // 先保存Term1配置
      const configResponse = await fetch('/api/term-config', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `year=${year}&term1Date=${term1Date}`,
      });

      if (!configResponse.ok) {
        throw new Error('保存Term1配置失败');
      }

      // 然后生成所有学期
      const generateResponse = await fetch('/api/term/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: `year=${year}`,
      });

      if (!generateResponse.ok) {
        throw new Error('生成学期失败');
      }

      window.location.reload();
    } catch (error) {
      console.error('保存失败:', error);
      alert('操作失败，请重试');
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
        <input 
          type="number" 
          value={year}
          onChange={(e) => setYear(Number(e.target.value))}
          className="input-modern w-full" 
          required
        />
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Term1 起始日期</label>
        <input 
          type="date" 
          value={term1Date}
          onChange={(e) => setTerm1Date(e.target.value)}
          className="input-modern w-full" 
          required
        />
      </div>
      <button 
        type="submit" 
        className="btn-modern w-full bg-blue-600 hover:bg-blue-700 text-white py-3 font-medium"
      >
        🎯 保存设置并生成所有学期
      </button>
    </form>
  );
}








