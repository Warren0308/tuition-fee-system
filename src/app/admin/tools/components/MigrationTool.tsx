'use client';

import { useState } from 'react';
import { migrateTerm } from '@/lib/migrations';

interface MigrationToolProps {
  terms: {
    id: number;
    year: number;
    termIndex: number;
    startDate: Date;
    endDate: Date;
  }[];
}

export function MigrationTool({ terms }: MigrationToolProps) {
  const [selectedTerm, setSelectedTerm] = useState<number>();
  const [newStartDate, setNewStartDate] = useState('');
  const [dryRun, setDryRun] = useState(true);
  const [force, setForce] = useState(false);
  const [loading, setLoading] = useState(false);
  const [logs, setLogs] = useState<string[]>([]);

  const addLog = (message: string) => {
    setLogs(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${message}`]);
  };

  const handleMigrate = async () => {
    if (!selectedTerm || !newStartDate) {
      alert('请选择学期和新的开始日期');
      return;
    }

    try {
      setLoading(true);
      addLog(`开始迁移学期 ${selectedTerm}...`);

      await migrateTerm(selectedTerm, new Date(newStartDate), {
        dryRun,
        force,
        logger: {
          info: (msg: string) => addLog(`[INFO] ${msg}`),
          debug: (msg: string) => addLog(`[DEBUG] ${msg}`),
          error: (msg: string) => addLog(`[ERROR] ${msg}`)
        }
      });

      addLog('迁移完成');

      if (!dryRun) {
        window.location.reload();
      }
    } catch (error) {
      addLog(`迁移失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            选择学期
          </label>
          <select
            value={selectedTerm}
            onChange={(e) => setSelectedTerm(Number(e.target.value))}
            className="input-modern w-full"
          >
            <option value="">请选择学期</option>
            {terms.map(term => (
              <option key={term.id} value={term.id}>
                {term.year} 学年 Term {term.termIndex}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            新的开始日期
          </label>
          <input
            type="date"
            value={newStartDate}
            onChange={(e) => setNewStartDate(e.target.value)}
            className="input-modern w-full"
          />
        </div>

        <div className="flex items-center space-x-4">
          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={dryRun}
              onChange={(e) => setDryRun(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">试运行模式</span>
          </label>

          <label className="flex items-center space-x-2">
            <input
              type="checkbox"
              checked={force}
              onChange={(e) => setForce(e.target.checked)}
              className="rounded text-blue-600"
            />
            <span className="text-sm text-gray-700">强制执行</span>
          </label>
        </div>

        <button
          onClick={handleMigrate}
          disabled={loading || !selectedTerm || !newStartDate}
          className={`btn-modern w-full ${
            loading 
              ? 'bg-gray-400 cursor-not-allowed' 
              : 'bg-blue-600 hover:bg-blue-700'
          } text-white py-2`}
        >
          {loading ? '迁移中...' : '开始迁移'}
        </button>
      </div>

      {/* 日志显示 */}
      <div className="border rounded-lg overflow-hidden">
        <div className="bg-gray-50 px-4 py-2 border-b">
          <h3 className="text-sm font-medium text-gray-700">操作日志</h3>
        </div>
        <div className="p-4 h-60 overflow-y-auto bg-gray-900 text-gray-200 font-mono text-sm">
          {logs.length > 0 ? (
            logs.map((log, index) => (
              <div key={index} className="whitespace-pre-wrap">
                {log}
              </div>
            ))
          ) : (
            <div className="text-gray-500">暂无日志</div>
          )}
        </div>
      </div>
    </div>
  );
}








