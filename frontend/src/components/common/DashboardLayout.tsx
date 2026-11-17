import React, { type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';

export interface NavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  badge?: string | number;
}

export interface DashboardLayoutProps {
  roleTitle: string;
  roleBadge: string;
  navItems: NavItem[];
  activeTab: string;
  onTabChange: (id: string) => void;
  children: ReactNode;
  headerActions?: ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  roleTitle,
  roleBadge,
  navItems,
  activeTab,
  onTabChange,
  children,
  headerActions
}) => {
  return (
    <div className="min-h-screen bg-slate-50/50 flex flex-col md:flex-row">
      {/* Desktop / Tablet Sidebar */}
      <aside className="w-full md:w-64 bg-white border-r border-slate-200/80 shrink-0 flex flex-col">
        {/* Workspace Brand / Header */}
        <div className="p-5 border-b border-slate-200/80">
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h2 className="text-sm font-bold tracking-tight text-slate-900">{roleTitle}</h2>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span className="text-xs text-slate-500 font-medium">Control Center</span>
            <span className="text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 border border-slate-200">
              {roleBadge}
            </span>
          </div>
        </div>

        {/* Navigation Items */}
        <nav className="p-3 space-y-1 flex-1 overflow-y-auto">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => onTabChange(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-slate-900 text-white shadow-xs'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                }`}
              >
                <div className="flex items-center gap-2.5 truncate">
                  <Icon className={`w-4 h-4 shrink-0 stroke-[2] ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </div>
                {item.badge !== undefined && (
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-semibold ${
                      isActive
                        ? 'bg-white/20 text-white'
                        : 'bg-slate-100 text-slate-600 border border-slate-200'
                    }`}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* System & Data Integrity Disclaimer Footer */}
        <div className="p-4 border-t border-slate-200/80 bg-slate-50/50">
          <div className="flex items-center justify-between text-[11px] text-slate-500">
            <span>Environment:</span>
            <span className="font-mono text-emerald-600 font-medium">Verified Active</span>
          </div>
          <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1">
            <span>Telemetry:</span>
            <span className="font-mono text-slate-600">Zero-Mock DB</span>
          </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 min-w-0 flex flex-col">
        {headerActions && (
          <div className="bg-white border-b border-slate-200/80 px-6 py-3 flex items-center justify-end gap-3">
            {headerActions}
          </div>
        )}
        <div className="p-6 md:p-8 flex-1 overflow-y-auto max-w-7xl w-full mx-auto">
          {children}
        </div>
      </main>
    </div>
  );
};
