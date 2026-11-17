import { useState, useEffect } from 'react';
import type { UserRole, CartItem, User, Product } from './types';
import { Sidebar } from './components/Navigation/Sidebar';
import { Header } from './components/Navigation/Header';
import { CustomerView } from './components/Customer/CustomerView';
import { SellerView } from './components/Seller/SellerView';
import { OperationsView } from './components/Operations/OperationsView';
import { SupportView } from './components/Support/SupportView';
import { AdminView } from './components/Admin/AdminView';
import { LoginModal } from './components/Auth/LoginModal';
import { SellerOnboarding } from './components/Seller/SellerOnboarding';
import { AIChatbotWidget } from './components/Chatbot/AIChatbotWidget';
import { fetchCurrentUser, fetchHealthStatus, fetchDBCart, addDBItemToCart } from './services/api';
import { Sparkles, Activity, ShieldAlert, LogIn } from 'lucide-react';

// Helper to parse hash route like #/seller/products or #/customer/orders
const parseHashRoute = (): { role: UserRole | 'BECOME_SELLER'; subItem: string } | null => {
  if (typeof window === 'undefined') return null;
  const hash = window.location.hash.replace(/^#\/?/, '').trim();
  if (!hash) return null;
  const parts = hash.split('/');
  const rawRole = parts[0]?.toUpperCase();
  const subItem = parts[1] || 'overview';
  if (rawRole === 'BECOME_SELLER') {
    return { role: 'BECOME_SELLER', subItem: 'overview' };
  }
  const validRoles: UserRole[] = ['CUSTOMER', 'SELLER', 'OPERATIONS', 'SUPPORT', 'ADMIN'];
  if (validRoles.includes(rawRole as UserRole)) {
    return { role: rawRole as UserRole, subItem };
  }
  return null;
};

const syncRoute = (role: UserRole | 'BECOME_SELLER', subItem: string) => {
  if (typeof window === 'undefined') return;
  const targetHash = `#/${role.toLowerCase()}/${subItem.toLowerCase()}`;
  if (window.location.hash !== targetHash) {
    window.location.hash = targetHash;
  }
};

export function App() {
  const initialRoute = parseHashRoute();
  const [activeRole, setActiveRole] = useState<UserRole>(
    initialRoute && initialRoute.role !== 'BECOME_SELLER' ? initialRoute.role : 'CUSTOMER'
  );
  const [currentView, setCurrentView] = useState<UserRole | 'BECOME_SELLER'>(
    initialRoute ? initialRoute.role : 'CUSTOMER'
  );
  const [activeSubItem, setActiveSubItem] = useState<string>(
    initialRoute ? initialRoute.subItem : 'overview'
  );
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState<boolean>(false);

  const [searchTerm, setSearchTerm] = useState<string>('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState<boolean>(false);
  const [isAIOpen, setIsAIOpen] = useState<boolean>(false);
  
  // Auth state
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isAuthOpen, setIsAuthOpen] = useState<boolean>(false);
  const [apiOnline, setApiOnline] = useState<boolean>(false);
  const [pendingCartProduct, setPendingCartProduct] = useState<{ product: Product; quantity: number } | null>(null);

  // Authoritative Customer Chatbot authorization: Only customer accounts or guests on customer storefront can access
  const isCustomerChatbotAuthorized =
    currentView === 'CUSTOMER' &&
    (!currentUser || (currentUser.role && currentUser.role.toLowerCase() === 'customer'));

  // Automatically close chatbot if active view or user role becomes unauthorized
  useEffect(() => {
    if (!isCustomerChatbotAuthorized && isAIOpen) {
      setIsAIOpen(false);
    }
  }, [isCustomerChatbotAuthorized, isAIOpen]);

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
            // Restore persistent database cart for verified customers
            if (r === 'CUSTOMER') {
              fetchDBCart()
                .then((dbCart) => {
                  if (dbCart && dbCart.items) {
                    const mapped: CartItem[] = dbCart.items.map((it: any) => ({
                      product: {
                        id: it.product_id,
                        product_id: it.product_id,
                        name: it.product_name,
                        product_name: it.product_name,
                        price: it.unit_price,
                        stock_quantity: it.stock_quantity,
                        image_url: it.image_url,
                        category: it.category,
                        brand: it.brand,
                        seller_id: it.seller_id,
                        store_name: it.store_name,
                      },
                      quantity: it.quantity,
                    }));
                    setCart(mapped);
                  }
                })
                .catch(() => setCart([]));
            } else {
              setCart([]);
            }
          }
        })
        .catch(() => {
          localStorage.removeItem('access_token');
          setCurrentUser(null);
          setActiveRole('CUSTOMER');
          setCurrentView('CUSTOMER');
          setCart([]);
        });
    } else {
      setCart([]);
    }
  }, []);

  // Browser History and Hashchange synchronization
  useEffect(() => {
    const handleHashChange = () => {
      const route = parseHashRoute();
      if (route) {
        if (route.role === 'BECOME_SELLER') {
          setCurrentView('BECOME_SELLER');
          setActiveSubItem('overview');
        } else {
          setActiveRole(route.role);
          setCurrentView(route.role);
          setActiveSubItem(route.subItem);
        }
      }
    };
    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleLoginSuccess = async (user: User) => {
    setCurrentUser(user);
    if (user.role) {
      const r = user.role.toUpperCase() as UserRole;
      setActiveRole(r);
      setCurrentView(r);
      setActiveSubItem('overview');
      syncRoute(r, 'overview');

      // Load persistent cart if user is customer
      if (r === 'CUSTOMER') {
        try {
          const dbCart = await fetchDBCart();
          if (dbCart && dbCart.items) {
            const mapped: CartItem[] = dbCart.items.map((it: any) => ({
              product: {
                id: it.product_id,
                product_id: it.product_id,
                name: it.product_name,
                product_name: it.product_name,
                price: it.unit_price,
                stock_quantity: it.stock_quantity,
                image_url: it.image_url,
                category: it.category,
                brand: it.brand,
                seller_id: it.seller_id,
                store_name: it.store_name,
              },
              quantity: it.quantity,
            }));
            setCart(mapped);
          }
          if (pendingCartProduct) {
            const pending = pendingCartProduct;
            setPendingCartProduct(null);
            setTimeout(() => {
              handleAddToCart(pending.product, pending.quantity);
            }, 100);
          }
        } catch (err) {
          console.warn('Failed to fetch persistent cart on login:', err);
        }
      } else {
        setCart([]);
        setPendingCartProduct(null);
      }
    }
  };

  const handleLogout = () => {
    localStorage.removeItem('access_token');
    setCurrentUser(null);
    setActiveRole('CUSTOMER');
    setCurrentView('CUSTOMER');
    setActiveSubItem('overview');
    syncRoute('CUSTOMER', 'overview');
    setCart([]);
    setPendingCartProduct(null);
    setIsAIOpen(false);
  };

  const handleOpenBecomeSeller = () => {
    if (!currentUser) {
      setIsAuthOpen(true);
      return;
    }
    setCurrentView('BECOME_SELLER');
    syncRoute('BECOME_SELLER', 'overview');
  };

  const handleSelectRoleView = (role: UserRole) => {
    setActiveRole(role);
    setCurrentView(role);
    setActiveSubItem('overview');
    syncRoute(role, 'overview');
  };

  const handleSidebarSelect = (itemKey: string, role?: UserRole) => {
    const targetRole = role || activeRole;
    if (role && role !== activeRole) {
      setActiveRole(role);
      setCurrentView(role);
    }
    setActiveSubItem(itemKey);
    syncRoute(targetRole, itemKey);

    if (targetRole === 'CUSTOMER' && itemKey === 'cart') {
      setIsCartOpen(true);
    }
  };

  const handleNavigateHome = () => {
    setActiveRole('CUSTOMER');
    setCurrentView('CUSTOMER');
    setActiveSubItem('overview');
    syncRoute('CUSTOMER', 'overview');
  };

  const handleAddToCart = async (product: Product, quantity = 1) => {
    if (!currentUser) {
      setPendingCartProduct({ product, quantity });
      setIsAuthOpen(true);
      return;
    }

    if (currentUser.role?.toLowerCase() !== 'customer') {
      alert(`Role restriction: Your account role is '${currentUser.role}'. Only customer accounts can add products to cart and place orders.`);
      return;
    }

    const prodId = product.product_id || product.id || '';
    try {
      const dbCart = await addDBItemToCart({ product_id: prodId, quantity });
      if (dbCart && dbCart.items) {
        const mapped: CartItem[] = dbCart.items.map((it: any) => ({
          product: {
            id: it.product_id,
            product_id: it.product_id,
            name: it.product_name,
            product_name: it.product_name,
            price: it.unit_price,
            stock_quantity: it.stock_quantity,
            image_url: it.image_url,
            category: it.category,
            brand: it.brand,
            seller_id: it.seller_id,
            store_name: it.store_name,
          },
          quantity: it.quantity,
        }));
        setCart(mapped);
      }
    } catch (err: any) {
      console.error('Failed to add to database cart:', err);
      alert(err.message || 'Failed to add item to cart. Please verify stock availability.');
    }
  };

  const isDevPreview = import.meta.env.VITE_ENABLE_DEV_ROLE_SWITCHER === 'true';
  const isRoleAuthorized = () => {
    if (isDevPreview) return true;
    if (currentView === 'BECOME_SELLER') return true;
    if (currentView === 'CUSTOMER') return true;
    if (!currentUser) return false;
    return currentUser.role.toUpperCase() === currentView || currentUser.role.toUpperCase() === 'ADMIN';
  };

  const getActiveItemLabel = () => {
    const labels: Record<string, string> = {
      overview: 'Overview',
      browse: 'Browse Products',
      cart: 'My Cart',
      orders: 'Orders',
      tracking: 'Track Delivery',
      payments: 'Payments & Transactions',
      returns: 'Returns & Refunds',
      reviews: 'Reviews & Feedback',
      account: 'My Account',
      support: 'Support Helpdesk',
      products: 'Products Catalog',
      inventory: 'Inventory Management',
      shipments: 'Shipment Management',
      copilot: 'AI Catalog Copilot',
      demand: 'Demand Intelligence',
      advisor: 'AI Advisor',
      knowledge: 'Knowledge Base',
      settings: 'Settings',
      ready_pickup: 'Ready for Pickup',
      couriers: 'Courier Partners',
      fulfillment: 'Order Fulfillment',
      all_tickets: 'All Tickets',
      new_tickets: 'New Tickets',
      assigned: 'Assigned Tickets',
      order_issues: 'Order Issues',
      shipment_issues: 'Shipment Issues',
      returns_requests: 'Return Requests',
      escalations: 'Escalations',
      users: 'User Management',
      sellers: 'Seller Management',
      analytics: 'Marketplace Analytics',
      audit: 'Audit Logs'
    };
    return labels[activeSubItem.toLowerCase()] || activeSubItem;
  };

  return (
    <div className="flex h-screen w-full bg-[#F5F1E8] text-[#1F2937] overflow-hidden selection:bg-[#567C8D] selection:text-white">
      {/* 1. RESPONSIVE SIDEBAR (Desktop Sticky Collapsible + Mobile Drawer) */}
      <Sidebar
        currentRole={activeRole}
        activeItem={activeSubItem}
        onSelectItem={handleSidebarSelect}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        isMobileOpen={isMobileNavOpen}
        onCloseMobile={() => setIsMobileNavOpen(false)}
        currentUser={currentUser}
        onLogout={handleLogout}
        onOpenAuth={() => setIsAuthOpen(true)}
        cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
      />

      {/* 2. MAIN APPLICATION CONTENT AREA */}
      <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden">
        {/* RESPONSIVE HEADER */}
        <Header
          currentRole={activeRole}
          onSelectRole={handleSelectRoleView}
          activeItemLabel={getActiveItemLabel()}
          onToggleMobileMenu={() => setIsMobileNavOpen((prev) => !prev)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onLogout={handleLogout}
          onOpenCart={() => setIsCartOpen(true)}
          cartCount={cart.reduce((sum, item) => sum + item.quantity, 0)}
          apiOnline={apiOnline}
          searchTerm={searchTerm}
          onSearchChange={setSearchTerm}
          onOpenBecomeSeller={handleOpenBecomeSeller}
        />

        {/* SCROLLABLE VIEW CONTAINER */}
        <main className="flex-1 overflow-y-auto px-4 sm:px-6 lg:px-8 py-6 custom-scrollbar">
          <div className="max-w-7xl mx-auto w-full space-y-8">
            {!isRoleAuthorized() ? (
              /* RESTRICTED ACCESS GUARD */
              <div className="my-16 max-w-lg mx-auto p-8 bg-white border border-[#DCEAF0] rounded-3xl text-center space-y-4 shadow-xl">
                <div className="w-14 h-14 bg-red-50 border border-red-200 rounded-2xl flex items-center justify-center mx-auto text-[#B42318]">
                  <ShieldAlert className="w-7 h-7" />
                </div>
                <h2 className="text-xl font-bold text-[#14213D]">Restricted Portal Access</h2>
                <p className="text-sm text-[#667085] leading-relaxed">
                  The <span className="font-semibold text-[#14213D]">{currentView}</span> portal requires an authenticated account with verified <span className="font-mono text-[#567C8D] font-bold">{currentView}</span> credentials.
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
                      setActiveSubItem('overview');
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
                    isAIOpen={false}
                    setIsAIOpen={setIsAIOpen}
                    currentUser={currentUser}
                    onOpenAuth={() => setIsAuthOpen(true)}
                    sidebarSubTab={activeSubItem}
                  />
                )}

                {currentView === 'SELLER' && (
                  <SellerView activeSubTab={activeSubItem} />
                )}

                {currentView === 'OPERATIONS' && (
                  <OperationsView activeSubTab={activeSubItem} />
                )}

                {currentView === 'SUPPORT' && (
                  <SupportView activeSubTab={activeSubItem} />
                )}

                {currentView === 'ADMIN' && (
                  <AdminView activeSubTab={activeSubItem} />
                )}
              </>
            )}

            {/* SAAS PLATFORM FOOTER */}
            <footer className="mt-16 bg-[#14213D] text-[#DCEAF0] border border-[#233554] rounded-3xl p-8 text-xs shadow-xl space-y-6">
              <div className="grid grid-cols-1 md:grid-cols-4 gap-6 pb-6 border-b border-[#233554]">
                <div className="space-y-2">
                  <div className="flex items-center space-x-2">
                    <div className="w-7 h-7 bg-[#FCA311] rounded-lg flex items-center justify-center">
                      <Sparkles className="w-4 h-4 text-[#14213D]" />
                    </div>
                    <span className="font-extrabold text-sm text-white font-['Space_Grotesk']">
                      Merch<span className="text-[#FCA311]">AI</span> Platform
                    </span>
                  </div>
                  <p className="text-[11px] text-[#DCEAF0]/70 leading-relaxed">
                    AI-powered multi-seller discovery, authoritative Indian order fulfillment, and logistics tracking.
                  </p>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">Portals</h4>
                  <ul className="space-y-1 text-[#DCEAF0]/80 text-[11px]">
                    <li><button onClick={handleNavigateHome} className="hover:text-white transition">Customer Marketplace</button></li>
                    <li><button onClick={() => handleSelectRoleView('SELLER')} className="hover:text-white transition">Seller Store Console</button></li>
                    <li><button onClick={() => handleSelectRoleView('OPERATIONS')} className="hover:text-white transition">Operations Logistics Hub</button></li>
                  </ul>
                </div>

                <div className="space-y-1.5">
                  <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">Logistics & Support</h4>
                  <ul className="space-y-1 text-[#DCEAF0]/80 text-[11px]">
                    <li><button onClick={() => handleSelectRoleView('SUPPORT')} className="hover:text-white transition">Customer Support Desk</button></li>
                    <li><button onClick={() => handleSelectRoleView('ADMIN')} className="hover:text-white transition">Master Administrator</button></li>
                    <li><button onClick={handleOpenBecomeSeller} className="hover:text-white transition text-[#FCA311]">Register New Store</button></li>
                  </ul>
                </div>

                <div className="space-y-2">
                  <h4 className="font-bold text-white text-[11px] uppercase tracking-wider">Compliance</h4>
                  <p className="text-[11px] text-[#DCEAF0]/70">
                    Indian Rupee (₹) pricing, GST tax computation, role-based JWT authentication, local MySQL isolation.
                  </p>
                  <div className="inline-flex items-center space-x-1.5 px-2.5 py-1 rounded-md bg-white/5 border border-white/10 text-[10px] text-[#87CEEB]">
                    <Activity className={`w-3 h-3 ${apiOnline ? 'text-emerald-400' : 'text-red-400'}`} />
                    <span>FastAPI Backend {apiOnline ? 'Connected' : 'Offline'}</span>
                  </div>
                </div>
              </div>

              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-[10px] text-[#DCEAF0]/60">
                <p>© {new Date().getFullYear()} MerchAI Commerce Platform. Local MySQL ai_commerce_cleaned.</p>
                <div className="flex items-center space-x-3">
                  <span>Responsive Sidebar v0.4</span>
                  <span>•</span>
                  <span>Normal 100% Zoom Supported</span>
                </div>
              </div>
            </footer>
          </div>
        </main>
      </div>

      {/* LOGIN & AUTH MODAL */}
      <LoginModal
        isOpen={isAuthOpen}
        onClose={() => setIsAuthOpen(false)}
        onLoginSuccess={handleLoginSuccess}
      />

      {/* AI ASSISTANT WIDGET */}
      {isCustomerChatbotAuthorized && (
        <AIChatbotWidget
          isOpen={isAIOpen}
          onToggle={() => setIsAIOpen((prev) => !prev)}
          currentUser={currentUser}
          onOpenAuth={() => setIsAuthOpen(true)}
          onAddToCart={handleAddToCart}
          onOpenCart={() => setIsCartOpen(true)}
          currentRole={activeRole}
        />
      )}
    </div>
  );
}

export default App;
