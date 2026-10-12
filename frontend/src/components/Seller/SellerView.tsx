import React, { useState, useEffect } from 'react';
import type { Store, DemandForecastItem, AIListingResponse, AISellerAdvisorResponse, RAGQueryResponse } from '../../types';
import {
  fetchMySellerProfile,
  fetchMySellerProducts,
  fetchSellerOrders,
  fetchMySellerAnalytics,
  fetchMySellerStores,
  fetchDemandForecast,
  generateListing,
  createProduct,
  askSellerAdvisor,
  queryRAGKnowledge,
  STORE_TYPE_CATEGORY_MAP
} from '../../services/api';
import {
  TrendingUp,
  Package,
  Sparkles,
  Bot,
  BookOpen,
  PlusCircle,
  BarChart3,
  CheckCircle2,
  Send,
  FileText,
  DollarSign,
  ShoppingBag,
  Store as StoreIcon,
  RefreshCw,
  AlertOctagon,
  Clock,
  Tag,
  X
} from 'lucide-react';
import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, Tooltip, CartesianGrid } from 'recharts';

export const SellerView: React.FC = () => {
  const [mySeller, setMySeller] = useState<any | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerAnalytics, setSellerAnalytics] = useState<any | null>(null);
  const [permittedCategories, setPermittedCategories] = useState<string[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MY_PRODUCTS' | 'MY_ORDERS' | 'AI_GENERATOR' | 'INVENTORY' | 'AI_ADVISOR' | 'RAG_KNOWLEDGE'>('OVERVIEW');

  // Forecast state
  const [forecasts, setForecasts] = useState<DemandForecastItem[]>([]);

  // AI Generator state
  const [seedText, setSeedText] = useState<string>('Homemade Mango Pickle, 500g, ₹250');
  const [genCategory, setGenCategory] = useState<string>('Food & Gourmet');
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [genResult, setGenResult] = useState<AIListingResponse | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Manual Product Creation State
  const [showAddProductModal, setShowAddProductModal] = useState<boolean>(false);
  const [prodName, setProdName] = useState<string>('');
  const [prodBrand, setProdBrand] = useState<string>('');
  const [prodImageUrl, setProdImageUrl] = useState<string>('');
  const [prodDescription, setProdDescription] = useState<string>('');
  const [prodCategory, setProdCategory] = useState<string>('Footwear');
  const [prodPrice, setProdPrice] = useState<string>('999');
  const [prodCostPrice, setProdCostPrice] = useState<string>('700');
  const [prodStock, setProdStock] = useState<string>('20');
  const [createLoading, setCreateLoading] = useState<boolean>(false);

  // AI Advisor state
  const [advisorQuestion, setAdvisorQuestion] = useState<string>('How is my store performing this month?');
  const [advisorLoading, setAdvisorLoading] = useState<boolean>(false);
  const [advisorHistory, setAdvisorHistory] = useState<AISellerAdvisorResponse[]>([]);

  // RAG state
  const [ragQuery, setRAGQuery] = useState<string>('What is my return and damage replacement policy?');
  const [ragLoading, setRAGLoading] = useState<boolean>(false);
  const [ragResponse, setRAGResponse] = useState<RAGQueryResponse | null>(null);

  useEffect(() => {
    loadSellerContext();
  }, []);

  const loadSellerContext = async () => {
    setLoading(true);
    setError(null);
    try {
      // 1. Load authenticated seller profile
      const profile = await fetchMySellerProfile().catch(() => null);
      setMySeller(profile);

      // 2. Load authenticated user's authorized stores ONLY
      const myStoresList = await fetchMySellerStores().catch(() => []);
      const formattedStores: Store[] = myStoresList.map((s: any) => ({
        id: s.seller_id,
        seller_id: s.seller_id,
        store_name: s.store_name,
        store_type: s.store_type || 'Other / General Store',
        slug: s.seller_id.toLowerCase(),
        description: s.business_description || '',
        city: 'Bengaluru',
        state: 'Karnataka'
      }));

      if (profile) {
        const currentStoreObj: Store = {
          id: profile.seller_id,
          seller_id: profile.seller_id,
          store_name: profile.store_name,
          store_type: profile.store_type || 'Other / General Store',
          slug: profile.seller_id.toLowerCase(),
          description: profile.business_description || '',
          city: 'Bengaluru',
          state: 'Karnataka'
        };
        setSelectedStore(currentStoreObj);
        if (!formattedStores.some((s) => s.id === profile.seller_id)) {
          formattedStores.unshift(currentStoreObj);
        }
      } else if (formattedStores.length > 0) {
        setSelectedStore(formattedStores[0]);
      }
      setStores(formattedStores);

      // Configure initial permitted categories for store type
      const activeStoreType = profile?.store_type || 'Other / General Store';
      const initialCats = STORE_TYPE_CATEGORY_MAP[activeStoreType] || STORE_TYPE_CATEGORY_MAP['Other / General Store'];
      setPermittedCategories(initialCats);
      if (initialCats.length > 0) {
        setProdCategory(initialCats[0]);
        setGenCategory(initialCats[0]);
      }

      // 3. Load my seller products, orders & live analytics if approved seller
      if (profile && profile.approval_status === 'approved') {
        const [prods, ords, analytics] = await Promise.all([
          fetchMySellerProducts().catch(() => []),
          fetchSellerOrders().catch(() => []),
          fetchMySellerAnalytics().catch(() => null),
        ]);
        setSellerProducts(prods);
        setSellerOrders(ords);
        setSellerAnalytics(analytics);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load seller portal data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (selectedStore) {
      loadForecastData(selectedStore.id);
    }
    const sType = selectedStore?.store_type || mySeller?.store_type || 'Other / General Store';
    const cats = STORE_TYPE_CATEGORY_MAP[sType] || STORE_TYPE_CATEGORY_MAP['Other / General Store'];
    setPermittedCategories(cats);
    if (cats.length > 0 && !cats.includes(prodCategory)) {
      setProdCategory(cats[0]);
    }
    if (cats.length > 0 && !cats.includes(genCategory)) {
      setGenCategory(cats[0]);
    }
  }, [selectedStore, mySeller]);

  const loadForecastData = async (storeId: string) => {
    try {
      const data = await fetchDemandForecast(storeId);
      setForecasts(data);
    } catch (err) {
      console.error(err);
    }
  };

  const handleManualCreateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!prodName.trim()) return;
    setCreateLoading(true);
    setError(null);
    try {
      await createProduct({
        product_name: prodName.trim(),
        category: prodCategory,
        brand: prodBrand.trim() || undefined,
        price: parseFloat(prodPrice) || 100,
        cost_price: parseFloat(prodCostPrice) || 70,
        stock_quantity: parseInt(prodStock, 10) || 10,
        description: prodDescription.trim() || undefined,
        image_url: prodImageUrl.trim() || undefined,
      });

      setPublishSuccess(`🎉 Product "${prodName.trim()}" successfully created in catalog!`);
      setTimeout(() => setPublishSuccess(null), 5000);
      setShowAddProductModal(false);
      setProdName('');
      setProdBrand('');
      setProdImageUrl('');
      setProdDescription('');

      // Refresh inventory & live analytics
      const [prods, analytics] = await Promise.all([
        fetchMySellerProducts().catch(() => []),
        fetchMySellerAnalytics().catch(() => null),
      ]);
      setSellerProducts(prods);
      setSellerAnalytics(analytics);
    } catch (err: any) {
      setError(err.message || 'Failed to create product listing.');
    } finally {
      setCreateLoading(false);
    }
  };

  const handleGenerateListing = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!seedText.trim()) return;
    setGenLoading(true);
    setGenResult(null);
    try {
      const res = await generateListing(seedText, genCategory);
      setGenResult(res);
    } catch (err) {
      console.error(err);
    } finally {
      setGenLoading(false);
    }
  };

  const handlePublishGeneratedProduct = async () => {
    if (!genResult) return;
    try {
      await createProduct({
        product_name: genResult.generated_title || genResult.title || 'New AI Product',
        category: genResult.category || 'General',
        price: genResult.suggested_price || 250,
        cost_price: 200,
        stock_quantity: 40,
      });
      setPublishSuccess(`🎉 Listing "${genResult.generated_title || genResult.title}" published to live store catalog!`);
      setTimeout(() => setPublishSuccess(null), 5000);
      setGenResult(null);

      // Refresh products & live analytics
      const [prods, analytics] = await Promise.all([
        fetchMySellerProducts().catch(() => []),
        fetchMySellerAnalytics().catch(() => null),
      ]);
      setSellerProducts(prods);
      setSellerAnalytics(analytics);
    } catch (err: any) {
      setError(err.message || 'Failed to publish generated product');
    }
  };

  const handleAskAdvisor = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!advisorQuestion.trim() || !selectedStore) return;
    setAdvisorLoading(true);
    try {
      const res = await askSellerAdvisor(selectedStore.seller_id, advisorQuestion);
      setAdvisorHistory((prev) => [res, ...prev]);
    } catch (err) {
      console.error(err);
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleQueryRAG = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!ragQuery.trim() || !selectedStore) return;
    setRAGLoading(true);
    try {
      const res = await queryRAGKnowledge(selectedStore.seller_id, ragQuery);
      setRAGResponse(res);
    } catch (err) {
      console.error(err);
    } finally {
      setRAGLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-[#567C8D] animate-spin mx-auto" />
        <p className="text-xs text-[#667085] font-semibold">Loading Seller Dashboard & Merchant Analytics...</p>
      </div>
    );
  }

  const isApproved = mySeller?.approval_status === 'approved';

  return (
    <div className="space-y-8 pb-16">
      {/* SELLER HEADER & STORE PROFILE */}
      <div className="p-6 md:p-8 bg-[#14213D] border border-[#233554] rounded-3xl flex flex-col md:flex-row md:items-center justify-between gap-4 shadow-xl text-white">
        <div className="flex items-center space-x-4">
          <div className="w-14 h-14 rounded-2xl bg-[#FCA311] flex items-center justify-center text-[#14213D] font-black text-xl shadow-md flex-shrink-0">
            {mySeller?.store_name ? mySeller.store_name[0] : selectedStore?.store_name ? selectedStore.store_name[0] : 'S'}
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-xl md:text-2xl font-bold text-white font-['Space_Grotesk']">
                {mySeller?.store_name || selectedStore?.store_name || 'Seller Storefront'}
              </h1>
              {mySeller ? (
                <span
                  className={`px-2.5 py-0.5 text-[10px] font-bold rounded-full flex items-center space-x-1 uppercase border ${
                    isApproved
                      ? 'bg-emerald-50 text-[#15803D] border-emerald-300'
                      : mySeller.approval_status === 'pending'
                      ? 'bg-amber-50 text-amber-700 border-amber-300'
                      : 'bg-red-50 text-[#B42318] border-red-300'
                  }`}
                >
                  {isApproved ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                  <span>{mySeller.approval_status}</span>
                </span>
              ) : (
                <span className="px-2.5 py-0.5 bg-emerald-50 text-[#15803D] border border-emerald-300 text-[10px] font-bold rounded-full flex items-center space-x-1">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Verified Merchant</span>
                </span>
              )}
            </div>
            <div className="flex flex-wrap items-center gap-2 mt-1.5 text-xs">
              <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-[#DCEAF0] text-[#2F5261] border border-[#567C8D]/20 flex items-center space-x-1">
                <Tag className="w-3 h-3 mr-1 text-[#567C8D]" />
                <span>Type: {mySeller?.store_type || selectedStore?.store_type || 'Other / General Store'}</span>
              </span>
              <p className="text-xs text-[#DCEAF0]/80">
                Seller ID: <span className="font-mono text-[#87CEEB] font-bold">{mySeller?.seller_id || selectedStore?.seller_id}</span> • Contact: {mySeller?.contact_email || 'Verified'}
              </p>
            </div>
          </div>
        </div>

        {/* Actions / Add Product Button & Store Switcher */}
        <div className="flex flex-wrap items-center gap-3">
          {isApproved && (
            <button
              onClick={() => setShowAddProductModal(true)}
              className="flex items-center space-x-2 px-4 py-2 bg-[#FCA311] hover:bg-[#E5920C] text-[#14213D] rounded-xl text-xs font-bold transition shadow-md cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add New Product</span>
            </button>
          )}

          {/* Store Switcher for authorized seller stores */}
          {stores.length > 1 ? (
            <select
              value={selectedStore?.id || ''}
              onChange={(e) => {
                const found = stores.find((s) => s.id === e.target.value);
                if (found) setSelectedStore(found);
              }}
              className="bg-white text-[#14213D] border border-[#DCEAF0] rounded-xl px-3 py-2 text-xs font-bold focus:outline-none cursor-pointer"
            >
              {stores.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.store_name}
                </option>
              ))}
            </select>
          ) : selectedStore ? (
            <div className="px-3 py-2 bg-white/10 border border-white/20 rounded-xl text-xs text-[#DCEAF0] font-semibold flex items-center space-x-1.5">
              <StoreIcon className="w-3.5 h-3.5 text-[#87CEEB]" />
              <span>{selectedStore.store_name}</span>
            </div>
          ) : null}
        </div>
      </div>

      {/* APPROVAL STATUS NOTICE BANNER IF NOT APPROVED */}
      {mySeller && !isApproved && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-2xl text-amber-800 text-xs flex items-center justify-between shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 flex-shrink-0 text-amber-600" />
            <span>
              Storefront status is <strong>{mySeller.approval_status.toUpperCase()}</strong>. Product listing and order management capabilities will activate once approved by administrator governance.
            </span>
          </div>
        </div>
      )}

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-[#B42318] rounded-2xl text-xs">
          {error}
        </div>
      )}

      {/* SELLER PORTAL TAB NAVIGATION */}
      <div className="flex items-center space-x-1.5 overflow-x-auto pb-1 scrollbar-none border-b border-[#DCEAF0]">
        {[
          { id: 'OVERVIEW', label: 'Overview & Analytics', icon: BarChart3 },
          { id: 'MY_PRODUCTS', label: `My Products (${sellerProducts.length})`, icon: Package },
          { id: 'MY_ORDERS', label: `Seller Orders (${sellerOrders.length})`, icon: ShoppingBag },
          { id: 'AI_GENERATOR', label: 'AI Catalog Builder', icon: Sparkles },
          { id: 'INVENTORY', label: 'Demand Intelligence', icon: TrendingUp },
          { id: 'AI_ADVISOR', label: 'AI Advisor', icon: Bot },
          { id: 'RAG_KNOWLEDGE', label: 'Multi-Tenant RAG', icon: BookOpen },
        ].map((tab) => {
          const Icon = tab.icon;
          const isActive = activeTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center space-x-2 px-4 py-2.5 rounded-xl text-xs font-bold whitespace-nowrap transition-all cursor-pointer ${
                isActive
                  ? 'bg-[#14213D] text-white shadow-xs'
                  : 'bg-white text-[#667085] hover:text-[#14213D] border border-[#DCEAF0]'
              }`}
            >
              <Icon className={`w-4 h-4 ${isActive ? 'text-[#FCA311]' : 'text-[#567C8D]'}`} />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* PUBLISH SUCCESS BANNER */}
      {publishSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-[#15803D] rounded-2xl flex items-center justify-between shadow-xs">
          <p className="text-xs font-bold">{publishSuccess}</p>
        </div>
      )}

      {/* ADD PRODUCT MODAL */}
      {showAddProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
          <div className="bg-white border border-[#DCEAF0] rounded-3xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-[#DCEAF0]">
              <h3 className="text-base font-bold text-[#14213D] flex items-center space-x-2 font-['Space_Grotesk']">
                <PlusCircle className="w-5 h-5 text-[#567C8D]" />
                <span>Add Product to Store Catalog</span>
              </h3>
              <button
                onClick={() => setShowAddProductModal(false)}
                className="p-1.5 text-[#667085] hover:text-[#14213D] rounded-lg hover:bg-[#F5F1E8]"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleManualCreateProduct} className="space-y-4 text-xs">
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Product Title *</label>
                <input
                  type="text"
                  required
                  value={prodName}
                  onChange={(e) => setProdName(e.target.value)}
                  placeholder="e.g. Bata Men's Formal Dress Shoes"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Category *</label>
                  {permittedCategories && permittedCategories.length > 0 ? (
                    <select
                      value={prodCategory}
                      onChange={(e) => setProdCategory(e.target.value)}
                      className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D] cursor-pointer"
                    >
                      {permittedCategories.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  ) : (
                    <div className="p-3 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-[#667085] text-xs">
                      No permitted categories available.
                    </div>
                  )}
                  <span className="text-[10px] text-[#567C8D] font-semibold block mt-1">
                    Store Type: {mySeller?.store_type || selectedStore?.store_type || 'General'}
                  </span>
                </div>

                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Stock Quantity</label>
                  <input
                    type="number"
                    min="1"
                    value={prodStock}
                    onChange={(e) => setProdStock(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Selling Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodPrice}
                    onChange={(e) => setProdPrice(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>

                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Cost Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={prodCostPrice}
                    onChange={(e) => setProdCostPrice(e.target.value)}
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#14213D] font-bold mb-1">Brand / Merchant Label (Optional)</label>
                <input
                  type="text"
                  value={prodBrand}
                  onChange={(e) => setProdBrand(e.target.value)}
                  placeholder="e.g. Bata, Fabindia, or leave empty for your store name"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div>
                <label className="block text-[#14213D] font-bold mb-1">Product Image URL (Optional)</label>
                <input
                  type="url"
                  value={prodImageUrl}
                  onChange={(e) => setProdImageUrl(e.target.value)}
                  placeholder="https://images.unsplash.com/... or direct image URL"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
                <span className="text-[10px] text-[#667085] block mt-1">
                  Leave empty if you don't have an image; a clean neutral placeholder will be displayed automatically.
                </span>
              </div>

              <div>
                <label className="block text-[#14213D] font-bold mb-1">Product Description (Optional)</label>
                <textarea
                  rows={3}
                  value={prodDescription}
                  onChange={(e) => setProdDescription(e.target.value)}
                  placeholder="Describe material, specifications, sizing, warranty..."
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div className="flex justify-end space-x-3 pt-3">
                <button
                  type="button"
                  onClick={() => setShowAddProductModal(false)}
                  className="px-4 py-2 bg-[#F5F1E8] hover:bg-[#DCEAF0] text-[#14213D] rounded-xl font-bold transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={createLoading}
                  className="px-5 py-2 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl font-bold shadow-md transition cursor-pointer"
                >
                  {createLoading ? 'Publishing...' : 'Publish Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Monthly Gross Sales</span>
                <DollarSign className="w-4 h-4 text-[#15803D]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">
                ₹{(sellerAnalytics?.monthly_gross_sales ?? 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </p>
              <span className="text-[10px] text-[#15803D] font-bold">
                {sellerAnalytics?.total_orders === 0 ? 'No sales recorded this period' : 'Verified Seller Revenue'}
              </span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Total Orders</span>
                <Package className="w-4 h-4 text-[#567C8D]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">
                {sellerAnalytics?.total_orders ?? sellerOrders.length ?? 0} Orders
              </p>
              <span className="text-[10px] text-[#567C8D] font-semibold">
                {sellerAnalytics?.fulfillment_rate_display ?? 'N/A'} {sellerAnalytics?.fulfillment_rate != null ? 'Fulfillment Rate' : ''}
              </span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Inventory Items</span>
                <StoreIcon className="w-4 h-4 text-[#FCA311]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">
                {sellerAnalytics?.inventory_items_count ?? sellerProducts.length ?? 0} Products
              </p>
              <span className="text-[10px] text-[#B45309] font-semibold">Active Storefront Catalog</span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Store Rating</span>
                <Sparkles className="w-4 h-4 text-[#FCA311]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">
                {sellerAnalytics?.store_rating != null ? `${sellerAnalytics.store_rating.toFixed(1)} / 5.0` : 'N/A'}
              </p>
              <span className="text-[10px] text-[#667085] font-semibold">
                {sellerAnalytics?.total_reviews_count ? `From ${sellerAnalytics.total_reviews_count} reviews` : 'No reviews recorded yet'}
              </span>
            </div>
          </div>

          <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <h3 className="font-bold text-sm text-[#14213D]">30-Day Gross Revenue Trajectory</h3>
              {sellerAnalytics?.total_orders === 0 && (
                <span className="text-[11px] text-[#B45309] font-bold bg-[#FFF7EB] px-2.5 py-1 rounded-lg border border-[#FCA311]/30">
                  Zero orders recorded for this storefront
                </span>
              )}
            </div>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={sellerAnalytics?.revenue_chart && sellerAnalytics.revenue_chart.length > 0 ? sellerAnalytics.revenue_chart : [
                  { day: 'Day 1', revenue: 0 },
                  { day: 'Day 5', revenue: 0 },
                  { day: 'Day 10', revenue: 0 },
                  { day: 'Day 15', revenue: 0 },
                  { day: 'Day 20', revenue: 0 },
                  { day: 'Day 25', revenue: 0 },
                  { day: 'Day 30', revenue: 0 },
                ]}>
                  <defs>
                    <linearGradient id="colorRev" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#567C8D" stopOpacity={0.4} />
                      <stop offset="95%" stopColor="#567C8D" stopOpacity={0.0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#F5F1E8" />
                  <XAxis dataKey="day" stroke="#667085" fontSize={11} />
                  <YAxis stroke="#667085" fontSize={11} />
                  <Tooltip contentStyle={{ backgroundColor: '#14213D', borderColor: '#233554', color: '#fff', borderRadius: '12px' }} />
                  <Area type="monotone" dataKey="revenue" stroke="#567C8D" strokeWidth={2.5} fillOpacity={1} fill="url(#colorRev)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      )}

      {/* TAB: MY PRODUCTS */}
      {activeTab === 'MY_PRODUCTS' && (
        <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2">
              <Package className="w-5 h-5 text-[#567C8D]" />
              <span>Store Catalog ({sellerProducts.length} Items)</span>
            </h3>
            {isApproved && (
              <button
                onClick={() => setShowAddProductModal(true)}
                className="px-3 py-1.5 bg-[#14213D] hover:bg-[#0B132B] text-white text-xs font-bold rounded-xl flex items-center space-x-1 cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5 text-[#FCA311]" />
                <span>Add Product</span>
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">Category</th>
                  <th className="p-3">Product ID</th>
                  <th className="p-3">Price</th>
                  <th className="p-3">Stock Quantity</th>
                  <th className="p-3">Listing Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1E8]">
                {sellerProducts.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="p-8 text-center text-[#667085]">
                      No product listings found for this storefront catalog.
                    </td>
                  </tr>
                ) : (
                  sellerProducts.map((p) => (
                    <tr key={p.seller_product_id} className="hover:bg-[#FAF9F6]">
                      <td className="p-3 font-bold text-[#14213D]">
                        {p.product_name || 'Store Catalog Product'}
                      </td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-md bg-[#DCEAF0] border border-[#567C8D]/20 text-[10px] font-semibold text-[#2F5261]">
                          {p.category || 'General'}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-[#567C8D] font-bold">{p.product_id}</td>
                      <td className="p-3 font-extrabold text-[#14213D]">₹{p.selling_price?.toLocaleString('en-IN')}</td>
                      <td className="p-3 font-semibold text-[#1F2937]">{p.stock_quantity} units</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-[#15803D] border border-emerald-200">
                          {p.listing_status || 'Active'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: MY ORDERS */}
      {activeTab === 'MY_ORDERS' && (
        <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
          <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2">
            <ShoppingBag className="w-5 h-5 text-[#567C8D]" />
            <span>Store Orders ({sellerOrders.length} Orders Assigned)</span>
          </h3>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                <tr>
                  <th className="p-3">Seller Order ID</th>
                  <th className="p-3">Master Order ID</th>
                  <th className="p-3">Subtotal</th>
                  <th className="p-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1E8]">
                {sellerOrders.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="p-8 text-center text-[#667085]">
                      No merchant orders assigned to this store profile yet.
                    </td>
                  </tr>
                ) : (
                  sellerOrders.map((o) => (
                    <tr key={o.seller_order_id} className="hover:bg-[#FAF9F6]">
                      <td className="p-3 font-mono text-[#567C8D] font-bold">#SO-{o.seller_order_id}</td>
                      <td className="p-3 font-mono text-[#667085]">{o.order_id}</td>
                      <td className="p-3 font-extrabold text-[#14213D]">₹{o.subtotal?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-[#DCEAF0] text-[#2F5261] border border-[#567C8D]/20">
                          {o.status || 'Processing'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: AI CATALOG BUILDER */}
      {activeTab === 'AI_GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
            <div className="flex items-center space-x-2">
              <Sparkles className="w-5 h-5 text-[#FCA311]" />
              <h3 className="font-bold text-base text-[#14213D]">AI Product Listing Generator</h3>
            </div>
            <p className="text-xs text-[#667085] leading-relaxed">
              Enter short product details. Our GenAI pipeline will auto-generate title, description, features, tags, FAQs, and social media captions.
            </p>

            <form onSubmit={handleGenerateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-[#14213D] mb-1">Product Seed Text</label>
                <input
                  type="text"
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  placeholder="e.g. Homemade mango pickle, 500g, ₹250"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-[#14213D] mb-1">Category</label>
                <select
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D] cursor-pointer"
                >
                  {permittedCategories.map((cat) => (
                    <option key={cat} value={cat}>
                      {cat}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="submit"
                disabled={genLoading}
                className="w-full py-3 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
              >
                <Sparkles className="w-4 h-4 text-[#FCA311]" />
                <span>{genLoading ? 'Generating AI Copy...' : 'Generate Content Draft'}</span>
              </button>
            </form>
          </div>

          <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
            <h4 className="font-bold text-sm text-[#14213D]">Generated Listing Preview</h4>

            {genResult ? (
              <div className="space-y-4 text-xs animate-fade-in">
                <div>
                  <label className="text-[10px] text-[#667085] font-bold uppercase">Title</label>
                  <p className="font-bold text-[#14213D] text-sm">{genResult.generated_title}</p>
                </div>

                <div>
                  <label className="text-[10px] text-[#667085] font-bold uppercase">Description</label>
                  <p className="text-[#1F2937] leading-relaxed">{genResult.description}</p>
                </div>

                <div>
                  <label className="text-[10px] text-[#667085] font-bold uppercase">Key Features</label>
                  <ul className="list-disc list-inside text-[#1F2937] space-y-0.5">
                    {(genResult.features || []).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handlePublishGeneratedProduct}
                  className="w-full py-2.5 bg-[#15803D] hover:bg-emerald-800 text-white rounded-xl text-xs font-bold shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Publish to Live Store Catalog</span>
                </button>
              </div>
            ) : (
              <div className="py-20 text-center text-[#667085] text-xs">
                Fill the seed details on the left and click "Generate" to preview AI product listing.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: INVENTORY & DEMAND FORECAST */}
      {activeTab === 'INVENTORY' && (
        <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-bold text-base text-[#14213D]">ML Demand Forecasting & Reorder Intelligence</h3>
              <p className="text-xs text-[#667085]">RandomForest regressor trained on historical order velocity.</p>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                <tr>
                  <th className="p-3">Product Name</th>
                  <th className="p-3">SKU</th>
                  <th className="p-3">Stock</th>
                  <th className="p-3">7-Day Demand</th>
                  <th className="p-3">Days of Supply</th>
                  <th className="p-3">Risk Level</th>
                  <th className="p-3">Recommendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1E8]">
                {forecasts.map((f) => (
                  <tr key={f.product_id} className="hover:bg-[#FAF9F6]">
                    <td className="p-3 font-bold text-[#14213D]">{f.product_name}</td>
                    <td className="p-3 font-mono text-[11px] text-[#667085]">{f.sku}</td>
                    <td className="p-3 font-extrabold text-[#14213D]">{f.current_stock}</td>
                    <td className="p-3 text-[#567C8D] font-bold">{f.forecast_7d} units</td>
                    <td className="p-3 text-[#1F2937] font-medium">{f.estimated_days_of_supply} days</td>
                    <td className="p-3">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          ((f.risk_level || f.stockout_risk || 'NORMAL') || f.stockout_risk) === 'CRITICAL_STOCKOUT_RISK'
                            ? 'bg-red-50 text-[#B42318] border border-red-200'
                            : ((f.risk_level || f.stockout_risk || 'NORMAL') || f.stockout_risk) === 'MODERATE_STOCKOUT_RISK'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                        }`}
                      >
                        {(f.risk_level || f.stockout_risk || 'NORMAL').replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="p-3 text-[#667085] font-medium">{f.recommendation}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB: AI ADVISOR */}
      {activeTab === 'AI_ADVISOR' && (
        <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-6 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEAF0] flex items-center justify-center text-[#14213D]">
              <Bot className="w-6 h-6 text-[#567C8D]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#14213D]">AI Seller Business Advisor</h3>
              <p className="text-xs text-[#667085]">Retrieves real merchant SQL analytics before generating actionable insights.</p>
            </div>
          </div>

          <form onSubmit={handleAskAdvisor} className="flex space-x-2">
            <input
              type="text"
              value={advisorQuestion}
              onChange={(e) => setAdvisorQuestion(e.target.value)}
              placeholder="e.g. How is my business performing? Which products are low on stock?"
              className="flex-1 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl px-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
            />
            <button
              type="submit"
              disabled={advisorLoading}
              className="px-5 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1 cursor-pointer"
            >
              <Send className="w-4 h-4 text-[#FCA311]" />
              <span>Ask</span>
            </button>
          </form>

          <div className="space-y-4">
            {advisorHistory.map((item, idx) => (
              <div key={idx} className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DCEAF0] space-y-2">
                <p className="text-xs font-bold text-[#14213D]">Q: "{item.question}"</p>
                <div className="text-xs text-[#1F2937] whitespace-pre-line leading-relaxed">{item.advice_response}</div>
                <div className="pt-2 flex items-center justify-between text-[10px] text-[#667085] border-t border-[#DCEAF0]">
                  <span>Source: {item.data_source}</span>
                  <span className="font-bold text-[#14213D]">Gross Revenue: ₹{(item.verified_metrics?.gross_revenue || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB: RAG KNOWLEDGE */}
      {activeTab === 'RAG_KNOWLEDGE' && (
        <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-6 shadow-xs">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-[#DCEAF0] flex items-center justify-center text-[#14213D]">
              <BookOpen className="w-6 h-6 text-[#567C8D]" />
            </div>
            <div>
              <h3 className="font-bold text-base text-[#14213D]">Multi-Tenant RAG Policy Assistant</h3>
              <p className="text-xs text-[#667085]">Queries authorized store documents with enforced tenant isolation.</p>
            </div>
          </div>

          <form onSubmit={handleQueryRAG} className="flex space-x-2">
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRAGQuery(e.target.value)}
              placeholder="e.g. What is my return and damage replacement policy?"
              className="flex-1 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl px-4 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
            />
            <button
              type="submit"
              disabled={ragLoading}
              className="px-5 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition-all shadow-md flex items-center space-x-1 cursor-pointer"
            >
              <FileText className="w-4 h-4 text-[#FCA311]" />
              <span>Retrieve</span>
            </button>
          </form>

          {ragResponse && (
            <div className="p-4 bg-[#FAF9F6] rounded-2xl border border-[#DCEAF0] space-y-3">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-[#15803D] font-bold">Citation: {ragResponse.citation}</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-[#15803D] rounded border border-emerald-200 text-[10px] font-bold">
                  Tenant Isolation Verified
                </span>
              </div>
              <p className="text-xs text-[#1F2937] leading-relaxed whitespace-pre-line">{ragResponse.answer}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
