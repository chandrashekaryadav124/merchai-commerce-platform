import { useState, useEffect } from 'react';
import type { UserRole, CartItem, User } from './types';
import { Navbar } from './components/Navbar';
import { CustomerView } from './components/Customer/CustomerView';
import { SellerView } from './components/Seller/SellerView';
import { OperationsView } from './components/Operations/OperationsView';
import { SupportView } from './components/Support/SupportView';
import { AdminView } from './components/Admin/AdminView';
import { LoginModal } from './components/Auth/LoginModal';
import { SellerOnboarding } from './components/Seller/SellerOnboarding';
import { fetchCurrentUser, fetchHealthStatus } from './services/api';
import { Sparkles, Heart, Activity, ShieldAlert, LogIn, Store, ShieldCheck, LifeBuoy, Truck } from 'lucide-react';

export function App() {
  const [activeRole, setActiveRole] = useState<UserRole>('CUSTOMER');
  const [currentView, setCurrentView] = useState<UserRole | 'BECOME_SELLER'>('CUSTOMER');
  const [customerSubTab, setCustomerSubTab] = useState<'shop' | 'account'>('shop');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);

  useEffect(() => {
    // Check API backend health status
    fetchHealthStatus()
      .then(() => setApiOnline(true))
      .catch(() => setApiOnline(false));

    // Restore verified user session from stored JWT
    const token = localStorage.getItem('access_token');
    if (token) {
      fetchCurrentUser()
        .then((user) => {
          setCurrentUser(user);
          if (user.role) {
            const r = user.role.toUpperCase() as UserRole;
            setActiveRole(r);
            setCurrentView(r);
          }
        })
        .catch(() => {
          localStorage.removeItem('access_token');
          setCurrentUser(null);
          setActiveRole('CUSTOMER');
          setCurrentView('CUSTOMER');
        });
    }
  }, []);

  const handleLoginSuccess = (user: User) => {
    setCurrentUser(user);
    if (user.role) {
      const r = user.role.toUpperCase() as UserRole;
      setActiveRole(r);
      setCurrentView(r);
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setCurrentUser(null);
    setActiveRole('CUSTOMER');
    setCurrentView('CUSTOMER');
    setCustomerSubTab('shop');
  };

  const handleOpenBecomeSeller = () => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    setCurrentView('BECOME_SELLER');
  };

  const handleSelectRoleView = (role: UserRole) => {
    setActiveRole(role);
    setCurrentView(role);
    if (role === 'CUSTOMER') {
      setCustomerSubTab('shop');
    }
  };

  const handleNavigateHome = () => {
    setActiveRole('CUSTOMER');
    setCurrentView('CUSTOMER');
    setCustomerSubTab('shop');
  };

  const handleOpenAccountTab = () => {
    setActiveRole('CUSTOMER');
    setCurrentView('CUSTOMER');
    setCustomerSubTab('account');
  };

  // Enforce frontend view protection: verify if current user is authorized to access current activeRole
  const isDevPreview = import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCHER === 'true';
  const isRoleAuthorized = () => {
    if (isDevPreview) return true; // Development preview override
    if (currentView === 'BECOME_SELLER') return true;
    if (currentView === 'CUSTOMER') return true; // Public marketplace
    if (!currentUser) return false; // Authentication required
    return currentUser.role.toUpperCase() === currentView || currentUser.role.toUpperCase() === 'ADMIN';
  };

  return (
    <div className="min-h-screen flex flex-col bg-[#F5F1E8] text-[#1F2937] selection:bg-[#567C8D] selection:text-white pb-16 md:pb-0">
      
      {/* NAVIGATION BAR */}
      <Navbar
        activeRole={activeRole}
        setActiveRole={handleSelectRoleView}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
        onOpenCart={() => setIsCartOpen(true)}
        onOpenAIAssistant={() => setIsAIOpen(true)}
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        currentUser={currentUser}
        onOpenAuth={() => setIsAuthOpen(true)}
        onLogout={handleLogout}
        onOpenBecomeSeller={handleOpenBecomeSeller}
        onNavigateHome={handleNavigateHome}
        onOpenAccountTab={handleOpenAccountTab}
      />

      {/* MAIN VIEW CONTENT WITH ROLE PROTECTION GUARDS */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 pt-5">
        {!isRoleAuthorized() ? (
          /* UNAUTHORIZED ACCESS GUARD NOTICE */
          <div className="my-16 max-w-lg mx-auto p-8 bg-white border border-[#DCEAF0] rounded-3xl text-center space-y-4 shadow-xl">
            <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-[#B42318]">
              <ShieldAlert className="w-7 h-7" />
            </div>
            <h2 className="text-xl font-bold text-[#14213D]">Restricted Portal Access</h2>
            <p className="text-sm text-[#667085] leading-relaxed">
              The <span className="font-semibold text-[#14213D]">{currentView}</span> portal requires an authenticated account with verified <span className="font-mono text-[#567C8D] font-bold">{currentView}</span> role credentials.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row items-center justify-center gap-3">
              <button
                onClick={() => setIsAuthOpen(true)}
                className="w-full sm:w-auto px-6 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center space-x-2 cursor-pointer"
              >
                <LogIn className="w-4 h-4 text-[#FCA311]" />
                <span>Sign In / Register</span>
              </button>
              <button
                onClick={handleNavigateHome}
                className="w-full sm:w-auto px-5 py-2.5 bg-[#DCEAF0] hover:bg-[#87CEEB]/40 text-[#14213D] rounded-xl text-xs font-semibold transition cursor-pointer"
              >
                Return to Marketplace
              </button>
            </div>
          </div>
        ) : (
          /* AUTHORIZED VIEW RENDERING */
          <>
            {currentView === 'BECOME_SELLER' && (
              <SellerOnboarding
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthOpen(true)}
                onGoToSellerDashboard={() => {
                  setActiveRole('SELLER');
                  setCurrentView('SELLER');
                }}
              />
            )}

            {currentView === 'CUSTOMER' && (
              <CustomerView
                searchTerm={searchTerm}
                cart={cart}
                setCart={setCart}
                isCartOpen={isCartOpen}
                setIsCartOpen={setIsCartOpen}
                isAIOpen={isAIOpen}
                setIsAIOpen={setIsAIOpen}
                currentUser={currentUser}
                onOpenAuth={() => setIsAuthOpen(true)}
                activeSubTab={customerSubTab}
                setActiveSubTab={setCustomerSubTab}
              />
            )}

            {currentView === 'SELLER' && <SellerView />}

            {currentView === 'OPERATIONS' && <OperationsView />}

            {currentView === 'SUPPORT' && <SupportView />}

            {currentView === 'ADMIN' && <AdminView />}
          </>
        )}
      </main>

      {/* LOGIN & AUTHENTICATION MODAL */}
      <LoginModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* FOOTER */}
      <footer className="mt-16 bg-[#14213D] text-[#DCEAF0] border-t border-[#233554] py-12 text-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 space-y-8">
          
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8 pb-8 border-b border-[#233554]">
            {/* Col 1: Brand Info */}
            <div className="space-y-3">
              <div className="flex items-center space-x-2">
                <div className="w-7 h-7 bg-[#FCA311] rounded-lg flex items-center justify-center">
                  <Sparkles className="w-4 h-4 text-[#14213D]" />
                </div>
                <span className="font-extrabold text-base text-white tracking-tight font-['Space_Grotesk']">
                  Merch<span className="text-[#FCA311]">AI</span> Platform
                </span>
              </div>
              <p className="text-xs text-[#DCEAF0]/70 leading-relaxed">
                Empowering verified Indian artisans, local storefronts, and independent producers with AI discovery and transparent commerce.
              </p>
              <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[11px] text-[#87CEEB]">
                <Activity className={`w-3 h-3 ${apiOnline ? 'text-emerald-400' : 'text-red-400'}`} />
                <span>FastAPI Backend {apiOnline ? '(Online)' : '(Connecting...)'}</span>
              </div>
            </div>

            {/* Col 2: Customer Discovery */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">Marketplace</h4>
              <ul className="space-y-1.5 text-xs text-[#DCEAF0]/80">
                <li><button onClick={handleNavigateHome} className="hover:text-white transition">Explore All Products</button></li>
                <li><button onClick={() => { handleNavigateHome(); setIsAIOpen(true); }} className="hover:text-[#FCA311] transition flex items-center space-x-1"><Sparkles className="w-3 h-3 text-[#FCA311]" /><span>AI Shopping Assistant</span></button></li>
                <li><button onClick={handleOpenAccountTab} className="hover:text-white transition">Track Active Shipments</button></li>
                <li><button onClick={handleOpenAccountTab} className="hover:text-white transition">Order History & Invoices</button></li>
              </ul>
            </div>

            {/* Col 3: Multi-Seller Hub */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">For Businesses</h4>
              <ul className="space-y-1.5 text-xs text-[#DCEAF0]/80">
                <li><button onClick={handleOpenBecomeSeller} className="hover:text-white transition flex items-center space-x-1"><Store className="w-3 h-3 text-[#87CEEB]" /><span>Sell on MerchAI</span></button></li>
                <li><button onClick={() => handleSelectRoleView('SELLER')} className="hover:text-white transition">Seller Analytics & Catalog</button></li>
                <li><button onClick={() => handleSelectRoleView('OPERATIONS')} className="hover:text-white transition flex items-center space-x-1"><Truck className="w-3 h-3 text-[#87CEEB]" /><span>Operations Logistics</span></button></li>
                <li><button onClick={() => handleSelectRoleView('SUPPORT')} className="hover:text-white transition flex items-center space-x-1"><LifeBuoy className="w-3 h-3 text-[#87CEEB]" /><span>Support Helpdesk</span></button></li>
              </ul>
            </div>

            {/* Col 4: Trust & Compliance */}
            <div className="space-y-2">
              <h4 className="font-bold text-white text-xs uppercase tracking-wider">Security & Trust</h4>
              <p className="text-xs text-[#DCEAF0]/70">
                100% Authoritative pricing in INR (₹). Role-based security with JWT tokens and local store isolation.
              </p>
              <div className="pt-1 flex items-center space-x-2 text-[11px] text-[#87CEEB]">
                <ShieldCheck className="w-4 h-4 text-[#FCA311]" />
                <span>MySQL ai_commerce_cleaned Verified</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 text-[11px] text-[#DCEAF0]/60">
            <p>© {new Date().getFullYear()} MerchAI Platform. All rights reserved. Indian Multi-Seller Marketplace.</p>
            <div className="flex items-center space-x-4">
              <span>Prices in INR (₹)</span>
              <span>•</span>
              <span>Power BI Integration Active</span>
              <span>•</span>
              <span className="flex items-center space-x-1">
                <span>Crafted with</span>
                <Heart className="w-3 h-3 text-red-400 fill-red-400 inline" />
              </span>
            </div>
          </div>

        </div>
      </footer>

    </div>
  );
}

export default App;
