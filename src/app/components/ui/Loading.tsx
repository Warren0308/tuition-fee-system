import React from 'react';

interface LoadingProps {
  size?: 'sm' | 'md' | 'lg';
  text?: string;
  fullScreen?: boolean;
  className?: string;
}

interface SkeletonProps {
  className?: string;
  lines?: number;
  avatar?: boolean;
}

export function Loading({ 
  size = 'md', 
  text, 
  fullScreen = false, 
  className = '' 
}: LoadingProps) {
  const sizeClasses = {
    sm: 'w-4 h-4',
    md: 'w-6 h-6',
    lg: 'w-8 h-8',
  };

  const spinner = (
    <div className="flex flex-col items-center justify-center space-y-3">
      <div className={`loading-spinner ${sizeClasses[size]}`} />
      {text && (
        <p className="text-gray-600 text-sm font-medium">{text}</p>
      )}
    </div>
  );

  if (fullScreen) {
    return (
      <div className="fixed inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-50">
        <div className="card-modern p-8">
          {spinner}
        </div>
      </div>
    );
  }

  return (
    <div className={`flex items-center justify-center p-4 ${className}`}>
      {spinner}
    </div>
  );
}

export function Skeleton({ className = '', lines = 1, avatar = false }: SkeletonProps) {
  return (
    <div className={`animate-pulse ${className}`}>
      {avatar && (
        <div className="w-10 h-10 bg-gray-200 rounded-full mb-3" />
      )}
      <div className="space-y-2">
        {Array.from({ length: lines }).map((_, index) => (
          <div
            key={index}
            className={`h-4 bg-gray-200 rounded ${
              index === lines - 1 && lines > 1 ? 'w-3/4' : 'w-full'
            }`}
          />
        ))}
      </div>
    </div>
  );
}

// 表格加载骨架
export function TableSkeleton({ rows = 5, columns = 4 }: { rows?: number; columns?: number }) {
  return (
    <div className="card-modern">
      <div className="p-6 border-b border-gray-200">
        <Skeleton lines={1} className="w-48" />
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50">
            <tr>
              {Array.from({ length: columns }).map((_, index) => (
                <th key={index} className="px-6 py-4">
                  <Skeleton lines={1} className="w-20" />
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200">
            {Array.from({ length: rows }).map((_, rowIndex) => (
              <tr key={rowIndex}>
                {Array.from({ length: columns }).map((_, colIndex) => (
                  <td key={colIndex} className="px-6 py-4">
                    <Skeleton 
                      lines={1} 
                      avatar={colIndex === 0}
                      className={colIndex === 0 ? 'flex items-center space-x-3' : ''}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// 卡片网格加载骨架
export function CardGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {Array.from({ length: count }).map((_, index) => (
        <div key={index} className="card-modern p-6">
          <div className="flex items-center space-x-4 mb-4">
            <div className="w-12 h-12 bg-gray-200 rounded-xl animate-pulse" />
            <div className="flex-1">
              <Skeleton lines={2} />
            </div>
          </div>
          <Skeleton lines={3} />
        </div>
      ))}
    </div>
  );
}
