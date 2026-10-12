import React, { useState, useEffect, useMemo } from 'react';
import type { Category, Product, CartItem, AIShoppingAssistantResponse, User, CustomerAddress, CheckoutSummary } from '../../types';
import {
  fetchCategories,
  fetchProducts,
  fetchProductDetails,
  askShoppingAssistant,
  fetchCustomerAddresses,
  createCustomerAddress,
  fetchCheckoutSummary,
  placeOrderReal,
  fetchDBCart,
  addDBItemToCart,
  updateDBCartItem,
  removeDBCartItem,
  NEUTRAL_PRODUCT_PLACEHOLDER
} from '../../services/api';
import {
  Sparkles,
  ShoppingCart,
  Star,
  MapPin,
  CheckCircle,
  CheckCircle2,
  Store,
  X,
  Bot,
  User as UserIcon,
  ShoppingBag,
  Tag,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  Truck,
  RotateCcw,
  SlidersHorizontal,
  Plus,
  Minus,
  Check,
  Trash2,
  AlertCircle,
  CreditCard,
  LogIn
} from 'lucide-react';
import { CustomerAccountView } from './CustomerAccountView';

interface CustomerViewProps {
  searchTerm: string;
  cart: CartItem[];
  setCart: React.Dispatch<React.SetStateAction<CartItem[]>>;
  isCartOpen: boolean;
  setIsCartOpen: (open: boolean) => void;
  isAIOpen: boolean;
  setIsAIOpen: (open: boolean) => void;
  currentUser?: User | null;
  onOpenAuth?: () => void;
  activeSubTab?: 'shop' | 'account';
  setActiveSubTab?: (tab: 'shop' | 'account') => void;
}

export const CustomerView: React.FC<CustomerViewProps> = ({
  searchTerm,
  cart,
  setCart,
  isCartOpen,
  setIsCartOpen,
  isAIOpen,
  setIsAIOpen,
  currentUser,
  onOpenAuth,
  activeSubTab = 'shop',
  setActiveSubTab,
}) => {
  const [internalSubTab, setInternalSubTab] = useState<'shop' | 'account'>('shop');
  const subTab = setActiveSubTab ? activeSubTab : internalSubTab;
  const setSubTab = setActiveSubTab || setInternalSubTab;

  const [categories, setCategories] = useState<Category[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<number | null>(null);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [modalQuantity, setModalQuantity] = useState<number>(1);
  const [loading, setLoading] = useState<boolean>(true);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');

  // AI Assistant State
  const [aiQuery, setAIQuery] = useState<string>('');
  const [aiBudget, setAIBudget] = useState<number>(1500);
  const [aiLoading, setAILoading] = useState<boolean>(false);
  const [aiResponse, setAIResponse] = useState<AIShoppingAssistantResponse | null>(null);

  // Multi-step checkout states
  const [checkoutStep, setCheckoutStep] = useState<'cart' | 'address' | 'summary' | 'confirmed'>('cart');
  const [savedAddresses, setSavedAddresses] = useState<CustomerAddress[]>([]);
  const [selectedAddressId, setSelectedAddressId] = useState<number | null>(null);
  const [isAddingNewAddress, setIsAddingNewAddress] = useState<boolean>(false);
  const [newAddressForm, setNewAddressForm] = useState({
    recipient_name: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
  });
  const [addressError, setAddressError] = useState<string | null>(null);
  const [checkoutSummary, setCheckoutSummary] = useState<CheckoutSummary | null>(null);
  const [isSummaryLoading, setIsSummaryLoading] = useState<boolean>(false);
  const [placedOrderInfo, setPlacedOrderInfo] = useState<any | null>(null);
  const [isPlacingOrder, setIsPlacingOrder] = useState<boolean>(false);
  const [checkoutError, setCheckoutError] = useState<string | null>(null);
  const [orderSuccessMsg, setOrderSuccessMsg] = useState<string | null>(null);

  useEffect(() => {
    async function loadData() {
      setLoading(true);
      try {
        const catObj = categories.find((c) => c.id === selectedCategory);
        const [cats, prods] = await Promise.all([
          fetchCategories(),
          fetchProducts({ category: catObj?.name || undefined, search: searchTerm || undefined }),
        ]);
        setCategories(cats);
        setProducts(prods);
      } catch (err) {
        console.error('Data load error:', err);
      } finally {
        setLoading(false);
      }
    }
    loadData();
  }, [selectedCategory, searchTerm]);

  // Sync authenticated user's cart from database
  useEffect(() => {
    if (currentUser) {
      fetchDBCart()
        .then((dbCart) => {
          if (dbCart && dbCart.items && dbCart.items.length > 0) {
            const mapped: CartItem[] = dbCart.items.map((it: any) => ({
              product: {
                id: it.product_id,
                product_id: it.product_id,
                name: it.product_name,
                price: it.unit_price,
                discount_price: it.unit_price,
                base_price: it.unit_price,
                store_name: it.store_name,
                brand: it.brand,
                category: it.category,
                image_url: it.image_url,
                stock: it.stock_quantity,
              },
              quantity: it.quantity,
            }));
            setCart(mapped);
          }
        })
        .catch(() => {});
    }
  }, [currentUser]);

  // Client-side sorting on authentic product records
  const sortedProducts = useMemo(() => {
    const list = [...products];
    if (sortBy === 'price_asc') {
      return list.sort((a, b) => {
        const pA = a.discount_price || a.selling_price || a.price || a.base_price || 0;
        const pB = b.discount_price || b.selling_price || b.price || b.base_price || 0;
        return pA - pB;
      });
    }
    if (sortBy === 'price_desc') {
      return list.sort((a, b) => {
        const pA = a.discount_price || a.selling_price || a.price || a.base_price || 0;
        const pB = b.discount_price || b.selling_price || b.price || b.base_price || 0;
        return pB - pA;
      });
    }
    if (sortBy === 'rating') {
      return list.sort((a, b) => (b.rating_avg || 0) - (a.rating_avg || 0));
    }
    return list;
  }, [products, sortBy]);

  const handleAddToCart = async (product: Product, quantity = 1) => {
    const prodId = product.product_id || product.id || '';
    if (currentUser) {
      try {
        await addDBItemToCart({ product_id: prodId, quantity });
      } catch (err: any) {
        console.warn('DB cart sync warning:', err);
      }
    }
    setCart((prev) => {
      const existing = prev.find((item) => (item.product.product_id || item.product.id) === prodId);
      if (existing) {
        return prev.map((item) =>
          (item.product.product_id || item.product.id) === prodId ? { ...item, quantity: item.quantity + quantity } : item
        );
      }
      return [...prev, { product, quantity }];
    });
  };

  const handleUpdateItemQuantity = async (productId: string, newQty: number) => {
    if (newQty <= 0) {
      handleRemoveItem(productId);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        (item.product.product_id || item.product.id) === productId ? { ...item, quantity: newQty } : item
      )
    );
    if (currentUser) {
      try {
        const dbCart = await fetchDBCart();
        const found = dbCart.items.find((i: any) => i.product_id === productId);
        if (found) {
          await updateDBCartItem(found.cart_item_id, newQty);
        }
      } catch (err) {
        console.warn('DB cart update failed:', err);
      }
    }
  };

  const handleRemoveItem = async (productId: string) => {
    setCart((prev) => prev.filter((item) => (item.product.product_id || item.product.id) !== productId));
    if (currentUser) {
      try {
        const dbCart = await fetchDBCart();
        const found = dbCart.items.find((i: any) => i.product_id === productId);
        if (found) {
          await removeDBCartItem(found.cart_item_id);
        }
      } catch (err) {
        console.warn('DB cart remove failed:', err);
      }
    }
  };

  const handleOpenProduct = async (id: string) => {
    try {
      setModalQuantity(1);
      const full = await fetchProductDetails(id);
      setSelectedProduct(full);
    } catch (err) {
      console.error(err);
    }
  };

  const handleAISubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!aiQuery.trim()) return;
    setAILoading(true);
    try {
      const res = await askShoppingAssistant(aiQuery, aiBudget);
      setAIResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setAILoading(false);
    }
  };

  const handleConfirmAICart = () => {
    if (!aiResponse || !aiResponse.suggested_cart) return;
    aiResponse.suggested_cart.forEach((item) => {
      const matchedProd = products.find((p) => (p.product_id || p.id) === item.product_id);
      if (matchedProd) {
        handleAddToCart(matchedProd, item.quantity);
      }
    });
    setIsAIOpen(false);
    setIsCartOpen(true);
  };

  const handleProceedToAddress = async () => {
    if (!currentUser && onOpenAuth) {
      onOpenAuth();
      return;
    }
    setCheckoutError(null);
    try {
      const addrs = await fetchCustomerAddresses();
      setSavedAddresses(addrs);
      const def = addrs.find((a: CustomerAddress) => a.is_default) || addrs[0];
      if (def) {
        setSelectedAddressId(def.address_id);
        setIsAddingNewAddress(false);
      } else {
        setSelectedAddressId(null);
        setIsAddingNewAddress(true);
      }
      setCheckoutStep('address');
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to load delivery addresses');
    }
  };

  const handleSaveNewAddressInline = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressError(null);
    const cleanPin = newAddressForm.postal_code.trim().replace(/\s/g, '');
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setAddressError('Please enter a valid 6-digit Indian PIN code (e.g. 560001).');
      return;
    }
    const cleanPhone = newAddressForm.phone_number.replace(/\D/g, '');
    if (cleanPhone.length < 10) {
      setAddressError('Please enter a valid 10-digit mobile number.');
      return;
    }
    try {
      const created = await createCustomerAddress({
        ...newAddressForm,
        postal_code: cleanPin,
        is_default: savedAddresses.length === 0,
      });
      const updatedAddrs = await fetchCustomerAddresses();
      setSavedAddresses(updatedAddrs);
      setSelectedAddressId(created.address_id);
      setIsAddingNewAddress(false);
      setNewAddressForm({
        recipient_name: '',
        phone_number: '',
        address_line1: '',
        address_line2: '',
        city: '',
        state: '',
        postal_code: '',
      });
    } catch (err: any) {
      setAddressError(err.message || 'Failed to save address.');
    }
  };

  const handleProceedToSummary = async () => {
    if (!selectedAddressId) {
      setCheckoutError('Please select or add a verified delivery address to proceed.');
      return;
    }
    setCheckoutError(null);
    setIsSummaryLoading(true);
    try {
      // Sync DB cart items before checkout summary calculation
      if (currentUser && cart.length > 0) {
        const dbCart = await fetchDBCart().catch(() => null);
        if (!dbCart || dbCart.items.length === 0) {
          for (const item of cart) {
            await addDBItemToCart({
              product_id: item.product.product_id || item.product.id,
              quantity: item.quantity,
            }).catch(() => {});
          }
        }
      }
      const summary = await fetchCheckoutSummary();
      setCheckoutSummary(summary);
      setCheckoutStep('summary');
    } catch (err: any) {
      setCheckoutError(err.message || 'Failed to calculate checkout summary.');
    } finally {
      setIsSummaryLoading(false);
    }
  };

  const handleConfirmAndPlaceOrder = async () => {
    if (!selectedAddressId) return;
    setIsPlacingOrder(true);
    setCheckoutError(null);
    const idemKey = `IDEM-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
    try {
      const res = await placeOrderReal({
        address_id: selectedAddressId,
        payment_method: 'Simulated Payment / Pending Capture',
        idempotency_key: idemKey,
      });
      setPlacedOrderInfo(res);
      setCart([]);
      setCheckoutStep('confirmed');
      setOrderSuccessMsg(`Order #${res.order_id || res.id} placed successfully!`);
    } catch (err: any) {
      setCheckoutError(err.message || 'Order placement transaction encountered an error. Please try again.');
    } finally {
      setIsPlacingOrder(false);
    }
  };

  const handleCloseCartDrawer = () => {
    setIsCartOpen(false);
    if (checkoutStep === 'confirmed') {
      setCheckoutStep('cart');
      setPlacedOrderInfo(null);
      setCheckoutSummary(null);
    }
  };

  const cartTotal = cart.reduce(
    (sum, item) => sum + (item.product.discount_price || item.product.price || item.product.base_price || 0) * item.quantity,
    0
  );

  return (
    <div className="space-y-8 pb-12">
      
      {/* SUB-NAVIGATION TAB PILLS */}
      <div className="flex items-center space-x-2 bg-white p-1 rounded-2xl border border-[#DCEAF0] w-fit shadow-xs">
        <button
          onClick={() => setSubTab('shop')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'shop'
              ? 'bg-[#14213D] text-white shadow-sm'
              : 'text-[#667085] hover:text-[#14213D] hover:bg-[#F5F1E8]'
          }`}
        >
          <ShoppingBag className="w-4 h-4 text-[#FCA311]" />
          <span>Marketplace Storefront</span>
        </button>

        <button
          onClick={() => setSubTab('account')}
          className={`flex items-center space-x-2 px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
            subTab === 'account'
              ? 'bg-[#14213D] text-white shadow-sm'
              : 'text-[#667085] hover:text-[#14213D] hover:bg-[#F5F1E8]'
          }`}
        >
          <UserIcon className="w-4 h-4 text-[#87CEEB]" />
          <span>My Account & Orders</span>
        </button>
      </div>

      {subTab === 'account' ? (
        <CustomerAccountView currentUser={currentUser} onOpenAuth={onOpenAuth} />
      ) : (
        <>
          {/* ECOMMERCE HERO SECTION */}
          <section className="relative overflow-hidden rounded-3xl bg-[#14213D] text-white p-8 sm:p-12 shadow-xl border border-[#233554]">
            {/* Subtle architectural shapes in palette */}
            <div className="absolute top-0 right-0 -translate-y-16 translate-x-16 w-80 h-80 bg-[#567C8D]/20 rounded-full blur-3xl pointer-events-none" />
            <div className="absolute bottom-0 left-0 translate-y-16 -translate-x-16 w-80 h-80 bg-[#FCA311]/10 rounded-full blur-3xl pointer-events-none" />

            <div className="relative z-10 max-w-3xl space-y-5">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-white/10 border border-white/15 text-[#87CEEB] text-xs font-semibold backdrop-blur-sm">
                <MapPin className="w-3.5 h-3.5 text-[#FCA311]" />
                <span>Pan-India Discovery & Verified Local Small Businesses</span>
              </div>

              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-white leading-tight font-['Space_Grotesk']">
                Discover Authentic <span className="text-[#FCA311]">Indian Products</span> Driven by AI
              </h1>

              <p className="text-[#DCEAF0] text-sm sm:text-base leading-relaxed max-w-2xl">
                Shop directly from neighborhood artisans, spice producers, bakeries, and footwear stores. 
                Use our Conversational AI Assistant to curate budget-conscious bundles tailored to your lifestyle.
              </p>

              {/* Action Buttons */}
              <div className="pt-2 flex flex-wrap gap-3 items-center">
                <button
                  onClick={() => {
                    const el = document.getElementById('products-section');
                    if (el) el.scrollIntoView({ behavior: 'smooth' });
                  }}
                  className="px-6 py-2.5 bg-[#FCA311] hover:bg-[#E5920C] text-[#14213D] rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-2 cursor-pointer"
                >
                  <span>Shop Catalog Now</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>

                <button
                  onClick={() => setIsAIOpen(true)}
                  className="px-5 py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold border border-white/20 transition flex items-center space-x-2 cursor-pointer"
                >
                  <Sparkles className="w-3.5 h-3.5 text-[#FCA311]" />
                  <span>Launch AI Assistant</span>
                </button>
              </div>

              {/* Quick AI Prompts */}
              <div className="pt-3 flex flex-wrap gap-2 items-center text-xs text-[#DCEAF0]/80">
                <span className="font-semibold text-white">Popular Prompts:</span>
                {[
                  'Snacks for 15 guests under ₹1,500',
                  'Homemade Mango Pickle 500g',
                  'Bata formal shoes',
                  'Artisanal Sourdough Bread',
                ].map((prompt, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      setAIQuery(prompt);
                      setIsAIOpen(true);
                    }}
                    className="px-3 py-1 rounded-lg bg-white/10 hover:bg-white/20 text-[#DCEAF0] hover:text-white border border-white/10 transition cursor-pointer flex items-center space-x-1"
                  >
                    <Sparkles className="w-3 h-3 text-[#FCA311]" />
                    <span>{prompt}</span>
                  </button>
                ))}
              </div>
            </div>
          </section>

          {/* TRUST PILLARS BAR */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-white rounded-2xl border border-[#DCEAF0] flex items-center space-x-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#DCEAF0] text-[#14213D] flex items-center justify-center flex-shrink-0">
                <ShieldCheck className="w-5 h-5 text-[#567C8D]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#14213D]">100% Verified Sellers</h4>
                <p className="text-[11px] text-[#667085]">Authentic independent stores</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#DCEAF0] flex items-center space-x-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#DCEAF0] text-[#14213D] flex items-center justify-center flex-shrink-0">
                <Truck className="w-5 h-5 text-[#567C8D]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#14213D]">Fast Pan-India Dispatch</h4>
                <p className="text-[11px] text-[#667085]">Reliable logistics tracking</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#DCEAF0] flex items-center space-x-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#FFF7EB] text-[#B45309] flex items-center justify-center flex-shrink-0 border border-[#FCA311]/30">
                <Tag className="w-5 h-5 text-[#FCA311]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#14213D]">Authoritative Pricing</h4>
                <p className="text-[11px] text-[#667085]">Honest INR rates & real deals</p>
              </div>
            </div>

            <div className="p-4 bg-white rounded-2xl border border-[#DCEAF0] flex items-center space-x-3 shadow-xs">
              <div className="w-10 h-10 rounded-xl bg-[#DCEAF0] text-[#14213D] flex items-center justify-center flex-shrink-0">
                <RotateCcw className="w-5 h-5 text-[#567C8D]" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-[#14213D]">Easy Returns & Support</h4>
                <p className="text-[11px] text-[#667085]">Dedicated customer desk</p>
              </div>
            </div>
          </div>

          {/* SUCCESS ORDER BANNER */}
          {orderSuccessMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-[#15803D] rounded-2xl flex items-center justify-between shadow-sm animate-fade-in">
              <div className="flex items-center space-x-3">
                <CheckCircle className="w-5 h-5 text-[#15803D] flex-shrink-0" />
                <p className="font-semibold text-xs sm:text-sm">{orderSuccessMsg}</p>
              </div>
              <button onClick={() => setOrderSuccessMsg(null)} className="text-[#667085] hover:text-[#1F2937]">
                <X className="w-4 h-4" />
              </button>
            </div>
          )}

          {/* CATEGORY TABS & SORT CONTROLS */}
          <div id="products-section" className="space-y-4 pt-2">
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
              
              {/* Category Chips Bar */}
              <div className="flex items-center space-x-2 overflow-x-auto pb-1 scrollbar-none flex-1">
                <button
                  onClick={() => setSelectedCategory(null)}
                  className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                    selectedCategory === null
                      ? 'bg-[#14213D] text-white shadow-xs'
                      : 'bg-white text-[#667085] border border-[#DCEAF0] hover:text-[#14213D] hover:border-[#567C8D]'
                  }`}
                >
                  All Categories ({products.length})
                </button>

                {categories.map((cat) => (
                  <button
                    key={cat.id}
                    onClick={() => setSelectedCategory(cat.id)}
                    className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition-all cursor-pointer ${
                      selectedCategory === cat.id
                        ? 'bg-[#14213D] text-white shadow-xs'
                        : 'bg-white text-[#667085] border border-[#DCEAF0] hover:text-[#14213D] hover:border-[#567C8D]'
                    }`}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Sort Dropdown */}
              <div className="flex items-center space-x-2 flex-shrink-0">
                <SlidersHorizontal className="w-3.5 h-3.5 text-[#567C8D]" />
                <span className="text-xs font-medium text-[#667085]">Sort by:</span>
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as any)}
                  className="bg-white border border-[#DCEAF0] rounded-xl px-3 py-1.5 text-xs font-semibold text-[#1F2937] focus:outline-none focus:border-[#567C8D] cursor-pointer shadow-2xs"
                >
                  <option value="featured">Featured / Default</option>
                  <option value="price_asc">Price: Low to High</option>
                  <option value="price_desc">Price: High to Low</option>
                  <option value="rating">Top Customer Rated</option>
                </select>
              </div>

            </div>
          </div>

          {/* PRODUCT CATALOG GRID */}
          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {[1, 2, 3, 4, 5, 6, 7, 8].map((i) => (
                <div key={i} className="h-88 bg-white rounded-2xl animate-pulse border border-[#DCEAF0] p-4 space-y-4">
                  <div className="h-44 bg-[#F5F1E8] rounded-xl w-full" />
                  <div className="h-4 bg-[#F5F1E8] rounded w-3/4" />
                  <div className="h-3 bg-[#F5F1E8] rounded w-1/2" />
                  <div className="h-6 bg-[#F5F1E8] rounded w-1/3 pt-4" />
                </div>
              ))}
            </div>
          ) : sortedProducts.length === 0 ? (
            <div className="py-20 text-center bg-white rounded-3xl border border-[#DCEAF0] p-8 space-y-4 max-w-xl mx-auto shadow-xs">
              <ShoppingBag className="w-12 h-12 mx-auto text-[#567C8D]/60" />
              <h3 className="text-base font-bold text-[#14213D]">No products found</h3>
              <p className="text-xs text-[#667085] leading-relaxed">
                {searchTerm
                  ? `No matching items found for "${searchTerm}". Try browsing categories or clear your search term.`
                  : 'No products are currently available in this category.'}
              </p>
              {searchTerm && (
                <button
                  onClick={() => setSelectedCategory(null)}
                  className="px-4 py-2 bg-[#14213D] text-white rounded-xl text-xs font-semibold hover:bg-[#0B132B] transition"
                >
                  Show All Products
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {sortedProducts.map((product) => {
                const originalPrice = product.base_price || product.price || 0;
                const sellingPrice = product.selling_price || originalPrice;
                const hasDiscount = Boolean(
                  product.discount_price &&
                  product.discount_price > 0 &&
                  product.discount_price < originalPrice
                );
                const currentPrice = hasDiscount ? product.discount_price! : sellingPrice;
                const imageUrl = (product.images && product.images.length > 0 && product.images[0])
                  ? product.images[0]
                  : NEUTRAL_PRODUCT_PLACEHOLDER;

                return (
                  <div
                    key={product.id || product.product_id}
                    className="group relative bg-white rounded-2xl border border-[#E5E7EB] hover:border-[#567C8D]/50 hover:shadow-lg transition-all duration-300 overflow-hidden flex flex-col justify-between"
                  >
                    <div>
                      {/* Product Image Container (Consistent Aspect Ratio & Neutral BG) */}
                      <div
                        onClick={() => handleOpenProduct(product.product_id || product.id || '')}
                        className="relative h-52 w-full overflow-hidden bg-[#FAF9F6] flex items-center justify-center cursor-pointer"
                      >
                        <img
                          src={imageUrl}
                          alt={product.name || product.product_name}
                          onError={(e) => {
                            (e.currentTarget as HTMLImageElement).src = NEUTRAL_PRODUCT_PLACEHOLDER;
                          }}
                          className="w-full h-full object-cover group-hover:scale-103 transition-transform duration-500"
                        />

                        {/* Genuine Gold Discount Badge */}
                        {hasDiscount && (
                          <span className="absolute top-3 left-3 bg-[#FCA311] text-[#14213D] text-[10px] font-extrabold px-2.5 py-0.5 rounded-full shadow-xs">
                            SAVE ₹{(originalPrice - (product.discount_price || 0)).toFixed(0)}
                          </span>
                        )}

                        {/* Star Rating or Verified Tag */}
                        {product.rating_avg != null && (product.rating_count ?? 0) > 0 ? (
                          <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-[#1F2937] text-[11px] font-bold px-2 py-0.5 rounded-lg border border-[#DCEAF0] flex items-center space-x-1 shadow-2xs">
                            <Star className="w-3 h-3 text-[#FCA311] fill-[#FCA311]" />
                            <span>{product.rating_avg.toFixed(1)}</span>
                          </span>
                        ) : (
                          <span className="absolute top-3 right-3 bg-white/95 backdrop-blur-sm text-[#567C8D] text-[10px] font-semibold px-2 py-0.5 rounded-md border border-[#DCEAF0] shadow-2xs">
                            Verified Store
                          </span>
                        )}
                      </div>

                      {/* Product Content Details */}
                      <div className="p-4 space-y-2">
                        <div className="flex items-center justify-between text-xs">
                          <div className="flex items-center space-x-1 text-[#567C8D] font-medium truncate max-w-[60%]">
                            <Store className="w-3.5 h-3.5 flex-shrink-0" />
                            <span className="font-semibold truncate">{product.store_name || 'Marketplace Seller'}</span>
                          </div>
                          {product.category && (
                            <span className="px-2 py-0.5 bg-[#DCEAF0] text-[#2F5261] border border-[#567C8D]/20 rounded-md text-[10px] font-semibold truncate max-w-[40%]">
                              {product.category}
                            </span>
                          )}
                        </div>

                        <h3
                          onClick={() => handleOpenProduct(product.product_id || product.id || '')}
                          className="font-bold text-[#14213D] text-sm hover:text-[#567C8D] transition-colors line-clamp-1 cursor-pointer"
                          title={product.name || product.product_name}
                        >
                          {product.name || product.product_name}
                        </h3>

                        <p className="text-[#667085] text-xs line-clamp-2 leading-relaxed">
                          {product.description && product.description.trim()
                            ? product.description
                            : 'Authentic local product verified and ready for quick dispatch.'}
                        </p>
                      </div>
                    </div>

                    {/* Card Footer Price & Buy Button */}
                    <div className="p-4 pt-0 flex items-center justify-between border-t border-[#F5F1E8] mt-2">
                      <div>
                        <div className="flex items-baseline space-x-1.5">
                          <span className="text-base font-extrabold text-[#14213D]">
                            ₹{currentPrice.toLocaleString('en-IN')}
                          </span>
                          {hasDiscount && (
                            <span className="text-xs text-[#667085] line-through">
                              ₹{originalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                        </div>
                        <span className="text-[10px] text-[#15803D] font-semibold block">
                          {product.stock_quantity && product.stock_quantity > 0
                            ? `In Stock (${product.stock_quantity})`
                            : 'In Stock'}
                        </span>
                      </div>

                      <button
                        onClick={() => handleAddToCart(product)}
                        className="flex items-center space-x-1 px-3 py-2 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-xs active:scale-95 cursor-pointer"
                      >
                        <ShoppingCart className="w-3.5 h-3.5 text-[#FCA311]" />
                        <span>Add</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* PRODUCT DETAILS & RECOMMENDATIONS MODAL */}
          {selectedProduct && (() => {
            const modalOriginalPrice = selectedProduct.base_price || selectedProduct.price || 0;
            const modalSellingPrice = selectedProduct.selling_price || modalOriginalPrice;
            const modalHasDiscount = Boolean(
              selectedProduct.discount_price &&
              selectedProduct.discount_price > 0 &&
              selectedProduct.discount_price < modalOriginalPrice
            );
            const modalCurrentPrice = modalHasDiscount ? selectedProduct.discount_price! : modalSellingPrice;
            const modalImg = (selectedProduct.images && selectedProduct.images.length > 0 && selectedProduct.images[0])
              ? selectedProduct.images[0]
              : NEUTRAL_PRODUCT_PLACEHOLDER;

            return (
              <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
                <div className="bg-white border border-[#DCEAF0] rounded-3xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-6 sm:p-8 space-y-6 relative shadow-2xl">
                  
                  {/* Close Modal Button */}
                  <button
                    onClick={() => setSelectedProduct(null)}
                    className="absolute top-5 right-5 p-2 bg-[#F5F1E8] hover:bg-[#DCEAF0] text-[#14213D] rounded-xl transition cursor-pointer"
                    aria-label="Close dialog"
                  >
                    <X className="w-5 h-5" />
                  </button>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                    {/* Modal Product Image */}
                    <div className="h-68 rounded-2xl overflow-hidden bg-[#FAF9F6] border border-[#E5E7EB] flex items-center justify-center p-2">
                      <img
                        src={modalImg}
                        alt={selectedProduct.name || selectedProduct.product_name}
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).src = NEUTRAL_PRODUCT_PLACEHOLDER;
                        }}
                        className="w-full h-full object-contain rounded-xl"
                      />
                    </div>

                    {/* Modal Metadata & Actions */}
                    <div className="space-y-4 flex flex-col justify-between">
                      <div className="space-y-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-1.5 text-xs text-[#567C8D] font-bold">
                            <Store className="w-4 h-4 text-[#14213D]" />
                            <span>{selectedProduct.store_name || 'Marketplace Seller'}</span>
                          </div>
                          {selectedProduct.category && (
                            <span className="px-2.5 py-0.5 bg-[#DCEAF0] text-[#2F5261] border border-[#567C8D]/20 rounded-md text-xs font-semibold">
                              {selectedProduct.category}
                            </span>
                          )}
                        </div>

                        <h2 className="text-xl font-bold text-[#14213D] leading-snug font-['Space_Grotesk']">
                          {selectedProduct.name || selectedProduct.product_name}
                        </h2>

                        {/* Price & Savings */}
                        <div className="flex items-baseline space-x-3">
                          <span className="text-2xl font-extrabold text-[#14213D]">
                            ₹{modalCurrentPrice.toLocaleString('en-IN')}
                          </span>
                          {modalHasDiscount && (
                            <span className="text-sm text-[#667085] line-through">
                              ₹{modalOriginalPrice.toLocaleString('en-IN')}
                            </span>
                          )}
                          <span className="px-2.5 py-0.5 bg-emerald-50 text-[#15803D] border border-emerald-200 rounded-md text-xs font-bold">
                            {selectedProduct.stock_quantity && selectedProduct.stock_quantity > 0
                              ? `In Stock (${selectedProduct.stock_quantity})`
                              : 'In Stock'}
                          </span>
                        </div>

                        {/* Description */}
                        <div>
                          <h4 className="text-[11px] font-bold text-[#667085] uppercase tracking-wider mb-1">
                            Product Description
                          </h4>
                          <p className="text-[#1F2937] text-xs leading-relaxed max-h-24 overflow-y-auto">
                            {selectedProduct.description && selectedProduct.description.trim()
                              ? selectedProduct.description
                              : 'Authentic local product verified and listed for dispatch with warranty.'}
                          </p>
                        </div>

                        {/* Specifications Table */}
                        <div className="p-3 bg-[#F5F1E8] rounded-xl border border-[#DCEAF0] space-y-1.5 text-xs">
                          <div className="flex justify-between text-[#667085]">
                            <span>Category:</span>
                            <span className="text-[#14213D] font-medium">{selectedProduct.category || 'General'}</span>
                          </div>
                          <div className="flex justify-between text-[#667085]">
                            <span>Storefront:</span>
                            <span className="text-[#14213D] font-medium">{selectedProduct.store_name || 'Marketplace Seller'}</span>
                          </div>
                          <div className="flex justify-between text-[#667085]">
                            <span>Brand:</span>
                            <span className="text-[#14213D] font-medium">
                              {selectedProduct.brand && selectedProduct.brand.toLowerCase() !== 'generic'
                                ? selectedProduct.brand
                                : (selectedProduct.store_name || 'Artisanal')}
                            </span>
                          </div>
                          <div className="flex justify-between text-[#667085]">
                            <span>Customer Reviews:</span>
                            <span className="text-[#14213D] font-medium">
                              {selectedProduct.rating_avg != null && (selectedProduct.rating_count ?? 0) > 0
                                ? `★ ${selectedProduct.rating_avg.toFixed(1)} / 5.0 (${selectedProduct.rating_count} reviews)`
                                : 'No reviews recorded yet'}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Quantity & Add to Cart Controls */}
                      <div className="pt-2 space-y-3">
                        <div className="flex items-center space-x-3">
                          <span className="text-xs font-semibold text-[#667085]">Quantity:</span>
                          <div className="flex items-center border border-[#DCEAF0] rounded-xl bg-white">
                            <button
                              onClick={() => setModalQuantity(Math.max(1, modalQuantity - 1))}
                              className="p-1.5 text-[#14213D] hover:bg-[#F5F1E8] rounded-l-xl cursor-pointer"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-3 text-xs font-bold text-[#14213D]">{modalQuantity}</span>
                            <button
                              onClick={() => setModalQuantity(modalQuantity + 1)}
                              className="p-1.5 text-[#14213D] hover:bg-[#F5F1E8] rounded-r-xl cursor-pointer"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>

                        <button
                          onClick={() => {
                            handleAddToCart(selectedProduct, modalQuantity);
                            setSelectedProduct(null);
                          }}
                          className="w-full py-3 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <ShoppingCart className="w-4 h-4 text-[#FCA311]" />
                          <span>Add {modalQuantity} Item(s) to Cart • ₹{(modalCurrentPrice * modalQuantity).toLocaleString('en-IN')}</span>
                        </button>
                      </div>

                    </div>
                  </div>

                  {/* HYBRID ML RECOMMENDATIONS SECTION */}
                  {selectedProduct.similar_recommendations && selectedProduct.similar_recommendations.length > 0 && (
                    <div className="pt-4 border-t border-[#DCEAF0] space-y-3">
                      <div className="flex items-center justify-between">
                        <h4 className="text-xs font-bold text-[#14213D] flex items-center space-x-2 uppercase tracking-wider">
                          <Sparkles className="w-4 h-4 text-[#FCA311]" />
                          <span>AI Hybrid Recommendations (Customers Also Viewed)</span>
                        </h4>
                      </div>

                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {selectedProduct.similar_recommendations.map((rec) => (
                          <div
                            key={rec.product_id}
                            onClick={() => handleOpenProduct(rec.product_id)}
                            className="p-3 bg-[#F5F1E8] hover:bg-[#DCEAF0]/50 border border-[#DCEAF0] rounded-xl cursor-pointer transition-colors space-y-1"
                          >
                            <p className="text-xs font-bold text-[#14213D] line-clamp-1">{rec.name}</p>
                            <div className="flex justify-between items-center text-[11px]">
                              <span className="text-[#14213D] font-extrabold">₹{rec.base_price.toLocaleString('en-IN')}</span>
                              <span className="text-[#15803D] font-bold text-[10px]">
                                {(rec.similarity_score * 100).toFixed(0)}% Match
                              </span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                </div>
              </div>
            );
          })()}

          {/* CONVERSATIONAL AI SHOPPING ASSISTANT MODAL */}
          {isAIOpen && (
            <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="bg-white border border-[#DCEAF0] rounded-3xl max-w-xl w-full p-6 sm:p-8 space-y-6 relative shadow-2xl">
                
                {/* Modal Header */}
                <div className="flex items-center justify-between pb-4 border-b border-[#DCEAF0]">
                  <div className="flex items-center space-x-3">
                    <div className="w-10 h-10 rounded-xl bg-[#14213D] flex items-center justify-center shadow-md">
                      <Bot className="w-5 h-5 text-[#FCA311]" />
                    </div>
                    <div>
                      <h3 className="font-bold text-base text-[#14213D]">MerchAI Shopping Assistant</h3>
                      <p className="text-xs text-[#667085]">Constraint-Aware Product Curation & Carts</p>
                    </div>
                  </div>

                  <button
                    onClick={() => setIsAIOpen(false)}
                    className="p-2 bg-[#F5F1E8] hover:bg-[#DCEAF0] text-[#14213D] rounded-xl transition"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>

                {/* Query Form */}
                <form onSubmit={handleAISubmit} className="space-y-4">
                  <div>
                    <label className="block text-xs font-bold text-[#14213D] mb-1.5">
                      What are you shopping for today?
                    </label>
                    <textarea
                      rows={2}
                      value={aiQuery}
                      onChange={(e) => setAIQuery(e.target.value)}
                      placeholder="e.g. Find organic snacks & sweets for 15 guests under ₹1,500..."
                      className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D] focus:ring-1 focus:ring-[#567C8D]"
                    />
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex-1">
                      <div className="flex justify-between text-xs font-bold text-[#14213D] mb-1">
                        <span>Budget Cap:</span>
                        <span className="text-[#567C8D]">₹{aiBudget.toLocaleString('en-IN')}</span>
                      </div>
                      <input
                        type="range"
                        min="200"
                        max="5000"
                        step="100"
                        value={aiBudget}
                        onChange={(e) => setAIBudget(Number(e.target.value))}
                        className="w-full accent-[#567C8D] cursor-pointer"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={aiLoading}
                      className="px-5 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-md flex items-center justify-center space-x-1.5 cursor-pointer"
                    >
                      <Sparkles className="w-4 h-4 text-[#FCA311]" />
                      <span>{aiLoading ? 'Thinking...' : 'Curate Cart'}</span>
                    </button>
                  </div>
                </form>

                {/* AI Assistant Output Card */}
                {aiResponse && (
                  <div className="p-4 bg-[#F5F1E8] rounded-2xl border border-[#DCEAF0] space-y-4 animate-fade-in">
                    <div className="text-xs text-[#1F2937] leading-relaxed">
                      <p className="font-medium">{aiResponse.assistant_response}</p>
                    </div>

                    {/* Suggested Items List */}
                    <div className="space-y-2">
                      {(aiResponse.suggested_cart || []).map((item) => (
                        <div
                          key={item.product_id}
                          className="p-2.5 bg-white rounded-xl border border-[#DCEAF0] flex items-center justify-between text-xs shadow-2xs"
                        >
                          <div>
                            <p className="font-bold text-[#14213D]">{item.name}</p>
                            <p className="text-[10px] text-[#567C8D] font-medium">{item.store_name}</p>
                          </div>
                          <span className="font-bold text-[#14213D]">₹{item.price.toLocaleString('en-IN')}</span>
                        </div>
                      ))}
                    </div>

                    {/* Total Price & Confirmation Approval Box */}
                    <div className="pt-3 border-t border-[#DCEAF0] flex items-center justify-between">
                      <div>
                        <p className="text-[10px] text-[#667085]">Calculated Bundle Total:</p>
                        <p className="text-base font-extrabold text-[#14213D]">₹{(aiResponse.total_price || 0).toLocaleString('en-IN')}</p>
                      </div>

                      <button
                        onClick={handleConfirmAICart}
                        className="px-4 py-2 bg-[#15803D] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center space-x-1.5 cursor-pointer"
                      >
                        <Check className="w-4 h-4" />
                        <span>Confirm & Add to Cart</span>
                      </button>
                    </div>
                  </div>
                )}

              </div>
            </div>
          )}

          {/* MULTI-SELLER CART & MULTI-STEP CHECKOUT DRAWER */}
          {isCartOpen && (
            <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
              <div className="w-full max-w-lg bg-white border-l border-[#DCEAF0] h-full p-6 flex flex-col justify-between shadow-2xl overflow-y-auto">
                
                {/* Header & Multi-Step Progress Tracker */}
                <div className="space-y-4">
                  <div className="flex items-center justify-between pb-3 border-b border-[#DCEAF0]">
                    <div className="flex items-center space-x-2">
                      <div className="w-8 h-8 rounded-xl bg-[#F5F1E8] border border-[#DCEAF0] flex items-center justify-center text-[#14213D]">
                        <ShoppingCart className="w-4 h-4 text-[#FCA311]" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-[#14213D] font-['Space_Grotesk']">
                          {checkoutStep === 'cart' && `Your Cart (${cart.reduce((s, i) => s + i.quantity, 0)} Items)`}
                          {checkoutStep === 'address' && 'Select Delivery Address'}
                          {checkoutStep === 'summary' && 'Review & Authoritative Pricing'}
                          {checkoutStep === 'confirmed' && 'Order Confirmed!'}
                        </h3>
                        <p className="text-[10px] text-[#567C8D]">Database Persistence & Real-time Stock Checks</p>
                      </div>
                    </div>
                    <button
                      onClick={handleCloseCartDrawer}
                      className="p-1.5 text-[#667085] hover:text-[#14213D] rounded-lg hover:bg-[#F5F1E8] cursor-pointer"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>

                  {/* Step Progress Pills */}
                  {checkoutStep !== 'confirmed' && (
                    <div className="flex items-center justify-between bg-[#F5F1E8] p-1.5 rounded-xl border border-[#DCEAF0] text-[11px] font-bold">
                      <button
                        onClick={() => setCheckoutStep('cart')}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          checkoutStep === 'cart' ? 'bg-[#14213D] text-white shadow-xs' : 'text-[#667085] hover:text-[#14213D]'
                        }`}
                      >
                        <ShoppingBag className="w-3.5 h-3.5" />
                        <span>1. Cart</span>
                      </button>

                      <ArrowRight className="w-3.5 h-3.5 text-[#667085]/60" />

                      <button
                        onClick={() => {
                          if (cart.length > 0) handleProceedToAddress();
                        }}
                        disabled={cart.length === 0}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          checkoutStep === 'address' ? 'bg-[#14213D] text-white shadow-xs' : 'text-[#667085] hover:text-[#14213D]'
                        }`}
                      >
                        <MapPin className="w-3.5 h-3.5" />
                        <span>2. Address</span>
                      </button>

                      <ArrowRight className="w-3.5 h-3.5 text-[#667085]/60" />

                      <button
                        onClick={() => {
                          if (selectedAddressId) handleProceedToSummary();
                        }}
                        disabled={!selectedAddressId}
                        className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-lg transition-all cursor-pointer ${
                          checkoutStep === 'summary' ? 'bg-[#14213D] text-white shadow-xs' : 'text-[#667085] hover:text-[#14213D]'
                        }`}
                      >
                        <ShieldCheck className="w-3.5 h-3.5" />
                        <span>3. Summary</span>
                      </button>
                    </div>
                  )}

                  {checkoutError && (
                    <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#B42318] flex items-center space-x-2">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{checkoutError}</span>
                    </div>
                  )}

                  {/* STEP 1: CART REVIEW */}
                  {checkoutStep === 'cart' && (
                    <div>
                      {cart.length === 0 ? (
                        <div className="py-20 text-center text-[#667085] space-y-3">
                          <ShoppingCart className="w-12 h-12 mx-auto text-[#DCEAF0] stroke-1 text-[#567C8D]" />
                          <p className="text-sm font-bold text-[#14213D]">Your cart is empty.</p>
                          <p className="text-xs text-[#667085]">Explore authentic local artisanal foods, fashion, and crafts!</p>
                        </div>
                      ) : (
                        <div className="py-2 space-y-3 max-h-[50vh] overflow-y-auto pr-1">
                          {cart.map((item) => {
                            const prodId = item.product.product_id || item.product.id || '';
                            const price = item.product.discount_price || item.product.selling_price || item.product.price || item.product.base_price || 0;
                            return (
                              <div
                                key={prodId}
                                className="p-3.5 bg-[#F5F1E8] rounded-2xl border border-[#DCEAF0] flex items-center justify-between text-xs hover:border-[#567C8D] transition shadow-2xs"
                              >
                                <div className="space-y-1 max-w-[55%]">
                                  <p className="font-bold text-[#14213D] line-clamp-1">{item.product.name}</p>
                                  <p className="text-[10px] text-[#567C8D] font-medium flex items-center space-x-1">
                                    <Store className="w-3 h-3 text-[#FCA311]" />
                                    <span>{item.product.store_name || 'Verified Marketplace Store'}</span>
                                  </p>
                                  <p className="text-[11px] font-mono text-[#667085]">
                                    ₹{price.toLocaleString('en-IN')} each
                                  </p>
                                </div>

                                <div className="flex items-center space-x-3">
                                  {/* Stepper */}
                                  <div className="flex items-center space-x-1.5 bg-white border border-[#DCEAF0] rounded-xl p-1 shadow-2xs">
                                    <button
                                      onClick={() => handleUpdateItemQuantity(prodId, item.quantity - 1)}
                                      className="p-1 text-[#667085] hover:text-[#14213D] rounded-lg transition cursor-pointer"
                                    >
                                      <Minus className="w-3 h-3" />
                                    </button>
                                    <span className="w-6 text-center font-bold text-[#14213D]">{item.quantity}</span>
                                    <button
                                      onClick={() => handleUpdateItemQuantity(prodId, item.quantity + 1)}
                                      className="p-1 text-[#667085] hover:text-[#14213D] rounded-lg transition cursor-pointer"
                                    >
                                      <Plus className="w-3 h-3" />
                                    </button>
                                  </div>

                                  <div className="text-right">
                                    <p className="font-extrabold text-[#14213D]">
                                      ₹{(price * item.quantity).toLocaleString('en-IN')}
                                    </p>
                                    <button
                                      onClick={() => handleRemoveItem(prodId)}
                                      className="text-[10px] text-[#B42318] hover:underline cursor-pointer inline-flex items-center space-x-0.5 mt-0.5"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                      <span>Remove</span>
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 2: DELIVERY ADDRESS SELECTION */}
                  {checkoutStep === 'address' && (
                    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                      {!currentUser ? (
                        <div className="p-6 bg-white border border-[#DCEAF0] rounded-2xl text-center space-y-3 shadow-xs">
                          <UserIcon className="w-8 h-8 mx-auto text-[#567C8D]" />
                          <h4 className="text-sm font-bold text-[#14213D]">Sign In Required for Delivery</h4>
                          <p className="text-xs text-[#667085]">
                            Please log in or register to choose from your saved delivery addresses.
                          </p>
                          {onOpenAuth && (
                            <button
                              onClick={onOpenAuth}
                              className="px-5 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center space-x-2 cursor-pointer"
                            >
                              <LogIn className="w-4 h-4 text-[#FCA311]" />
                              <span>Sign In / Register</span>
                            </button>
                          )}
                        </div>
                      ) : (
                        <>
                          <div className="flex justify-between items-center">
                            <h4 className="text-xs font-bold text-[#14213D]">Saved Addresses in India</h4>
                            <button
                              onClick={() => setIsAddingNewAddress(!isAddingNewAddress)}
                              className="text-xs font-bold text-[#567C8D] hover:text-[#14213D] cursor-pointer inline-flex items-center space-x-1"
                            >
                              <Plus className="w-3.5 h-3.5" />
                              <span>{isAddingNewAddress ? 'Cancel' : 'Add New Address'}</span>
                            </button>
                          </div>

                          {/* Inline Add Address Form */}
                          {isAddingNewAddress && (
                            <form onSubmit={handleSaveNewAddressInline} className="p-4 bg-[#F5F1E8] border border-[#DCEAF0] rounded-2xl space-y-3 text-xs animate-fade-in">
                              <h5 className="font-bold text-[#14213D]">Add Delivery Destination</h5>
                              {addressError && (
                                <p className="text-[#B42318] text-[11px] font-semibold">{addressError}</p>
                              )}
                              <div className="grid grid-cols-2 gap-2">
                                <input
                                  type="text"
                                  required
                                  placeholder="Recipient Name *"
                                  value={newAddressForm.recipient_name}
                                  onChange={(e) => setNewAddressForm({ ...newAddressForm, recipient_name: e.target.value })}
                                  className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                                />
                                <input
                                  type="tel"
                                  required
                                  placeholder="10-digit Phone *"
                                  value={newAddressForm.phone_number}
                                  onChange={(e) => setNewAddressForm({ ...newAddressForm, phone_number: e.target.value })}
                                  className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                                />
                              </div>
                              <input
                                type="text"
                                required
                                placeholder="Street Address / House No. *"
                                value={newAddressForm.address_line1}
                                onChange={(e) => setNewAddressForm({ ...newAddressForm, address_line1: e.target.value })}
                                className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                              />
                              <input
                                type="text"
                                placeholder="Landmark / Area (Optional)"
                                value={newAddressForm.address_line2}
                                onChange={(e) => setNewAddressForm({ ...newAddressForm, address_line2: e.target.value })}
                                className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                              />
                              <div className="grid grid-cols-3 gap-2">
                                <input
                                  type="text"
                                  required
                                  placeholder="City *"
                                  value={newAddressForm.city}
                                  onChange={(e) => setNewAddressForm({ ...newAddressForm, city: e.target.value })}
                                  className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                                />
                                <input
                                  type="text"
                                  required
                                  placeholder="State *"
                                  value={newAddressForm.state}
                                  onChange={(e) => setNewAddressForm({ ...newAddressForm, state: e.target.value })}
                                  className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs text-[#1F2937]"
                                />
                                <input
                                  type="text"
                                  required
                                  maxLength={6}
                                  placeholder="PIN Code *"
                                  value={newAddressForm.postal_code}
                                  onChange={(e) => setNewAddressForm({ ...newAddressForm, postal_code: e.target.value })}
                                  className="w-full bg-white border border-[#DCEAF0] rounded-xl p-2 text-xs font-mono text-[#1F2937]"
                                />
                              </div>
                              <button
                                type="submit"
                                className="w-full py-2 bg-[#14213D] hover:bg-[#0B132B] text-white font-bold rounded-xl transition cursor-pointer"
                              >
                                Save & Deliver Here
                              </button>
                            </form>
                          )}

                          {savedAddresses.length === 0 && !isAddingNewAddress ? (
                            <div className="p-6 bg-white border border-[#DCEAF0] rounded-2xl text-center space-y-2">
                              <MapPin className="w-6 h-6 text-[#567C8D] mx-auto" />
                              <p className="text-xs font-bold text-[#14213D]">No saved delivery addresses found.</p>
                              <p className="text-[11px] text-[#667085]">Please add your address above to continue.</p>
                            </div>
                          ) : (
                            <div className="space-y-2.5">
                              {savedAddresses.map((addr) => (
                                <label
                                  key={addr.address_id}
                                  className={`p-3.5 rounded-2xl border flex items-start space-x-3 cursor-pointer transition ${
                                    selectedAddressId === addr.address_id
                                      ? 'bg-[#FFF7EB] border-[#FCA311] ring-1 ring-[#FCA311]'
                                      : 'bg-white border-[#DCEAF0] hover:border-[#567C8D]'
                                  }`}
                                >
                                  <input
                                    type="radio"
                                    name="selected_delivery_addr"
                                    checked={selectedAddressId === addr.address_id}
                                    onChange={() => setSelectedAddressId(addr.address_id)}
                                    className="mt-1 accent-[#14213D]"
                                  />
                                  <div className="flex-1 space-y-1 text-xs">
                                    <div className="flex items-center space-x-2">
                                      <span className="font-bold text-[#14213D]">{addr.recipient_name}</span>
                                      {addr.is_default && (
                                        <span className="px-1.5 py-0.5 rounded text-[10px] font-bold bg-[#F5F1E8] text-[#B45309] border border-[#FCA311]">
                                          Default
                                        </span>
                                      )}
                                    </div>
                                    <p className="text-[11px] text-[#667085]">
                                      {addr.address_line1}
                                      {addr.address_line2 ? `, ${addr.address_line2}` : ''}, {addr.city}, {addr.state} — <span className="font-bold font-mono text-[#14213D]">{addr.postal_code}</span>
                                    </p>
                                    <p className="text-[10px] text-[#567C8D] font-mono">Phone: {addr.phone_number}</p>
                                  </div>
                                </label>
                              ))}
                            </div>
                          )}
                        </>
                      )}
                    </div>
                  )}

                  {/* STEP 3: ORDER SUMMARY & AUTHORITATIVE PRICING BREAKDOWN */}
                  {checkoutStep === 'summary' && (
                    <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                      {isSummaryLoading || !checkoutSummary ? (
                        <div className="py-16 text-center space-y-2 text-[#567C8D]">
                          <div className="w-8 h-8 border-2 border-[#14213D] border-t-transparent rounded-full animate-spin mx-auto" />
                          <p className="text-xs font-bold">Calculating Authoritative Pricing Breakdown...</p>
                        </div>
                      ) : (
                        <div className="space-y-4 text-xs">
                          {/* Selected Address Snapshot */}
                          {(() => {
                            const curAddr = savedAddresses.find((a) => a.address_id === selectedAddressId);
                            return curAddr ? (
                              <div className="p-3 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl flex items-start justify-between">
                                <div className="space-y-0.5">
                                  <span className="text-[10px] text-[#567C8D] font-bold uppercase tracking-wider">Delivering To:</span>
                                  <p className="font-bold text-[#14213D]">{curAddr.recipient_name} ({curAddr.phone_number})</p>
                                  <p className="text-[11px] text-[#667085]">
                                    {curAddr.address_line1}, {curAddr.city}, {curAddr.state} - {curAddr.postal_code}
                                  </p>
                                </div>
                                <button
                                  onClick={() => setCheckoutStep('address')}
                                  className="text-[11px] font-bold text-[#567C8D] hover:underline cursor-pointer"
                                >
                                  Change
                                </button>
                              </div>
                            ) : null;
                          })()}

                          {/* Line items review */}
                          <div className="space-y-2 border-t border-[#DCEAF0] pt-3">
                            <span className="text-[10px] text-[#567C8D] font-bold uppercase tracking-wider">Verified Items ({checkoutSummary.item_count}):</span>
                            {checkoutSummary.items.map((it) => (
                              <div key={it.cart_item_id} className="p-2.5 bg-[#F5F1E8] rounded-xl flex justify-between items-center text-xs">
                                <div>
                                  <p className="font-bold text-[#14213D] line-clamp-1">{it.product_name}</p>
                                  <p className="text-[10px] text-[#567C8D]">{it.store_name} • Qty: {it.quantity}</p>
                                </div>
                                <span className="font-extrabold text-[#14213D]">₹{it.line_total.toLocaleString('en-IN')}</span>
                              </div>
                            ))}
                          </div>

                          {/* Transparent Authoritative Pricing Breakdown */}
                          <div className="p-4 bg-[#FAF9F6] border border-[#DCEAF0] rounded-2xl space-y-2.5">
                            <span className="text-[10px] text-[#567C8D] font-bold uppercase tracking-wider">Authoritative Pricing Breakdown</span>
                            
                            <div className="flex justify-between text-xs">
                              <span className="text-[#667085]">Merchandise Subtotal:</span>
                              <span className="font-bold text-[#14213D]">₹{checkoutSummary.merchandise_subtotal.toLocaleString('en-IN')}</span>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#667085]">Shipping / Fulfillment:</span>
                                {checkoutSummary.shipping_fee === 0 ? (
                                  <span className="font-bold text-[#15803D]">₹0 (FREE SHIPPING)</span>
                                ) : (
                                  <span className="font-bold text-[#14213D]">₹{checkoutSummary.shipping_fee.toLocaleString('en-IN')}</span>
                                )}
                              </div>
                              <p className="text-[10px] text-[#567C8D]">{checkoutSummary.shipping_fee_basis}</p>
                            </div>

                            <div className="space-y-0.5">
                              <div className="flex justify-between text-xs">
                                <span className="text-[#667085]">Goods & Services Tax (GST 5%):</span>
                                <span className="font-bold text-[#14213D]">₹{checkoutSummary.tax_amount.toLocaleString('en-IN')}</span>
                              </div>
                              <p className="text-[10px] text-[#567C8D]">{checkoutSummary.tax_basis}</p>
                            </div>

                            <div className="flex justify-between text-sm font-extrabold text-[#14213D] pt-2 border-t border-[#DCEAF0]">
                              <span>Final Authoritative Total:</span>
                              <span className="text-[#15803D]">₹{checkoutSummary.final_total.toLocaleString('en-IN')}</span>
                            </div>
                          </div>

                          {/* Simulated Payment Notice */}
                          <div className="p-3 bg-blue-50 border border-blue-200 rounded-xl text-[11px] text-blue-900 flex items-center space-x-2">
                            <CreditCard className="w-4 h-4 text-blue-600 shrink-0" />
                            <span>
                              <strong>Payment Mode:</strong> Simulated Payment / Cash on Delivery. Transparent pending state recorded in MySQL database.
                            </span>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* STEP 4: ORDER CONFIRMED SCREEN */}
                  {checkoutStep === 'confirmed' && placedOrderInfo && (
                    <div className="py-8 text-center space-y-4 animate-fade-in">
                      <div className="w-16 h-16 rounded-full bg-emerald-100 text-[#15803D] border border-emerald-300 flex items-center justify-center mx-auto shadow-md">
                        <CheckCircle2 className="w-10 h-10" />
                      </div>
                      
                      <div className="space-y-1">
                        <h4 className="text-xl font-bold text-[#14213D] font-['Space_Grotesk']">Order Confirmed!</h4>
                        <p className="text-xs text-[#567C8D]">Your order has been recorded into the live database.</p>
                      </div>

                      <div className="p-4 bg-[#F5F1E8] border border-[#DCEAF0] rounded-2xl text-left space-y-2 text-xs">
                        <div className="flex justify-between items-center pb-2 border-b border-[#DCEAF0]">
                          <span className="text-[#667085]">Persisted Order ID:</span>
                          <span className="font-bold font-mono text-[#14213D]">{placedOrderInfo.order_id}</span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#667085]">Order Status:</span>
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                            {placedOrderInfo.order_status || 'Processing'}
                          </span>
                        </div>
                        <div className="flex justify-between items-center">
                          <span className="text-[#667085]">Delivery City:</span>
                          <span className="font-semibold text-[#14213D]">{placedOrderInfo.delivery_city}</span>
                        </div>
                        <div className="flex justify-between items-center pt-2 border-t border-[#DCEAF0] font-bold">
                          <span className="text-[#14213D]">Total Authoritative Paid:</span>
                          <span className="text-[#15803D] font-extrabold text-sm">₹{(placedOrderInfo.final_amount || 0).toLocaleString('en-IN')}</span>
                        </div>
                      </div>

                      <div className="pt-2 flex flex-col sm:flex-row gap-2">
                        <button
                          onClick={() => {
                            handleCloseCartDrawer();
                            setSubTab('account');
                          }}
                          className="flex-1 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                        >
                          View in My Account Orders
                        </button>
                        <button
                          onClick={handleCloseCartDrawer}
                          className="flex-1 py-2.5 border border-[#DCEAF0] hover:bg-[#F5F1E8] text-[#14213D] rounded-xl text-xs font-bold transition cursor-pointer"
                        >
                          Continue Shopping
                        </button>
                      </div>
                    </div>
                  )}

                </div>

                {/* BOTTOM ACTION BAR */}
                {checkoutStep !== 'confirmed' && cart.length > 0 && (
                  <div className="pt-4 border-t border-[#DCEAF0] space-y-2">
                    {checkoutStep === 'cart' && (
                      <div className="space-y-3">
                        <div className="flex justify-between text-xs font-bold">
                          <span className="text-[#667085]">Estimated Subtotal:</span>
                          <span className="text-[#14213D]">₹{cartTotal.toLocaleString('en-IN')}</span>
                        </div>
                        <button
                          onClick={handleProceedToAddress}
                          className="w-full py-3 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <span>Proceed to Delivery Address</span>
                          <ArrowRight className="w-4 h-4 text-[#FCA311]" />
                        </button>
                      </div>
                    )}

                    {checkoutStep === 'address' && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCheckoutStep('cart')}
                          className="px-4 py-3 border border-[#DCEAF0] hover:bg-[#F5F1E8] text-[#14213D] rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          onClick={handleProceedToSummary}
                          disabled={!selectedAddressId}
                          className="flex-1 py-3 bg-[#14213D] hover:bg-[#0B132B] disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <span>Review Authoritative Pricing</span>
                          <ArrowRight className="w-4 h-4 text-[#FCA311]" />
                        </button>
                      </div>
                    )}

                    {checkoutStep === 'summary' && checkoutSummary && (
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => setCheckoutStep('address')}
                          className="px-4 py-3 border border-[#DCEAF0] hover:bg-[#F5F1E8] text-[#14213D] rounded-xl text-xs font-bold transition cursor-pointer flex items-center space-x-1"
                        >
                          <ArrowLeft className="w-3.5 h-3.5" />
                          <span>Back</span>
                        </button>
                        <button
                          onClick={handleConfirmAndPlaceOrder}
                          disabled={isPlacingOrder || !checkoutSummary.is_checkout_eligible}
                          className="flex-1 py-3 bg-[#15803D] hover:bg-emerald-800 disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-md transition-all cursor-pointer flex items-center justify-center space-x-2"
                        >
                          <CheckCircle className="w-4 h-4" />
                          <span>{isPlacingOrder ? 'Processing Order...' : `Confirm Order (₹${checkoutSummary.final_total.toLocaleString('en-IN')})`}</span>
                        </button>
                      </div>
                    )}
                  </div>
                )}

              </div>
            </div>
          )}
        </>
      )}

    </div>
  );
};
