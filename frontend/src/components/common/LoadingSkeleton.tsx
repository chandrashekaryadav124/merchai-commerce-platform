import React from 'react';

export interface LoadingSkeletonProps {
  type?: 'card' | 'table-row' | 'chart' | 'text';
  count?: number;
  className?: string;
}

export const LoadingSkeleton: React.FC<LoadingSkeletonProps> = ({
  type = 'card',
  count = 1,
  className = ''
}) => {
  const items = Array.from({ length: count });

  if (type === 'card') {
    return (
      <div className={`grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs animate-pulse">
            <div className="flex items-center justify-between mb-3">
              <div className="h-4 w-24 bg-slate-200 rounded-md" />
              <div className="w-8 h-8 bg-slate-100 rounded-lg" />
            </div>
            <div className="h-7 w-32 bg-slate-300 rounded-md mb-2" />
            <div className="h-3 w-40 bg-slate-100 rounded-md" />
          </div>
        ))}
      </div>
    );
  }

  if (type === 'chart') {
    return (
      <div className={`p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs animate-pulse ${className}`}>
        <div className="flex items-center justify-between mb-6">
          <div className="h-5 w-48 bg-slate-200 rounded-md" />
          <div className="h-4 w-20 bg-slate-100 rounded-md" />
        </div>
        <div className="h-64 w-full bg-slate-100/80 rounded-lg flex items-end gap-3 p-4">
          <div className="h-1/3 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-1/2 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-2/3 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-3/4 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-1/2 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-4/5 flex-1 bg-slate-200 rounded-sm" />
          <div className="h-3/5 flex-1 bg-slate-200 rounded-sm" />
        </div>
      </div>
    );
  }

  if (type === 'table-row') {
    return (
      <div className={`space-y-3 ${className}`}>
        {items.map((_, i) => (
          <div key={i} className="h-12 w-full bg-slate-100 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  return <div className={`h-4 bg-slate-200 rounded-md animate-pulse ${className}`} />;
};

