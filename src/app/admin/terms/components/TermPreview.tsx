'use client';

import { useState } from 'react';

interface Term {
  id?: number;
  year: number;
  termIndex: number;
  startDate: Date;
  endDate: Date;
}

interface TermPreviewProps {
  defaultYear: number;
  onSubmit: (year: number, term1Date: string) => Promise<void>;
}

export function TermPreview({ defaultYear, onSubmit }: TermPreviewProps) {
  const [year, setYear] = useState(defaultYear);
  const [term1Date, setTerm1Date] = useState('');
  const [previewTerms, setPreviewTerms] = useState<Term[]>([]);

  // 生成所有学期的预览数据
  const generatePreview = (startDate: string) => {
    if (!startDate) {
      setPreviewTerms([]);
      return;
    }
    
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

    setPreviewTerms(terms);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!term1Date) {
      alert('请选择Term1起始日期');
      return;
    }

    try {
      await onSubmit(year, term1Date);
    } catch (error) {
      console.error('保存失败:', error);
      alert('操作失败，请重试');
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">学年</label>
          <input 
            type="number" 
            value={year}
            onChange={(e) => {
              setYear(Number(e.target.value));
              generatePreview(term1Date);
            }}
            className="input-modern w-full" 
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Term1 起始日期</label>
          <input 
            type="date" 
            value={term1Date}
            onChange={(e) => {
              setTerm1Date(e.target.value);
              generatePreview(e.target.value);
            }}
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

      {previewTerms.length > 0 && (
        <div className="border rounded-lg overflow-hidden">
          <div className="bg-gray-50 px-4 py-2 border-b">
            <h3 className="text-sm font-medium text-gray-700">预览效果</h3>
          </div>
          <div className="p-4">
            <div className="space-y-2 max-h-60 overflow-y-auto">
              {previewTerms.map((term) => (
                <div 
                  key={term.termIndex}
                  className="flex items-center justify-between text-sm p-2 bg-gray-50 rounded"
                >
                  <span className="font-medium">Term {term.termIndex}</span>
                  <span className="text-gray-600">
                    {new Date(term.startDate).toLocaleDateString('zh-CN')} - {new Date(term.endDate).toLocaleDateString('zh-CN')}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}








