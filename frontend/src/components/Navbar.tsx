import React, { useState } from 'react';
import type { UserRole, User } from '../types';
import {
  ShoppingBag,
  Sparkles,
  Store as StoreIcon,
  ShieldCheck,
  Search,
  ShoppingCart,
  Truck,
  LifeBuoy,
  LogIn,
  LogOut,
  Code,
  X,
  User as UserIcon
} from 'lucide-react';

interface NavbarProps {
  activeRole: UserRole;
  setActiveRole: (role: UserRole) => void;
  cartCount: number;
  onOpenCart: () => void;
  onOpenAIAssistant: () => void;
  searchTerm: string;
  setSearchTerm: (term: string) => void;
  currentUser: User | null;
  onOpenAuth: () => void;
  onLogout: () => void;
  onOpenBecomeSeller: () => void;
  onNavigateHome?: () => void;
  onOpenAccountTab?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  activeRole,
  setActiveRole,
  cartCount,
  onOpenCart,
  onOpenAIAssistant,
  searchTerm,
  setSearchTerm,
  currentUser,
  onOpenAuth,
  onLogout,
  onOpenBecomeSeller,
  onNavigateHome,
  onOpenAccountTab,
}) => {
  const [mobileSearchVisible, setMobileSearchVisible] = useState(false);

  // Isolate development preview mode flag cleanly behind env variable
  const isDevPreviewEnabled = import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCHER === 'true';

  const roleLabels: Record<UserRole, { title: string; icon: React.ReactNode; color: string; activeBg: string }> = {
    CUSTOMER: {
      title: 'Customer Marketplace',
      icon: <ShoppingBag className="w-3.5 h-3.5" />,
      color: 'bg-white/10 text-white border-white/20',
      activeBg: 'bg-[#567C8D]'
    },
    SELLER: {
      title: 'Seller Portal',
      icon: <StoreIcon className="w-3.5 h-3.5" />,
      color: 'bg-[#567C8D]/25 text-[#87CEEB] border-[#567C8D]/40',
      activeBg: 'bg-[#567C8D]'
    },
    OPERATIONS: {
      title: 'Operations Logistics',
      icon: <Truck className="w-3.5 h-3.5" />,
      color: 'bg-[#87CEEB]/20 text-[#87CEEB] border-[#87CEEB]/30',
      activeBg: 'bg-[#567C8D]'
    },
    SUPPORT: {
      title: 'Customer Support Desk',
      icon: <LifeBuoy className="w-3.5 h-3.5" />,
      color: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
      activeBg: 'bg-emerald-700'
    },
    ADMIN: {
      title: 'Admin Governance',
      icon: <ShieldCheck className="w-3.5 h-3.5" />,
      color: 'bg-amber-500/20 text-amber-300 border-amber-500/30',
      activeBg: 'bg-amber-700'
    },
  };

  const currentRoleInfo = roleLabels[activeRole] || roleLabels.CUSTOMER;

  return (
    <>
      {/* TOP DESKTOP & MOBILE HEADER */}
      <header className="sticky top-0 z-40 w-full bg-[#14213D] border-b border-[#233554] shadow-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16 gap-3">
            
            {/* Brand Logo & Marketplace Identity */}
            <div
              onClick={onNavigateHome}
              className="flex items-center space-x-3 cursor-pointer select-none flex-shrink-0"
              title="Return to Marketplace Storefront"
            >
              <div className="w-9 h-9 rounded-xl bg-[#FCA311] p-0.5 shadow-md flex items-center justify-center">
                <div className="w-full h-full bg-[#14213D] rounded-[10px] flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#FCA311]" />
                </div>
              </div>
              <div className="flex flex-col">
                <div className="flex items-center space-x-2">
                  <span className="font-extrabold text-lg tracking-tight text-white font-['Space_Grotesk']">
                    Merch<span className="text-[#FCA311]">AI</span>
                  </span>
                  {/* Current Active Role Badge */}
                  <span className={`hidden sm:inline-flex items-center space-x-1 px-2 py-0.5 text-[10px] font-semibold border rounded-md ${currentRoleInfo.color}`}>
                    {currentRoleInfo.icon}
                    <span>{currentRoleInfo.title}</span>
                  </span>
                </div>
                <p className="text-[10px] text-[#DCEAF0]/80 font-medium tracking-wide hidden sm:block">
                  Multi-Seller Marketplace & AI Discovery
                </p>
              </div>
            </div>

            {/* Desktop Search Bar (Only visible in Customer mode) */}
            {activeRole === 'CUSTOMER' && (
              <div className="hidden md:flex flex-1 max-w-lg mx-2 items-center relative">
                <div className="relative w-full">
                  <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#567C8D]" />
                  <input
                    type="text"
                    placeholder="Search authentic artisanal products, snacks, footwear..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full bg-[#FFFFFF] border border-[#DCEAF0] rounded-xl pl-9 pr-28 py-2 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D] focus:ring-2 focus:ring-[#567C8D]/20 transition-all shadow-inner"
                  />
                  {searchTerm && (
                    <button
                      onClick={() => setSearchTerm('')}
                      className="absolute right-24 top-1/2 -translate-y-1/2 text-[#667085] hover:text-[#1F2937] p-1"
                    >
                      <X className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    onClick={onOpenAIAssistant}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 flex items-center space-x-1 px-2.5 py-1 bg-[#567C8D] hover:bg-[#3F5E6B] text-white rounded-lg text-[11px] font-semibold transition-all shadow-sm cursor-pointer"
                    title="Open Conversational AI Assistant"
                  >
                    <Sparkles className="w-3 h-3 text-[#FCA311]" />
                    <span>AI Copilot</span>
                  </button>
                </div>
              </div>
            )}

            {/* Right Action Icons & User Controls */}
            <div className="flex items-center space-x-2 sm:space-x-3">
              
              {/* Mobile Search Toggle */}
              {activeRole === 'CUSTOMER' && (
                <button
                  onClick={() => setMobileSearchVisible(!mobileSearchVisible)}
                  className="md:hidden p-2 text-[#DCEAF0] hover:text-white rounded-lg bg-white/5"
                  title="Toggle Search"
                >
                  <Search className="w-4 h-4" />
                </button>
              )}

              {/* Become a Seller Button (Only shown in Customer role) */}
              {activeRole === 'CUSTOMER' && (
                <button
                  onClick={onOpenBecomeSeller}
                  className="hidden sm:flex items-center space-x-1.5 px-3 py-1.5 bg-[#567C8D]/20 hover:bg-[#567C8D]/40 text-[#DCEAF0] border border-[#567C8D]/40 rounded-xl text-xs font-semibold transition cursor-pointer"
                >
                  <StoreIcon className="w-3.5 h-3.5 text-[#FCA311]" />
                  <span>Become a Seller</span>
                </button>
              )}

              {/* Development Role Switcher */}
              {isDevPreviewEnabled && (
                <div className="bg-[#0B132B] px-2 py-1 rounded-xl border border-[#FCA311]/40 flex items-center space-x-1">
                  <Code className="w-3.5 h-3.5 text-[#FCA311]" />
                  <select
                    value={activeRole}
                    onChange={(e) => setActiveRole(e.target.value as UserRole)}
                    className="bg-transparent text-[#FCA311] text-xs font-mono font-medium focus:outline-none cursor-pointer"
                  >
                    <option value="CUSTOMER" className="bg-[#14213D] text-white">Dev: Customer</option>
                    <option value="SELLER" className="bg-[#14213D] text-white">Dev: Seller</option>
                    <option value="OPERATIONS" className="bg-[#14213D] text-white">Dev: Operations</option>
                    <option value="SUPPORT" className="bg-[#14213D] text-white">Dev: Support</option>
                    <option value="ADMIN" className="bg-[#14213D] text-white">Dev: Admin</option>
                  </select>
                </div>
              )}

              {/* Customer Cart Trigger */}
              {activeRole === 'CUSTOMER' && (
                <button
                  onClick={onOpenCart}
                  className="relative p-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl border border-white/15 transition-all flex items-center justify-center cursor-pointer shadow-sm"
                  title="View Shopping Cart"
                  aria-label="View Shopping Cart"
                >
                  <ShoppingCart className="w-4 h-4 text-white" />
                  {cartCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 bg-[#FCA311] text-[#14213D] font-extrabold text-[10px] w-5 h-5 rounded-full flex items-center justify-center border-2 border-[#14213D] shadow-sm animate-scale-in">
                      {cartCount}
                    </span>
                  )}
                </button>
              )}

              {/* Authenticated User or Sign In */}
              {currentUser ? (
                <div className="flex items-center space-x-2 border-l border-white/15 pl-2 sm:pl-3">
                  <div className="hidden lg:flex flex-col text-right">
                    <span className="text-xs font-semibold text-white leading-tight">{currentUser.full_name}</span>
                    <span className="text-[10px] text-[#87CEEB] font-mono uppercase font-bold tracking-wider">{currentUser.role}</span>
                  </div>
                  <button
                    onClick={onLogout}
                    title="Sign Out of Session"
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 bg-white/10 hover:bg-red-500/20 text-[#DCEAF0] hover:text-red-300 rounded-xl border border-white/10 transition text-xs font-medium cursor-pointer"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline">Sign Out</span>
                  </button>
                </div>
              ) : (
                <button
                  onClick={onOpenAuth}
                  className="flex items-center space-x-1.5 px-3.5 py-1.5 bg-[#FCA311] hover:bg-[#E5920C] text-[#14213D] rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Sign In</span>
                </button>
              )}

            </div>

          </div>

          {/* Mobile Search Row (Collapsible) */}
          {activeRole === 'CUSTOMER' && mobileSearchVisible && (
            <div className="pb-3 md:hidden">
              <div className="relative w-full">
                <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[#567C8D]" />
                <input
                  type="text"
                  placeholder="Search products, groceries, footwear..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white border border-[#DCEAF0] rounded-xl pl-9 pr-24 py-2 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
                />
                <button
                  onClick={onOpenAIAssistant}
                  className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center space-x-1 px-2.5 py-1 bg-[#567C8D] text-white rounded-lg text-[10px] font-semibold"
                >
                  <Sparkles className="w-3 h-3 text-[#FCA311]" />
                  <span>AI Copilot</span>
                </button>
              </div>
            </div>
          )}

        </div>
      </header>

      {/* MOBILE ACCESSIBLE BOTTOM NAVIGATION BAR (FIXED) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-[#14213D] border-t border-[#233554] shadow-2xl px-2 py-1.5 flex items-center justify-around">
        <button
          onClick={() => {
            setActiveRole('CUSTOMER');
            if (onNavigateHome) onNavigateHome();
          }}
          className={`flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium transition-colors ${
            activeRole === 'CUSTOMER' ? 'text-[#FCA311]' : 'text-[#DCEAF0]/70 hover:text-white'
          }`}
        >
          <ShoppingBag className="w-4 h-4 mb-0.5" />
          <span>Shop</span>
        </button>

        <button
          onClick={() => {
            if (onOpenAIAssistant) onOpenAIAssistant();
          }}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-[#87CEEB] hover:text-white transition-colors"
        >
          <Sparkles className="w-4 h-4 mb-0.5 text-[#FCA311]" />
          <span>AI Copilot</span>
        </button>

        <button
          onClick={onOpenCart}
          className="relative flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-[#DCEAF0]/70 hover:text-white transition-colors"
        >
          <ShoppingCart className="w-4 h-4 mb-0.5" />
          <span>Cart</span>
          {cartCount > 0 && (
            <span className="absolute top-0 right-2 bg-[#FCA311] text-[#14213D] font-extrabold text-[9px] w-4 h-4 rounded-full flex items-center justify-center">
              {cartCount}
            </span>
          )}
        </button>

        <button
          onClick={() => {
            if (currentUser) {
              if (onOpenAccountTab) onOpenAccountTab();
            } else {
              onOpenAuth();
            }
          }}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-[#DCEAF0]/70 hover:text-white transition-colors"
        >
          <UserIcon className="w-4 h-4 mb-0.5" />
          <span>{currentUser ? 'Account' : 'Sign In'}</span>
        </button>

        <button
          onClick={onOpenBecomeSeller}
          className="flex flex-col items-center justify-center py-1 px-3 rounded-lg text-[10px] font-medium text-[#DCEAF0]/70 hover:text-white transition-colors"
        >
          <StoreIcon className="w-4 h-4 mb-0.5 text-[#87CEEB]" />
          <span>Seller</span>
        </button>
      </nav>
    </>
  );
};
