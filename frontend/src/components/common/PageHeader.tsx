import React, { type ReactNode } from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  roleBadge?: string;
  actions?: ReactNode;
  className?: string;
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  subtitle,
  roleBadge,
  actions,
  className = ''
}) => {
  return (
    <div className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 pb-6 border-b border-slate-200/80 mb-6 ${className}`}>
      <div>
        <div className="flex items-center gap-2.5">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">{title}</h1>
          {roleBadge && (
            <span className="px-2.5 py-0.5 text-xs font-semibold uppercase tracking-wider rounded-full bg-slate-100 text-slate-700 border border-slate-200">
              {roleBadge}
            </span>
          )}
        </div>
        {subtitle && <p className="text-sm text-slate-500 mt-1 leading-normal">{subtitle}</p>}
      </div>
      {actions && <div className="flex items-center gap-2.5 flex-wrap shrink-0">{actions}</div>}
    </div>
  );
};
