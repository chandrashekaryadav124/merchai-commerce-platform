import React from 'react';
import type { UserRole, User } from '../../types';
import {
  Home,
  ShoppingBag,
  ShoppingCart,
  Package,
  Truck,
  CreditCard,
  RotateCcw,
  Star,
  User as UserIcon,
  LifeBuoy,
  BarChart3,
  Boxes,
  ClipboardList,
  Sparkles,
  TrendingUp,
  Bot,
  BookOpen,
  Settings,
  LayoutDashboard,
  PackageCheck,
  Compass,
  Warehouse,
  Move,
  FileText,
  Headphones,
  Inbox,
  AlertCircle,
  UserCheck,
  AlertTriangle,
  FileWarning,
  Flame,
  FileBarChart,
  ShieldCheck,
  Users,
  Store,
  Sliders,
  ChevronLeft,
  ChevronRight,
  X,
  LogOut,
  LogIn
} from 'lucide-react';

export interface NavItemConfig {
  key: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  badge?: string | number;
  badgeColor?: string;
  category?: string;
}

interface SidebarProps {
  currentRole: UserRole;
  activeItem: string;
  onSelectItem: (itemKey: string, role?: UserRole) => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isMobileOpen: boolean;
  onCloseMobile: () => void;
  currentUser: User | null;
  onLogout: () => void;
  onOpenAuth: () => void;
  cartCount?: number;
}

export function Sidebar({
  currentRole,
  activeItem,
  onSelectItem,
  isCollapsed,
  onToggleCollapse,
  isMobileOpen,
  onCloseMobile,
  currentUser,
  onLogout,
  onOpenAuth,
  cartCount = 0
}: SidebarProps) {
  // Define role navigation menus strictly aligned to Sprint 0.4 specs
  const getNavItemsForRole = (role: UserRole): NavItemConfig[] => {
    switch (role) {
      case 'CUSTOMER':
        return [
          { key: 'overview', label: 'Home', icon: Home },
          { key: 'browse', label: 'Browse Products', icon: ShoppingBag },
          { key: 'cart', label: 'My Cart', icon: ShoppingCart, badge: cartCount > 0 ? cartCount : undefined, badgeColor: 'bg-amber-500 text-white' },
          { key: 'orders', label: 'My Orders', icon: Package },
          { key: 'tracking', label: 'Track Orders', icon: Truck },
          { key: 'payments', label: 'Payments & Transactions', icon: CreditCard },
          { key: 'returns', label: 'Returns & Refunds', icon: RotateCcw },
          { key: 'reviews', label: 'My Reviews', icon: Star },
          { key: 'account', label: 'My Account', icon: UserIcon },
          { key: 'support', label: 'Support Helpdesk', icon: LifeBuoy }
        ];

      case 'SELLER':
        return [
          { key: 'overview', label: 'Overview & Sales', icon: BarChart3, category: 'Core Management' },
          { key: 'products', label: 'My Products', icon: Package, category: 'Core Management' },
          { key: 'inventory', label: 'Inventory Management', icon: Boxes, category: 'Core Management' },
          { key: 'orders', label: 'Store Orders', icon: ClipboardList, category: 'Fulfillment' },
          { key: 'shipments', label: 'Shipments', icon: Truck, category: 'Fulfillment' },
          { key: 'payments', label: 'Payments & Settlements', icon: CreditCard, category: 'Finance' },
          { key: 'reviews', label: 'Customer Reviews', icon: Star, category: 'Customer Feedback' },
          { key: 'copilot', label: 'AI Catalog Copilot', icon: Sparkles, badge: 'AI', badgeColor: 'bg-indigo-600 text-white', category: 'Intelligence' },
          { key: 'demand', label: 'Demand Intelligence', icon: TrendingUp, category: 'Intelligence' },
          { key: 'advisor', label: 'AI Advisor', icon: Bot, category: 'Intelligence' },
          { key: 'knowledge', label: 'Knowledge Base', icon: BookOpen, category: 'Intelligence' },
          { key: 'settings', label: 'Store Settings', icon: Settings, category: 'Settings' }
        ];

      case 'OPERATIONS':
        return [
          { key: 'overview', label: 'Operations Overview', icon: LayoutDashboard, category: 'Operations' },
          { key: 'fulfillment', label: 'Order Fulfilment', icon: ClipboardList, category: 'Operations' },
          { key: 'ready_pickup', label: 'Ready for Pickup', icon: PackageCheck, badge: 'Queue', badgeColor: 'bg-emerald-600 text-white', category: 'Logistics' },
          { key: 'shipments', label: 'Shipment Management', icon: Truck, category: 'Logistics' },
          { key: 'couriers', label: 'Courier Partners', icon: Compass, category: 'Logistics' },
          { key: 'tracking', label: 'Delivery Tracking', icon: Move, category: 'Logistics' },
          { key: 'inventory', label: 'Warehouse Inventory', icon: Warehouse, category: 'Warehouse' },
          { key: 'movement', label: 'Inventory Movement', icon: Move, category: 'Warehouse' },
          { key: 'returns', label: 'Returns Processing', icon: RotateCcw, category: 'After-Sales' },
          { key: 'reports', label: 'Operations Reports', icon: FileText, category: 'Reports' }
        ];

      case 'SUPPORT':
        return [
          { key: 'overview', label: 'Support Overview', icon: Headphones, category: 'Overview' },
          { key: 'all_tickets', label: 'All Tickets', icon: Inbox, category: 'Ticket Queues' },
          { key: 'new_tickets', label: 'New Tickets', icon: AlertCircle, badge: 'New', badgeColor: 'bg-blue-600 text-white', category: 'Ticket Queues' },
          { key: 'assigned', label: 'Assigned Tickets', icon: UserCheck, category: 'Ticket Queues' },
          { key: 'order_issues', label: 'Order Issues', icon: AlertTriangle, category: 'Issue Triage' },
          { key: 'shipment_issues', label: 'Shipment Issues', icon: Truck, category: 'Issue Triage' },
          { key: 'returns_requests', label: 'Return Requests', icon: FileWarning, category: 'Issue Triage' },
          { key: 'escalations', label: 'Escalations', icon: Flame, badge: 'Urgent', badgeColor: 'bg-rose-600 text-white', category: 'Governance' },
          { key: 'reports', label: 'Resolution Reports', icon: FileBarChart, category: 'Governance' }
        ];

      case 'ADMIN':
        return [
          { key: 'overview', label: 'Executive Overview', icon: ShieldCheck, category: 'Executive' },
          { key: 'users', label: 'User Management', icon: Users, category: 'Governance' },
          { key: 'sellers', label: 'Seller Management', icon: Store, category: 'Governance' },
          { key: 'products', label: 'Product Catalog', icon: Package, category: 'Marketplace' },
          { key: 'orders', label: 'Global Orders', icon: ClipboardList, category: 'Marketplace' },
          { key: 'payments', label: 'Payments & Transactions', icon: CreditCard, category: 'Finance' },
          { key: 'shipments', label: 'Shipments', icon: Truck, category: 'Logistics' },
          { key: 'returns', label: 'Returns & Refunds', icon: RotateCcw, category: 'Logistics' },
          { key: 'settlements', label: 'Seller Settlements', icon: CreditCard, category: 'Finance' },
          { key: 'analytics', label: 'Marketplace Analytics', icon: BarChart3, category: 'Intelligence' },
          { key: 'audit', label: 'Audit Logs', icon: FileText, category: 'Compliance' },
          { key: 'settings', label: 'System Settings', icon: Sliders, category: 'System' }
        ];

      default:
        return [];
    }
  };

  const navItems = getNavItemsForRole(currentRole);

  const getRoleTheme = (role: UserRole) => {
    switch (role) {
      case 'CUSTOMER':
        return { badge: 'Storefront', color: 'bg-amber-500/10 text-amber-400 border-amber-500/20' };
      case 'SELLER':
        return { badge: 'Merchant Console', color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20' };
      case 'OPERATIONS':
        return { badge: 'Logistics Hub', color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' };
      case 'SUPPORT':
        return { badge: 'Helpdesk HQ', color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20' };
      case 'ADMIN':
        return { badge: 'Master Admin', color: 'bg-rose-500/10 text-rose-400 border-rose-500/20' };
    }
  };

  const roleMeta = getRoleTheme(currentRole);

  const sidebarContent = (
    <div className="flex flex-col h-full bg-[#0F172A] text-slate-300 border-r border-slate-800 select-none">
      {/* Brand & Header Section */}
      <div className={`flex items-center justify-between p-4 border-b border-slate-800 ${isCollapsed ? 'px-3 justify-center' : ''}`}>
        {!isCollapsed ? (
          <div className="flex items-center space-x-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md">
              <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950" />
            </div>
            <div>
              <div className="font-extrabold text-base text-white tracking-tight flex items-center gap-1">
                <span>Merch</span>
                <span className="text-amber-400">AI</span>
              </div>
              <span className={`text-[10px] font-mono px-2 py-0.5 rounded-full border ${roleMeta.color} inline-block mt-0.5`}>
                {roleMeta.badge}
              </span>
            </div>
          </div>
        ) : (
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-amber-500 to-amber-300 flex items-center justify-center shadow-md">
            <Sparkles className="w-5 h-5 text-slate-950 fill-slate-950" />
          </div>
        )}

        {/* Desktop Collapse Toggle Button */}
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
          title={isCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          {isCollapsed ? <ChevronRight className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
        </button>

        {/* Mobile Close Button */}
        <button
          onClick={onCloseMobile}
          className="md:hidden p-1.5 text-slate-400 hover:text-white rounded-lg hover:bg-slate-800 transition"
        >
          <X className="w-5 h-5" />
        </button>
      </div>

      {/* Navigation List Area */}
      <div className="flex-1 overflow-y-auto px-2 py-4 space-y-1 custom-scrollbar">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = activeItem.toLowerCase() === item.key.toLowerCase();

          return (
            <button
              key={item.key}
              onClick={() => {
                onSelectItem(item.key, currentRole);
                onCloseMobile();
              }}
              title={isCollapsed ? item.label : undefined}
              className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-all group relative cursor-pointer ${
                isActive
                  ? 'bg-amber-400 text-slate-950 font-bold shadow-md shadow-amber-400/10'
                  : 'text-slate-400 hover:text-slate-100 hover:bg-slate-800/80'
              } ${isCollapsed ? 'justify-center px-2' : ''}`}
            >
              <Icon className={`w-4 h-4 shrink-0 transition-transform ${isActive ? 'text-slate-950' : 'text-slate-400 group-hover:text-slate-200'}`} />

              {!isCollapsed && (
                <span className="truncate flex-1 text-left">{item.label}</span>
              )}

              {!isCollapsed && item.badge && (
                <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full shrink-0 ${item.badgeColor || 'bg-slate-800 text-slate-300'}`}>
                  {item.badge}
                </span>
              )}

              {/* Accessible Tooltip for Collapsed Mode */}
              {isCollapsed && (
                <div className="absolute left-full ml-3 px-2.5 py-1.5 bg-slate-900 text-white text-xs rounded-lg shadow-xl border border-slate-700 whitespace-nowrap opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-50">
                  {item.label}
                  {item.badge && <span className="ml-1.5 text-[10px] text-amber-400 font-bold">({item.badge})</span>}
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Footer Profile & Logout Area */}
      <div className="p-3 border-t border-slate-800 bg-slate-950/60">
        {currentUser ? (
          <div className="space-y-2">
            {!isCollapsed ? (
              <div className="flex items-center justify-between gap-2 px-1">
                <div className="min-w-0">
                  <p className="text-xs font-bold text-white truncate">{currentUser.full_name || 'Authenticated User'}</p>
                  <p className="text-[11px] text-slate-400 font-mono truncate">{currentUser.email}</p>
                </div>
                <button
                  onClick={onLogout}
                  className="p-1.5 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition shrink-0"
                  title="Sign out of MerchAI"
                >
                  <LogOut className="w-4 h-4" />
                </button>
              </div>
            ) : (
              <button
                onClick={onLogout}
                className="w-full flex justify-center p-2 text-slate-400 hover:text-red-400 rounded-lg hover:bg-slate-800 transition"
                title="Sign out of MerchAI"
              >
                <LogOut className="w-4 h-4" />
              </button>
            )}
          </div>
        ) : (
          <button
            onClick={onOpenAuth}
            className={`w-full flex items-center justify-center gap-2 py-2 px-3 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-xl text-xs font-bold transition shadow-sm ${isCollapsed ? 'p-2' : ''}`}
            title="Sign in to your account"
          >
            <LogIn className="w-4 h-4" />
            {!isCollapsed && <span>Sign In</span>}
          </button>
        )}
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Sidebar */}
      <aside
        className={`hidden md:block shrink-0 h-screen sticky top-0 transition-all duration-300 z-30 ${
          isCollapsed ? 'w-20' : 'w-64'
        }`}
      >
        {sidebarContent}
      </aside>

      {/* Mobile Backdrop & Drawer */}
      {isMobileOpen && (
        <div className="fixed inset-0 z-50 md:hidden flex">
          <div
            className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs transition-opacity"
            onClick={onCloseMobile}
          />
          <div className="relative flex-1 flex flex-col max-w-xs w-full bg-[#0F172A] z-50 animate-in slide-in-from-left duration-200">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}

