import type { UserRole, User } from '../../types';
import {
  Menu,
  ShoppingCart,
  Activity,
  User as UserIcon,
  Store,
  Truck,
  LifeBuoy,
  ShieldCheck,
  Search,
  ChevronRight,
  LogOut
} from 'lucide-react';

interface HeaderProps {
  currentRole: UserRole;
  onSelectRole: (role: UserRole) => void;
  activeItemLabel: string;
  onToggleMobileMenu: () => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenCart: () => void;
  cartCount: number;
  apiOnline: boolean;
  searchTerm: string;
  onSearchChange: (value: string) => void;
  onOpenBecomeSeller: () => void;
}

export function Header({
  currentRole,
  onSelectRole,
  activeItemLabel,
  onToggleMobileMenu,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenCart,
  cartCount,
  apiOnline,
  searchTerm,
  onSearchChange,
  onOpenBecomeSeller
}: HeaderProps) {
  const isDevPreview = import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCHER === 'true';

  const roleLabels: Record<UserRole, { label: string; icon: React.ComponentType<{ className?: string }> }> = {
    CUSTOMER: { label: 'Marketplace', icon: ShoppingCart },
    SELLER: { label: 'Seller Portal', icon: Store },
    OPERATIONS: { label: 'Operations Hub', icon: Truck },
    SUPPORT: { label: 'Support Desk', icon: LifeBuoy },
    ADMIN: { label: 'Executive Admin', icon: ShieldCheck }
  };

  const CurrentRoleIcon = roleLabels[currentRole].icon;

  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-6 py-3 transition-all">
      <div className="flex items-center justify-between gap-4">
        {/* Left: Mobile hamburger & Breadcrumbs */}
        <div className="flex items-center gap-3">
          <button
            onClick={onToggleMobileMenu}
            className="md:hidden p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
            aria-label="Toggle navigation menu"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="flex items-center gap-2 text-xs">
            <span className="font-bold text-slate-800 flex items-center gap-1.5">
              <CurrentRoleIcon className="w-4 h-4 text-amber-500" />
              <span>{roleLabels[currentRole].label}</span>
            </span>
            <ChevronRight className="w-3.5 h-3.5 text-slate-400" />
            <span className="font-semibold text-slate-500 truncate max-w-[150px] sm:max-w-xs">
              {activeItemLabel}
            </span>
          </div>
        </div>

        {/* Center: Search input (especially helpful on Customer / Browse) */}
        <div className="hidden lg:flex flex-1 max-w-md mx-4">
          <div className="relative w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Search products, orders, categories..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-amber-500/20 focus:border-amber-500 transition"
            />
          </div>
        </div>

        {/* Right Actions: Dev role switcher, Cart, Health, Auth */}
        <div className="flex items-center gap-2 sm:gap-3">
          {/* Quick Role Switcher (Enabled in Dev Preview or for Admin) */}
          {(isDevPreview || currentUser?.role?.toUpperCase() === 'ADMIN') && (
            <div className="hidden sm:flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-200 text-[11px] font-semibold text-slate-600">
              {(['CUSTOMER', 'SELLER', 'OPERATIONS', 'SUPPORT', 'ADMIN'] as UserRole[]).map((r) => (
                <button
                  key={r}
                  onClick={() => onSelectRole(r)}
                  className={`px-2 py-1 rounded-md transition ${
                    currentRole === r
                      ? 'bg-white text-slate-900 shadow-xs font-bold'
                      : 'hover:text-slate-900'
                  }`}
                >
                  {r.charAt(0) + r.slice(1, 4).toLowerCase()}
                </button>
              ))}
            </div>
          )}

          {/* Become Seller CTA button if customer */}
          {currentRole === 'CUSTOMER' && !currentUser?.role?.includes('seller') && (
            <button
              onClick={onOpenBecomeSeller}
              className="hidden xl:inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-xs"
            >
              <Store className="w-3.5 h-3.5 text-amber-400" />
              <span>Sell on MerchAI</span>
            </button>
          )}

          {/* Cart Pill (for Customers) */}
          {currentRole === 'CUSTOMER' && (
            <button
              onClick={onOpenCart}
              className="relative p-2 text-slate-700 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
              title="Shopping Cart"
            >
              <ShoppingCart className="w-5 h-5" />
              {cartCount > 0 && (
                <span className="absolute -top-1 -right-1 bg-amber-500 text-slate-950 font-bold text-[10px] w-5 h-5 rounded-full flex items-center justify-center shadow-sm">
                  {cartCount}
                </span>
              )}
            </button>
          )}

          {/* Backend Status indicator */}
          <div
            className={`hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-mono border ${
              apiOnline
                ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                : 'bg-rose-50 text-rose-700 border-rose-200'
            }`}
            title={apiOnline ? 'FastAPI Backend Online' : 'Backend Disconnected'}
          >
            <Activity className="w-3 h-3" />
            <span className="hidden md:inline">{apiOnline ? 'API Connected' : 'Offline'}</span>
          </div>

          {/* User Profile / Auth Button */}
          {currentUser ? (
            <div className="flex items-center gap-2 pl-2 border-l border-slate-200">
              <div className="w-8 h-8 rounded-full bg-slate-900 text-amber-400 font-bold flex items-center justify-center text-xs shadow-sm">
                {currentUser.full_name ? currentUser.full_name.charAt(0).toUpperCase() : 'U'}
              </div>
              <div className="hidden md:block text-left">
                <p className="text-xs font-bold text-slate-900 leading-tight truncate max-w-[120px]">
                  {currentUser.full_name || 'My Account'}
                </p>
                <p className="text-[10px] font-mono text-slate-400 uppercase leading-tight">
                  {currentUser.role}
                </p>
              </div>
              <button
                onClick={onLogout}
                className="p-1 text-slate-400 hover:text-red-500 rounded-lg hover:bg-slate-100 transition"
                title="Sign out"
              >
                <LogOut className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              onClick={onOpenAuth}
              className="px-3.5 py-1.5 bg-amber-400 hover:bg-amber-300 text-slate-950 rounded-lg text-xs font-bold transition shadow-xs flex items-center gap-1.5"
            >
              <UserIcon className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
}
