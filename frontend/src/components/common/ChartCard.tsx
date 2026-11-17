import React, { type ReactNode } from 'react';
import { EmptyState } from './EmptyState';
import { BarChart3 } from 'lucide-react';

export interface ChartCardProps {
  title: string;
  subtitle?: string;
  children: ReactNode;
  headerActions?: ReactNode;
  isEmpty?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
  className?: string;
}

export const ChartCard: React.FC<ChartCardProps> = ({
  title,
  subtitle,
  children,
  headerActions,
  isEmpty = false,
  emptyTitle = 'No chart data available',
  emptyDescription = 'Transactions or activity matching the selected period have not yet occurred.',
  className = ''
}) => {
  return (
    <div className={`p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs transition hover:shadow-sm ${className}`}>
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-6">
        <div>
          <h3 className="text-base font-semibold text-slate-900 tracking-tight">{title}</h3>
          {subtitle && <p className="text-xs text-slate-500 mt-0.5">{subtitle}</p>}
        </div>
        {headerActions && <div className="flex items-center gap-2">{headerActions}</div>}
      </div>

      {isEmpty ? (
        <div className="h-64 flex items-center justify-center">
          <EmptyState
            icon={BarChart3}
            title={emptyTitle}
            description={emptyDescription}
            className="border-0 shadow-none bg-transparent p-0"
          />
        </div>
      ) : (
        <div className="w-full">{children}</div>
      )}
    </div>
  );
};
