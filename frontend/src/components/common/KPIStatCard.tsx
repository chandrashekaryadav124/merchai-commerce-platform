import React from 'react';
import { type LucideIcon, TrendingUp, TrendingDown, Minus } from 'lucide-react';

export interface KPIStatCardProps {
  title: string;
  value: string | number;
  subtitle?: string;
  icon?: LucideIcon;
  trend?: {
    value: number | string;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  variant?: 'default' | 'accent' | 'warning' | 'success';
  className?: string;
  tooltip?: string;
}

export const KPIStatCard: React.FC<KPIStatCardProps> = ({
  title,
  value,
  subtitle,
  icon: Icon,
  trend,
  variant = 'default',
  className = '',
  tooltip
}) => {
  const iconColors = {
    default: 'bg-slate-100 text-slate-700',
    accent: 'bg-indigo-50 text-indigo-600',
    warning: 'bg-amber-50 text-amber-600',
    success: 'bg-emerald-50 text-emerald-600'
  };

  return (
    <div
      className={`relative p-5 bg-white border border-slate-200/80 rounded-xl shadow-xs transition hover:shadow-md hover:border-slate-300 ${className}`}
      title={tooltip}
    >
      <div className="flex items-center justify-between gap-3 mb-2">
        <span className="text-xs font-semibold tracking-wider text-slate-500 uppercase truncate">
          {title}
        </span>
        {Icon && (
          <div className={`p-2 rounded-lg ${iconColors[variant]} shrink-0`}>
            <Icon className="w-4 h-4 stroke-[2]" />
          </div>
        )}
      </div>

      <div className="flex items-baseline gap-2 mb-1">
        <span className="text-2xl font-bold tracking-tight text-slate-900 font-mono">
          {value}
        </span>
      </div>

      <div className="flex items-center justify-between text-xs text-slate-500">
        {subtitle && <span className="truncate">{subtitle}</span>}
        {trend && (
          <div
            className={`flex items-center gap-1 font-medium ml-auto ${
              trend.direction === 'up'
                ? 'text-emerald-600'
                : trend.direction === 'down'
                ? 'text-rose-600'
                : 'text-slate-500'
            }`}
          >
            {trend.direction === 'up' && <TrendingUp className="w-3.5 h-3.5" />}
            {trend.direction === 'down' && <TrendingDown className="w-3.5 h-3.5" />}
            {trend.direction === 'neutral' && <Minus className="w-3.5 h-3.5" />}
            <span>{trend.value}</span>
            {trend.label && <span className="text-slate-400 font-normal">{trend.label}</span>}
          </div>
        )}
      </div>
    </div>
  );
};
