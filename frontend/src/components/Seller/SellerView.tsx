import React, { useState, useEffect } from 'react';
import type {
  Store,
  DemandForecastItem,
  AIListingResponse,
  AISellerAdvisorResponse,
  RAGQueryResponse,
  SellerAnalytics,
  SellerTopProduct,
  SellerOrderStatusCount,
  SellerCustomerReview,
  SellerFinancialAnalytics,
  SellerTransactionItem,
  SellerSalesTrendPoint,
  SellerCategoryPerformanceItem,
  SellerPaymentMethodDistributionItem,
  SellerProductDetail,
  SellerInventorySummary,
  InventoryHistoryItem
} from '../../types';
import {
  fetchMySellerProfile,
  fetchMySellerProducts,
  fetchSellerOrders,
  fetchMySellerAnalytics,
  fetchMySellerStores,
  fetchSellerOrderStatusDistribution,
  fetchSellerTopProducts,
  fetchSellerReviews,
  fetchDemandForecast,
  generateListing,
  createProduct,
  askSellerAdvisor,
  queryRAGKnowledge,
  fetchSellerFinancialAnalytics,
  fetchSellerSalesTrend,
  fetchSellerCategoryPerformance,
  fetchSellerPaymentDistribution,
  fetchSellerTransactions,
  fetchMyPermittedCategories,
  createSellerProduct,
  fetchSellerProductDetail,
  updateSellerProduct,
  updateSellerProductStatus,
  archiveSellerProduct,
  uploadSellerProductImages,
  fetchSellerInventory,
  adjustSellerInventory,
  fetchSellerInventoryHistory
} from '../../services/api';
import {
  PageHeader,
  KPIStatCard,
  ChartCard,
  DataTable,
  StatusBadge,
  EmptyState,
  LoadingSkeleton,
  SearchInput,
  type Column
} from '../common';
import {
  TrendingUp,
  Package,
  Sparkles,
  Bot,
  BookOpen,
  PlusCircle,
  Truck,
  CheckCircle2,
  Send,
  FileText,
  ShoppingBag,
  RefreshCw,
  Star,
  AlertTriangle,
  X,
  CreditCard,
  Eye,
  Edit2,
  SlidersHorizontal,
  History,
  UploadCloud,
  Archive,
  PauseCircle,
  PlayCircle,
  Image as ImageIcon
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell
} from 'recharts';

import { SellerStoreOrders } from './SellerStoreOrders';

const PIE_COLORS = ['#10B981', '#3B82F6', '#F59E0B', '#EF4444', '#8B5CF6'];

interface SellerViewProps {
  activeSubTab?: string;
}

export const SellerView: React.FC<SellerViewProps> = ({ activeSubTab }) => {
  const [mySeller, setMySeller] = useState<any | null>(null);
  const [sellerProducts, setSellerProducts] = useState<any[]>([]);
  const [sellerOrders, setSellerOrders] = useState<any[]>([]);
  const [sellerAnalytics, setSellerAnalytics] = useState<SellerAnalytics | null>(null);
  const [financialAnalytics, setFinancialAnalytics] = useState<SellerFinancialAnalytics | null>(null);
  const [salesTrend, setSalesTrend] = useState<SellerSalesTrendPoint[]>([]);
  const [trendTimeframe, setTrendTimeframe] = useState<'daily' | 'weekly' | 'monthly'>('daily');
  const [categoryPerf, setCategoryPerf] = useState<SellerCategoryPerformanceItem[]>([]);
  const [paymentDist, setPaymentDist] = useState<SellerPaymentMethodDistributionItem[]>([]);
  const [orderStatusDist, setOrderStatusDist] = useState<SellerOrderStatusCount[]>([]);
  const [topProducts, setTopProducts] = useState<SellerTopProduct[]>([]);
  const [reviews, setReviews] = useState<SellerCustomerReview[]>([]);
  const [transactions, setTransactions] = useState<SellerTransactionItem[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [stores, setStores] = useState<Store[]>([]);
  const [selectedStore, setSelectedStore] = useState<Store | null>(null);
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'MY_PRODUCTS' | 'INVENTORY' | 'MY_ORDERS' | 'SHIPMENTS' | 'PAYMENTS' | 'REVIEWS' | 'AI_GENERATOR' | 'DEMAND' | 'AI_ADVISOR' | 'RAG_KNOWLEDGE' | 'SETTINGS'>('OVERVIEW');

  // Synchronize tab with sidebar navigation selection
  useEffect(() => {
    if (!activeSubTab) return;
    const tabMap: Record<string, 'OVERVIEW' | 'MY_PRODUCTS' | 'INVENTORY' | 'MY_ORDERS' | 'SHIPMENTS' | 'PAYMENTS' | 'REVIEWS' | 'AI_GENERATOR' | 'DEMAND' | 'AI_ADVISOR' | 'RAG_KNOWLEDGE' | 'SETTINGS'> = {
      overview: 'OVERVIEW',
      products: 'MY_PRODUCTS',
      inventory: 'INVENTORY',
      orders: 'MY_ORDERS',
      shipments: 'SHIPMENTS',
      payments: 'PAYMENTS',
      reviews: 'REVIEWS',
      copilot: 'AI_GENERATOR',
      demand: 'DEMAND',
      advisor: 'AI_ADVISOR',
      knowledge: 'RAG_KNOWLEDGE',
      settings: 'SETTINGS'
    };
    const target = tabMap[activeSubTab.toLowerCase()];
    if (target) {
      setActiveTab(target);
    }
  }, [activeSubTab]);

  // Search & Filter
  const [productSearch, setProductSearch] = useState('');

  // Forecast state
  const [forecasts, setForecasts] = useState<DemandForecastItem[]>([]);

  // AI Generator state
  const [seedText, setSeedText] = useState<string>('Homemade Mango Pickle, 500g, ₹250');
  const [genCategory, setGenCategory] = useState<string>('Food & Gourmet');
  const [genLoading, setGenLoading] = useState<boolean>(false);
  const [genResult, setGenResult] = useState<AIListingResponse | null>(null);
  const [publishSuccess, setPublishSuccess] = useState<string | null>(null);

  // Sprint 0.3: Permitted Categories & Inventory
  const [permittedCategories, setPermittedCategories] = useState<string[]>([]);
  const [inventorySummary, setInventorySummary] = useState<SellerInventorySummary | null>(null);
  const [inventoryFilter, setInventoryFilter] = useState<'ALL' | 'HEALTHY' | 'LOW_STOCK' | 'OUT_OF_STOCK'>('ALL');
  const [inventorySearch, setInventorySearch] = useState<string>('');

  // Product CRUD Modal State
  const [showProductModal, setShowProductModal] = useState<boolean>(false);
  const [modalMode, setModalMode] = useState<'ADD' | 'EDIT'>('ADD');
  const [formProductId, setFormProductId] = useState<string | null>(null);
  const [formName, setFormName] = useState<string>('');
  const [formCategory, setFormCategory] = useState<string>('');
  const [formSubcategory, setFormSubcategory] = useState<string>('');
  const [formBrand, setFormBrand] = useState<string>('');
  const [formSku, setFormSku] = useState<string>('');
  const [formPrice, setFormPrice] = useState<string>('');
  const [formDiscountPrice, setFormDiscountPrice] = useState<string>('');
  const [formStock, setFormStock] = useState<string>('10');
  const [formThreshold, setFormThreshold] = useState<string>('10');
  const [formStatus, setFormStatus] = useState<string>('active');
  const [formDescription, setFormDescription] = useState<string>('');
  const [formImages, setFormImages] = useState<string[]>([]);
  const [formPrimaryIndex, setFormPrimaryIndex] = useState<number>(0);
  const [uploadingImages, setUploadingImages] = useState<boolean>(false);
  const [imageUploadError, setImageUploadError] = useState<string | null>(null);
  const [formSubmitting, setFormSubmitting] = useState<boolean>(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Product Detail Modal State
  const [showDetailModal, setShowDetailModal] = useState<boolean>(false);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [selectedProductDetail, setSelectedProductDetail] = useState<SellerProductDetail | null>(null);
  const [detailActiveImgIndex, setDetailActiveImgIndex] = useState<number>(0);

  // Stock Adjustment Modal State
  const [showAdjustModal, setShowAdjustModal] = useState<boolean>(false);
  const [adjustProduct, setAdjustProduct] = useState<any | null>(null);
  const [adjustType, setAdjustType] = useState<string>('restock');
  const [adjustQtyChange, setAdjustQtyChange] = useState<number>(10);
  const [adjustReason, setAdjustReason] = useState<string>('');
  const [adjustOrderRef, setAdjustOrderRef] = useState<string>('');
  const [adjustSubmitting, setAdjustSubmitting] = useState<boolean>(false);
  const [adjustError, setAdjustError] = useState<string | null>(null);

  // Inventory History Modal State
  const [showHistoryModal, setShowHistoryModal] = useState<boolean>(false);
  const [historyList, setHistoryList] = useState<InventoryHistoryItem[]>([]);
  const [historyLoading, setHistoryLoading] = useState<boolean>(false);

  // Archive Modal State
  const [showArchiveModal, setShowArchiveModal] = useState<boolean>(false);
  const [archiveProduct, setArchiveProduct] = useState<any | null>(null);
  const [archiveSubmitting, setArchiveSubmitting] = useState<boolean>(false);

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
      const [profile, myStoresList] = await Promise.all([
        fetchMySellerProfile().catch(() => null),
        fetchMySellerStores().catch(() => [])
      ]);
      setMySeller(profile);

      const formattedStores: Store[] = myStoresList.map((s: any) => ({
        id: s.seller_id,
        seller_id: s.seller_id,
        store_name: s.store_name,
        store_type: s.store_type,
        slug: s.seller_id,
        description: s.business_description || ''
      }));
      setStores(formattedStores);

      const activeStore = profile || (formattedStores.length > 0 ? formattedStores[0] : null);
      setSelectedStore(activeStore);

      if (activeStore) {
        const [prods, orders, analytics, dist, topP, revs, finData, trendData, catData, payData, txs, permittedCats, invData] = await Promise.all([
          fetchMySellerProducts().catch(() => []),
          fetchSellerOrders().catch(() => []),
          fetchMySellerAnalytics().catch(() => null),
          fetchSellerOrderStatusDistribution().catch(() => []),
          fetchSellerTopProducts(10).catch(() => []),
          fetchSellerReviews(20).catch(() => []),
          fetchSellerFinancialAnalytics().catch(() => null),
          fetchSellerSalesTrend('daily').catch(() => []),
          fetchSellerCategoryPerformance().catch(() => []),
          fetchSellerPaymentDistribution().catch(() => []),
          fetchSellerTransactions().catch(() => []),
          fetchMyPermittedCategories().catch(() => []),
          fetchSellerInventory().catch(() => null)
        ]);
        setSellerProducts(prods);
        setSellerOrders(orders);
        setSellerAnalytics(analytics);
        setOrderStatusDist(dist);
        setTopProducts(topP);
        setReviews(revs);
        setFinancialAnalytics(finData);
        setSalesTrend(trendData);
        setCategoryPerf(catData);
        setPaymentDist(payData);
        setTransactions(txs);
        setPermittedCategories(permittedCats.length > 0 ? permittedCats : ['Footwear', 'Apparel', 'Accessories', 'General']);
        setInventorySummary(invData);

        // Fetch forecast
        fetchDemandForecast(activeStore.seller_id).then(setForecasts).catch(() => []);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load seller context');
    } finally {
      setLoading(false);
    }
  };

  const handleTimeframeChange = async (tf: 'daily' | 'weekly' | 'monthly') => {
    setTrendTimeframe(tf);
    try {
      const data = await fetchSellerSalesTrend(tf);
      setSalesTrend(data);
    } catch (err) {
      console.warn('Failed to fetch sales trend for', tf, err);
    }
  };

  // === SPRINT 0.3: PRODUCT CRUD & INVENTORY HANDLERS ===

  const refreshSellerData = async () => {
    try {
      const [prods, analytics, invData] = await Promise.all([
        fetchMySellerProducts().catch(() => []),
        fetchMySellerAnalytics().catch(() => null),
        fetchSellerInventory().catch(() => null)
      ]);
      setSellerProducts(prods);
      setSellerAnalytics(analytics);
      setInventorySummary(invData);
    } catch (err) {
      console.warn('Failed to refresh seller catalog:', err);
    }
  };

  const handleOpenAddProduct = () => {
    setModalMode('ADD');
    setFormProductId(null);
    setFormName('');
    setFormCategory(permittedCategories[0] || 'Footwear');
    setFormSubcategory('');
    setFormBrand(selectedStore?.store_name || '');
    setFormSku('');
    setFormPrice('');
    setFormDiscountPrice('');
    setFormStock('10');
    setFormThreshold('10');
    setFormStatus('active');
    setFormDescription('');
    setFormImages([]);
    setFormPrimaryIndex(0);
    setFormError(null);
    setImageUploadError(null);
    setShowProductModal(true);
  };

  const handleOpenEditProduct = (p: any) => {
    setModalMode('EDIT');
    setFormProductId(p.product_id);
    setFormName(p.product_name || '');
    setFormCategory(p.category || permittedCategories[0] || 'Footwear');
    setFormSubcategory(p.subcategory || '');
    setFormBrand(p.brand || selectedStore?.store_name || '');
    setFormSku(p.sku || '');
    setFormPrice(String(p.selling_price || ''));
    setFormDiscountPrice(p.discount_price ? String(p.discount_price) : '');
    setFormStock(String(p.stock_quantity ?? 0));
    setFormThreshold(String(p.low_stock_threshold ?? 10));
    setFormStatus(p.listing_status || 'active');
    setFormDescription(p.description || '');
    setFormImages(p.image_url ? [p.image_url] : []);
    setFormPrimaryIndex(0);
    setFormError(null);
    setImageUploadError(null);
    setShowProductModal(true);
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    if (formImages.length + files.length > 5) {
      setImageUploadError('A maximum of 5 images are permitted per product listing.');
      return;
    }

    setUploadingImages(true);
    setImageUploadError(null);
    try {
      const fileList = Array.from(files);
      const results = await uploadSellerProductImages(fileList);
      const newUrls = results.map((r) => r.url);
      setFormImages((prev) => [...prev, ...newUrls]);
    } catch (err: any) {
      setImageUploadError(err.message || 'Image upload failed. Ensure format is JPEG, PNG, or WebP (max 5MB).');
    } finally {
      setUploadingImages(false);
      // Reset input value
      e.target.value = '';
    }
  };

  const handleRemoveImage = (indexToRemove: number) => {
    setFormImages((prev) => prev.filter((_, idx) => idx !== indexToRemove));
    if (formPrimaryIndex >= indexToRemove && formPrimaryIndex > 0) {
      setFormPrimaryIndex((prev) => prev - 1);
    }
  };

  const handleSetPrimaryImage = (index: number) => {
    setFormPrimaryIndex(index);
  };

  const handleSaveProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) {
      setFormError('Product title is required.');
      return;
    }
    const priceNum = parseFloat(formPrice);
    if (isNaN(priceNum) || priceNum <= 0) {
      setFormError('Please enter a valid selling price greater than 0.');
      return;
    }
    const stockNum = parseInt(formStock, 10);
    if (isNaN(stockNum) || stockNum < 0) {
      setFormError('Stock quantity cannot be negative.');
      return;
    }

    setFormSubmitting(true);
    setFormError(null);
    try {
      if (modalMode === 'ADD') {
        await createSellerProduct({
          product_name: formName.trim(),
          category: formCategory,
          subcategory: formSubcategory.trim() || undefined,
          brand: formBrand.trim() || undefined,
          selling_price: priceNum,
          discount_price: formDiscountPrice ? parseFloat(formDiscountPrice) : undefined,
          stock_quantity: stockNum,
          sku: formSku.trim() || undefined,
          low_stock_threshold: parseInt(formThreshold, 10) || 10,
          listing_status: formStatus,
          description: formDescription.trim() || undefined,
          images: formImages,
          primary_image_index: formPrimaryIndex
        });
        setPublishSuccess(`Product "${formName}" published to your store catalog.`);
      } else {
        if (!formProductId) throw new Error('Missing product ID for update.');
        await updateSellerProduct(formProductId, {
          product_name: formName.trim(),
          category: formCategory,
          subcategory: formSubcategory.trim() || undefined,
          brand: formBrand.trim() || undefined,
          selling_price: priceNum,
          discount_price: formDiscountPrice ? parseFloat(formDiscountPrice) : undefined,
          stock_quantity: stockNum,
          sku: formSku.trim() || undefined,
          low_stock_threshold: parseInt(formThreshold, 10) || 10,
          listing_status: formStatus,
          description: formDescription.trim() || undefined,
          images: formImages,
          primary_image_index: formPrimaryIndex
        });
        setPublishSuccess(`Product "${formName}" updated successfully.`);
      }

      setShowProductModal(false);
      setTimeout(() => setPublishSuccess(null), 5000);
      await refreshSellerData();
    } catch (err: any) {
      setFormError(err.message || 'Failed to save product listing.');
    } finally {
      setFormSubmitting(false);
    }
  };

  const handleToggleProductStatus = async (p: any) => {
    const nextStatus = p.listing_status === 'active' ? 'paused' : 'active';
    try {
      await updateSellerProductStatus(p.product_id, nextStatus);
      setPublishSuccess(`Product ${p.product_name || p.product_id} is now ${nextStatus}.`);
      setTimeout(() => setPublishSuccess(null), 4000);
      await refreshSellerData();
    } catch (err: any) {
      setError(err.message || 'Failed to change listing status.');
    }
  };

  const handleViewProductDetail = async (productId: string) => {
    setDetailLoading(true);
    setSelectedProductDetail(null);
    setDetailActiveImgIndex(0);
    setShowDetailModal(true);
    try {
      const detail = await fetchSellerProductDetail(productId);
      setSelectedProductDetail(detail);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch product details.');
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOpenAdjustModal = (p: any) => {
    setAdjustProduct(p);
    setAdjustType('restock');
    setAdjustQtyChange(10);
    setAdjustReason('');
    setAdjustOrderRef('');
    setAdjustError(null);
    setShowAdjustModal(true);
  };

  const handleConfirmAdjust = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustProduct) return;
    if (!adjustReason.trim() || adjustReason.trim().length < 3) {
      setAdjustError('Please specify a valid reason (min 3 characters).');
      return;
    }
    const currentStock = adjustProduct.stock_quantity ?? 0;
    const finalStock = currentStock + adjustQtyChange;
    if (finalStock < 0) {
      setAdjustError(`Cannot reduce stock below zero. Current stock is ${currentStock}, attempted reduction is ${Math.abs(adjustQtyChange)}.`);
      return;
    }

    setAdjustSubmitting(true);
    setAdjustError(null);
    try {
      await adjustSellerInventory(adjustProduct.product_id, {
        adjustment_type: adjustType,
        quantity_change: adjustQtyChange,
        adjustment_reason: adjustReason.trim(),
        order_reference: adjustOrderRef.trim() || undefined
      });
      setShowAdjustModal(false);
      setPublishSuccess(`Stock for "${adjustProduct.product_name}" adjusted successfully (${currentStock} → ${finalStock}).`);
      setTimeout(() => setPublishSuccess(null), 5000);
      await refreshSellerData();
    } catch (err: any) {
      setAdjustError(err.message || 'Failed to adjust inventory.');
    } finally {
      setAdjustSubmitting(false);
    }
  };

  const handleOpenHistoryModal = async (productId?: string) => {
    setHistoryLoading(true);
    setShowHistoryModal(true);
    try {
      const list = await fetchSellerInventoryHistory(productId, 50);
      setHistoryList(list);
    } catch (err: any) {
      setError(err.message || 'Failed to fetch inventory movement audit history.');
    } finally {
      setHistoryLoading(false);
    }
  };

  const handleOpenArchiveModal = (p: any) => {
    setArchiveProduct(p);
    setShowArchiveModal(true);
  };

  const handleConfirmArchive = async () => {
    if (!archiveProduct) return;
    setArchiveSubmitting(true);
    try {
      await archiveSellerProduct(archiveProduct.product_id);
      setShowArchiveModal(false);
      setPublishSuccess(`Product "${archiveProduct.product_name}" removed from storefront catalog.`);
      setTimeout(() => setPublishSuccess(null), 5000);
      await refreshSellerData();
    } catch (err: any) {
      setError(err.message || 'Failed to archive product.');
    } finally {
      setArchiveSubmitting(false);
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
    } catch (err: any) {
      setError(err.message || 'Failed to generate listing draft');
    } finally {
      setGenLoading(false);
    }
  };

  const handlePublishGeneratedProduct = async () => {
    if (!genResult) return;
    try {
      await createProduct({
        product_name: genResult.generated_title || genResult.title || 'New AI Product',
        category: genResult.category || genCategory || 'General',
        price: genResult.suggested_price || 250,
        cost_price: 200,
        stock_quantity: 40
      });
      setPublishSuccess(`Listing "${genResult.generated_title || genResult.title}" published!`);
      setTimeout(() => setPublishSuccess(null), 5000);
      setGenResult(null);

      const [prods, analytics] = await Promise.all([
        fetchMySellerProducts().catch(() => []),
        fetchMySellerAnalytics().catch(() => null)
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
    } catch (err: any) {
      setError(err.message || 'Failed to query AI advisor');
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
    } catch (err: any) {
      setError(err.message || 'Failed to query RAG knowledge');
    } finally {
      setRAGLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="py-24 max-w-7xl mx-auto space-y-4">
        <LoadingSkeleton type="card" count={4} />
      </div>
    );
  }

  const isApproved = mySeller?.approval_status === 'approved';

  // Filtered products
  const filteredProducts = sellerProducts.filter((p) => {
    const term = productSearch.toLowerCase().trim();
    if (!term) return true;
    return (
      (p.product_name || '').toLowerCase().includes(term) ||
      (p.product_id || '').toLowerCase().includes(term) ||
      (p.category || '').toLowerCase().includes(term)
    );
  });

  const productColumns: Column<any>[] = [
    {
      key: 'product_name',
      header: 'Product',
      render: (p) => (
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-lg bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
            {p.image_url ? (
              <img src={p.image_url} alt={p.product_name} className="w-full h-full object-cover" />
            ) : (
              <Package className="w-5 h-5 text-slate-400" />
            )}
          </div>
          <div>
            <div className="font-semibold text-slate-900">{p.product_name || 'Store Catalog Product'}</div>
            <div className="text-xs text-slate-500 font-mono flex items-center gap-2">
              <span>{p.sku || p.product_id}</span>
              {p.brand && <span className="text-slate-400 font-sans">• {p.brand}</span>}
            </div>
          </div>
        </div>
      )
    },
    {
      key: 'category',
      header: 'Category',
      render: (p) => (
        <span className="px-2.5 py-0.5 rounded-md bg-slate-100 text-slate-700 text-xs font-medium">
          {p.category || 'General'}
        </span>
      )
    },
    {
      key: 'selling_price',
      header: 'Price',
      align: 'right',
      render: (p) => (
        <div className="text-right">
          <div className="font-mono font-bold text-slate-900">₹{(p.selling_price || 0).toLocaleString('en-IN')}</div>
          {p.discount_price && (
            <div className="text-xs text-emerald-600 font-mono font-medium">Sale: ₹{p.discount_price.toLocaleString('en-IN')}</div>
          )}
        </div>
      )
    },
    {
      key: 'stock_quantity',
      header: 'Stock',
      align: 'right',
      render: (p) => {
        const stock = p.stock_quantity ?? 0;
        const threshold = p.low_stock_threshold ?? 10;
        const isOutOfStock = stock <= 0;
        const isLow = stock > 0 && stock <= threshold;
        return (
          <span
            className={`inline-flex items-center gap-1 font-mono text-xs font-semibold px-2.5 py-0.5 rounded-full ${
              isOutOfStock
                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                : isLow
                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
            }`}
          >
            {stock} units
          </span>
        );
      }
    },
    {
      key: 'listing_status',
      header: 'Status',
      align: 'center',
      render: (p) => (
        <div className="flex items-center justify-center gap-1.5">
          <StatusBadge status={p.listing_status || 'active'} size="sm" />
          <button
            onClick={() => handleToggleProductStatus(p)}
            title={p.listing_status === 'active' ? 'Pause Listing' : 'Activate Listing'}
            className="p-1 text-slate-400 hover:text-slate-700 rounded transition"
          >
            {p.listing_status === 'active' ? (
              <PauseCircle className="w-3.5 h-3.5 text-amber-600" />
            ) : (
              <PlayCircle className="w-3.5 h-3.5 text-emerald-600" />
            )}
          </button>
        </div>
      )
    },
    {
      key: 'actions',
      header: 'Actions',
      align: 'right',
      render: (p) => (
        <div className="flex items-center justify-end gap-1">
          <button
            onClick={() => handleViewProductDetail(p.product_id)}
            title="View Details"
            className="p-1.5 text-slate-500 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition"
          >
            <Eye className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenEditProduct(p)}
            title="Edit Product"
            className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
          >
            <Edit2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenAdjustModal(p)}
            title="Adjust Stock"
            className="p-1.5 text-slate-500 hover:text-emerald-600 hover:bg-emerald-50 rounded-lg transition"
          >
            <SlidersHorizontal className="w-4 h-4" />
          </button>
          <button
            onClick={() => handleOpenArchiveModal(p)}
            title="Archive Product"
            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition"
          >
            <Archive className="w-4 h-4" />
          </button>
        </div>
      )
    }
  ];

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Modern Page Header */}
      <PageHeader
        title={
          activeTab === 'MY_PRODUCTS'
            ? 'Product Catalog & Listings'
            : activeTab === 'INVENTORY'
            ? 'Inventory Management & Stock Tracking'
            : activeTab === 'MY_ORDERS'
            ? 'Store Orders & Customer Fulfillment'
            : activeTab === 'SHIPMENTS'
            ? 'Seller Shipments & Dispatches'
            : activeTab === 'PAYMENTS'
            ? 'Payments & Settlement Ledger'
            : activeTab === 'REVIEWS'
            ? 'Customer Reviews & Feedback'
            : activeTab === 'AI_GENERATOR'
            ? 'AI Catalog Copilot'
            : activeTab === 'DEMAND'
            ? 'Demand Intelligence & Velocity'
            : activeTab === 'AI_ADVISOR'
            ? 'AI Storefront Advisor'
            : activeTab === 'RAG_KNOWLEDGE'
            ? 'Store Policy Knowledge Base'
            : activeTab === 'SETTINGS'
            ? 'Store Settings & Merchant Profile'
            : mySeller?.store_name || selectedStore?.store_name || 'Seller Dashboard'
        }
        subtitle={
          activeTab === 'MY_PRODUCTS'
            ? 'Create, edit, toggle, and manage storefront product listings'
            : activeTab === 'INVENTORY'
            ? 'Live stock health, low stock thresholds, and stock adjustment audit logs'
            : activeTab === 'MY_ORDERS'
            ? 'Process customer orders, view masked contact data, and stage for pickup'
            : activeTab === 'SHIPMENTS'
            ? 'Track carrier dispatches, waybills, and transit status'
            : activeTab === 'PAYMENTS'
            ? 'Financial transparency, collected payments, and transaction history'
            : activeTab === 'REVIEWS'
            ? 'Verified buyer feedback and store reputation'
            : activeTab === 'AI_GENERATOR'
            ? 'GenAI product draft generator for rapid catalog publishing'
            : activeTab === 'DEMAND'
            ? 'Predictive sales velocity and replenishment models'
            : activeTab === 'AI_ADVISOR'
            ? 'Intelligent merchant advisor backed by real database metrics'
            : activeTab === 'RAG_KNOWLEDGE'
            ? 'Tenant-isolated merchant policy documents'
            : activeTab === 'SETTINGS'
            ? 'Storefront configuration, GST details, and settlement parameters'
            : `Merchant storefront console • ID: ${mySeller?.seller_id || selectedStore?.seller_id || 'N/A'}`
        }
        roleBadge={mySeller?.approval_status ? `Store: ${mySeller.approval_status}` : 'Seller'}
        actions={
          <div className="flex items-center gap-2">
            {stores.length > 1 && (
              <select
                value={selectedStore?.seller_id || ''}
                onChange={(e) => {
                  const s = stores.find((st) => st.seller_id === e.target.value);
                  if (s) setSelectedStore(s);
                }}
                className="px-3 py-2 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700"
              >
                {stores.map((s) => (
                  <option key={s.seller_id} value={s.seller_id}>
                    {s.store_name}
                  </option>
                ))}
              </select>
            )}
            {isApproved && (activeTab === 'MY_PRODUCTS' || activeTab === 'INVENTORY' || activeTab === 'OVERVIEW') && (
              <button
                onClick={handleOpenAddProduct}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            )}
            {activeTab === 'INVENTORY' && (
              <button
                onClick={() => handleOpenHistoryModal()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg transition cursor-pointer"
              >
                <History className="w-4 h-4 text-slate-600" />
                <span>Audit Trail</span>
              </button>
            )}
            <button
              onClick={loadSellerContext}
              className="p-2 text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition cursor-pointer"
              title="Refresh"
            >
              <RefreshCw className="w-4 h-4" />
            </button>
          </div>
        }
      />

      {/* Approval Status Banner if Pending or Suspended */}
      {mySeller && !isApproved && (
        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs flex items-center justify-between">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
            <span>
              Your storefront is currently <strong>{mySeller.approval_status.toUpperCase()}</strong>. Product listing and order fulfillment privileges will activate upon administrator review.
            </span>
          </div>
        </div>
      )}

      {/* Publish Success Banner */}
      {publishSuccess && (
        <div className="p-4 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-xl text-xs font-medium">
          {publishSuccess}
        </div>
      )}

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-xl text-xs">
          {error}
        </div>
      )}

      {/* TAB 1: OVERVIEW & ANALYTICS */}
      {activeTab === 'OVERVIEW' && (
        <div className="space-y-6">
          {/* SELLER SETTLEMENT DISCLOSURE BANNER */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">Merchant Payout & Settlement Ledger</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {financialAnalytics?.seller_payout_status || 'Settlement data unavailable'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {financialAnalytics?.payout_note || 'Direct automated seller payout engine is not enabled. Customer payments are held centrally by marketplace treasury.'}
                </p>
              </div>
            </div>
            <div className="text-left sm:text-right shrink-0">
              <span className="text-[11px] text-slate-400 font-mono">Commission Rate: 5% Standard</span>
            </div>
          </div>

          {/* Authentic Financial KPI Cards */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Gross Sales</p>
              <p className="text-lg font-extrabold text-slate-900 mt-1 font-mono">
                ₹{(financialAnalytics?.gross_sales ?? sellerAnalytics?.total_sales ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-slate-400">Total subtotal</span>
            </div>

            <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/20 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Net Sales</p>
              <p className="text-lg font-extrabold text-emerald-700 mt-1 font-mono">
                ₹{(financialAnalytics?.net_sales ?? (sellerAnalytics?.total_sales ?? 0)).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-emerald-600">Gross - Refunds</span>
            </div>

            <div className="p-4 bg-white border border-blue-200 bg-blue-50/20 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-blue-700 uppercase tracking-wider">Captured Paid</p>
              <p className="text-lg font-extrabold text-blue-700 mt-1 font-mono">
                ₹{(financialAnalytics?.successfully_paid_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-blue-600">Settled orders</span>
            </div>

            <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider">Pending Pay</p>
              <p className="text-lg font-extrabold text-amber-700 mt-1 font-mono">
                ₹{(financialAnalytics?.pending_payment_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-amber-600">Awaiting capture</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 bg-slate-50/50 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-600 uppercase tracking-wider">Unpaid / Missing</p>
              <p className="text-lg font-extrabold text-slate-800 mt-1 font-mono">
                ₹{(financialAnalytics?.unpaid_amount ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-slate-400">No payment row</span>
            </div>

            <div className="p-4 bg-white border border-rose-200 bg-rose-50/20 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Refunds</p>
              <p className="text-lg font-extrabold text-rose-700 mt-1 font-mono">
                ₹{(financialAnalytics?.refund_deductions ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-rose-600">Deducted</span>
            </div>

            <div className="p-4 bg-white border border-purple-200 bg-purple-50/20 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-purple-700 uppercase tracking-wider">Platform Fee</p>
              <p className="text-lg font-extrabold text-purple-700 mt-1 font-mono">
                ₹{(financialAnalytics?.platform_commission ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-purple-600">5% Commission</span>
            </div>

            <div className="p-4 bg-white border border-slate-200 rounded-xl shadow-xs">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Average AOV</p>
              <p className="text-lg font-extrabold text-slate-900 mt-1 font-mono">
                ₹{(financialAnalytics?.average_order_value ?? 0).toLocaleString('en-IN', { maximumFractionDigits: 0 })}
              </p>
              <span className="text-[10px] text-slate-400">Per order avg</span>
            </div>
          </div>

          {/* Operational & Business KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-3">
            <KPIStatCard
              title="Total Orders"
              value={(financialAnalytics?.total_orders ?? sellerOrders.length).toLocaleString('en-IN')}
              subtitle="All store orders"
              icon={ShoppingBag}
            />
            <KPIStatCard
              title="Delivered"
              value={(financialAnalytics?.delivered_orders_count ?? 0).toString()}
              subtitle="Fulfilled orders"
              icon={CheckCircle2}
              variant="success"
            />
            <KPIStatCard
              title="Processing"
              value={(financialAnalytics?.processing_orders_count ?? sellerOrders.length).toString()}
              subtitle="In fulfillment pipeline"
              icon={RefreshCw}
              variant="default"
            />
            <KPIStatCard
              title="Cancelled"
              value={(financialAnalytics?.cancelled_orders_count ?? 0).toString()}
              subtitle="Zero cancellations"
              icon={AlertTriangle}
              variant="default"
            />
            <KPIStatCard
              title="Fulfillment Rate"
              value={financialAnalytics?.fulfillment_rate != null ? `${financialAnalytics.fulfillment_rate}%` : (sellerAnalytics?.fulfillment_rate_display ?? '0%')}
              subtitle="Delivered / total placed"
              icon={CheckCircle2}
              variant="success"
            />
            <KPIStatCard
              title="Store Rating"
              value={sellerAnalytics?.store_rating != null ? `${sellerAnalytics.store_rating.toFixed(1)} / 5.0` : 'No reviews'}
              subtitle={sellerAnalytics?.total_reviews_count ? `From ${sellerAnalytics.total_reviews_count} reviews` : 'Zero reviews'}
              icon={Star}
              variant="warning"
            />
            <KPIStatCard
              title="Active Products"
              value={(financialAnalytics?.active_products_count ?? sellerProducts.filter(p => p.listing_status === 'active').length).toString()}
              subtitle="Live in catalog"
              icon={Package}
            />
            <KPIStatCard
              title="Low Stock"
              value={(financialAnalytics?.low_stock_products_count ?? sellerProducts.filter(p => p.stock_quantity > 0 && p.stock_quantity <= 10).length).toString()}
              subtitle="Stock ≤ 10 units"
              icon={AlertTriangle}
              variant="warning"
            />
          </div>

          {/* Recharts Sales Trend with Timeframe Selector & Order Status Distribution */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <div className="bg-white border border-slate-200 rounded-xl p-5 shadow-xs">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">Sales Revenue Trend</h3>
                    <p className="text-xs text-slate-500">Calculated strictly from authoritative seller orders</p>
                  </div>
                  <div className="flex items-center bg-slate-100 p-1 rounded-lg">
                    {(['daily', 'weekly', 'monthly'] as const).map((tf) => (
                      <button
                        key={tf}
                        onClick={() => handleTimeframeChange(tf)}
                        className={`px-3 py-1 text-xs font-semibold rounded-md capitalize transition ${
                          trendTimeframe === tf ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        {tf}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="h-72 w-full">
                  {(() => {
                    const trendData = salesTrend.length > 0
                      ? salesTrend.map(s => ({ period: s.period, revenue: s.revenue }))
                      : (sellerAnalytics?.revenue_chart || []).map(r => ({ period: r.day, revenue: r.revenue }));
                    
                    return trendData.length > 0 ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart
                          data={trendData}
                          margin={{ top: 10, right: 10, left: 0, bottom: 0 }}
                        >
                          <defs>
                            <linearGradient id="sellerRevGrad" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor="#10B981" stopOpacity={0.25} />
                              <stop offset="95%" stopColor="#10B981" stopOpacity={0.0} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                          <XAxis dataKey="period" tick={{ fontSize: 11, fill: '#64748B' }} />
                          <YAxis tick={{ fontSize: 11, fill: '#64748B' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                          <Tooltip
                            formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                            contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                          />
                          <Area type="monotone" dataKey="revenue" stroke="#10B981" strokeWidth={2} fillOpacity={1} fill="url(#sellerRevGrad)" />
                        </AreaChart>
                      </ResponsiveContainer>
                    ) : (
                      <div className="h-full flex items-center justify-center text-xs text-slate-400">
                        No sales data available for this timeframe.
                      </div>
                    );
                  })()}
                </div>
              </div>
            </div>

            <div className="lg:col-span-1">
              <ChartCard
                title="Order Status Share"
                subtitle="Status distribution of seller orders"
                isEmpty={orderStatusDist.length === 0}
                emptyTitle="No orders placed yet"
              >
                <div className="h-72 w-full flex flex-col items-center justify-center">
                  <ResponsiveContainer width="100%" height={200}>
                    <PieChart>
                      <Pie
                        data={orderStatusDist}
                        dataKey="count"
                        nameKey="status"
                        cx="50%"
                        cy="50%"
                        innerRadius={45}
                        outerRadius={70}
                        paddingAngle={3}
                      >
                        {orderStatusDist.map((_, index) => (
                          <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip
                        formatter={(val: any, name: any) => [`${val} orders`, name]}
                        contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                  <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-2 text-xs">
                    {orderStatusDist.map((d, i) => (
                      <div key={d.status} className="flex items-center gap-1.5 text-slate-600">
                        <span className="w-2 h-2 rounded-full" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                        <span className="truncate">{d.status} ({d.percentage}%)</span>
                      </div>
                    ))}
                  </div>
                </div>
              </ChartCard>
            </div>
          </div>

          {/* Category Sales & Payment Methods Grid */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Category Performance */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-1">Category Sales Performance</h3>
              <p className="text-xs text-slate-500 mb-4">Revenue breakdown across store merchandise categories</p>
              <div className="h-60 w-full">
                {categoryPerf.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={categoryPerf.slice(0, 5)} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="category" tick={{ fontSize: 10, fill: '#64748B' }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Revenue']}
                        contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      />
                      <Bar dataKey="revenue" fill="#3B82F6" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Category performance data will generate as orders are placed.
                  </div>
                )}
              </div>
            </div>

            {/* Payment Method Distribution */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <h3 className="font-bold text-sm text-slate-900 mb-1">Payment Method Distribution</h3>
              <p className="text-xs text-slate-500 mb-4">Channels through which customers purchased your products</p>
              {paymentDist.length > 0 ? (
                <div className="space-y-3 pt-2">
                  {paymentDist.map((pm) => (
                    <div key={pm.payment_method} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800">{pm.payment_method}</span>
                        <span className="font-mono text-slate-500">{pm.order_count} orders ({pm.percentage}%) • ₹{pm.amount.toLocaleString('en-IN')}</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-500 h-full rounded-full"
                          style={{ width: `${Math.min(100, pm.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="h-52 flex items-center justify-center text-xs text-slate-400">
                  Payment method distribution will appear upon customer order settlements.
                </div>
              )}
            </div>
          </div>

          {/* Top Selling Products Table */}
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <h3 className="text-base font-semibold text-slate-900 mb-1">Top Selling Products</h3>
            <p className="text-xs text-slate-500 mb-4">Ranked by authentic units sold and total revenue</p>
            {topProducts.length === 0 ? (
              <EmptyState
                icon={Package}
                title="No top products yet"
                description="Products will rank here once customer purchase transactions are recorded."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Product</th>
                      <th className="py-2.5 px-3">Category</th>
                      <th className="py-2.5 px-3 text-right">Units Sold</th>
                      <th className="py-2.5 px-3 text-right">Available Stock</th>
                      <th className="py-2.5 px-3 text-right">Total Revenue</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {topProducts.map((p) => (
                      <tr key={p.product_id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-semibold text-slate-900">{p.product_name}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-500">{p.category || 'General'}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{p.units_sold}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-slate-700">{p.current_stock}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">₹{p.total_revenue.toLocaleString('en-IN')}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Low-Stock Inventory Alert Table */}
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Low-Stock Inventory Alerts</h3>
                <p className="text-xs text-slate-500">Products requiring replenishment (threshold: 10 units)</p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg">
                {sellerProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 10).length} items alert
              </span>
            </div>
            {sellerProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 10).length === 0 ? (
              <EmptyState
                icon={Package}
                title="Inventory Healthy"
                description="No products are currently below the low-stock alert threshold."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Product Name</th>
                      <th className="py-2.5 px-3">Product ID</th>
                      <th className="py-2.5 px-3">Listing Status</th>
                      <th className="py-2.5 px-3 text-right">Selling Price</th>
                      <th className="py-2.5 px-3 text-right">Units Remaining</th>
                      <th className="py-2.5 px-3 text-center">Alert Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sellerProducts
                      .filter((p) => p.stock_quantity > 0 && p.stock_quantity <= 10)
                      .map((p) => (
                        <tr key={p.seller_product_id} className="hover:bg-slate-50/60 transition">
                          <td className="py-2.5 px-3 font-semibold text-slate-900">{p.product_name}</td>
                          <td className="py-2.5 px-3 font-mono text-xs text-slate-500">{p.product_id}</td>
                          <td className="py-2.5 px-3 capitalize">
                            <span className="px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              {p.listing_status}
                            </span>
                          </td>
                          <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">₹{p.selling_price.toLocaleString('en-IN')}</td>
                          <td className="py-2.5 px-3 text-right font-mono font-bold text-amber-600">{p.stock_quantity} units</td>
                          <td className="py-2.5 px-3 text-center">
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                              Low Stock ({p.stock_quantity} left)
                            </span>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Recent Payment & Settlement Transactions Ledger */}
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Recent Payment & Order Transactions</h3>
                <p className="text-xs text-slate-500">Authoritative payment status and proportional seller allocation from database records</p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {transactions.length} recorded {transactions.length === 1 ? 'transaction' : 'transactions'}
              </span>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No transactions found"
                description="Transaction records will display here when orders and payments are logged."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-sm">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-xs font-semibold text-slate-500 uppercase">
                      <th className="py-2.5 px-3">Parent Order ID</th>
                      <th className="py-2.5 px-3">Date</th>
                      <th className="py-2.5 px-3 text-right">Store Subtotal</th>
                      <th className="py-2.5 px-3 text-right">Allocation</th>
                      <th className="py-2.5 px-3 text-right">Allocated Paid</th>
                      <th className="py-2.5 px-3">Payment Method</th>
                      <th className="py-2.5 px-3">Payment Status</th>
                      <th className="py-2.5 px-3">Fulfillment Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={`${tx.order_id}-${tx.seller_order_id}`} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-mono font-semibold text-xs text-slate-900">{tx.order_id}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-500 whitespace-nowrap">{tx.order_date || 'Recent'}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-semibold text-slate-900">₹{tx.subtotal.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono text-xs text-slate-500">{tx.allocation_percentage}%</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">₹{tx.allocated_paid.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-700">{tx.payment_method}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              tx.payment_status.toLowerCase().includes('success') || tx.payment_status.toLowerCase().includes('paid')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tx.payment_status.toLowerCase().includes('pending')
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {tx.payment_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={tx.delivery_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: MY PRODUCTS */}
      {activeTab === 'MY_PRODUCTS' && (
        <div className="space-y-6">
          {/* Product Catalog KPI Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPIStatCard
              title="Total Listed Products"
              value={sellerProducts.length}
              subtitle="Active & paused items"
              icon={Package}
              variant="default"
            />
            <KPIStatCard
              title="Active Listings"
              value={sellerProducts.filter((p) => (p.listing_status || 'active') === 'active').length}
              subtitle="Live on storefront"
              icon={CheckCircle2}
              variant="success"
            />
            <KPIStatCard
              title="Low Stock Alert"
              value={sellerProducts.filter((p) => p.stock_quantity > 0 && p.stock_quantity <= (p.low_stock_threshold || 10)).length}
              subtitle="Below replenishment limit"
              icon={AlertTriangle}
              variant="warning"
            />
            <KPIStatCard
              title="Out of Stock"
              value={sellerProducts.filter((p) => p.stock_quantity <= 0).length}
              subtitle="Zero available stock"
              icon={X}
              variant="warning"
            />
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 p-4 bg-white border border-slate-200/80 rounded-xl shadow-xs">
            <SearchInput
              value={productSearch}
              onChange={setProductSearch}
              placeholder="Search product name, SKU, category..."
              className="w-full sm:w-80"
            />
            {isApproved && (
              <button
                onClick={handleOpenAddProduct}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition shadow-xs cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>Add Product</span>
              </button>
            )}
          </div>

          <DataTable
            columns={productColumns}
            data={filteredProducts}
            keyExtractor={(p) => p.seller_product_id}
            emptyTitle="No catalog items"
            emptyDescription="You have not published any products to your storefront yet."
          />
        </div>
      )}

      {/* TAB 3: MY ORDERS */}
      {activeTab === 'MY_ORDERS' && (
        <SellerStoreOrders />
      )}

      {/* TAB: SHIPMENTS */}
      {activeTab === 'SHIPMENTS' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Dispatched Store Shipments</h3>
                <p className="text-xs text-slate-500">Carrier waybills and delivery progression for parcels handed over to logistics</p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {sellerOrders.filter(o => ['HANDED_OVER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status)).length} parcels in logistics pipeline
              </span>
            </div>

            {sellerOrders.filter(o => ['HANDED_OVER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status)).length === 0 ? (
              <EmptyState
                icon={Truck}
                title="No active carrier dispatches"
                description="Orders will appear here once handed over to integrated logistics partners (Blue Dart, Delhivery, etc.)."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="p-3">Store Order</th>
                      <th className="p-3">Parent Order</th>
                      <th className="p-3">Carrier Partner</th>
                      <th className="p-3">Waybill Tracking #</th>
                      <th className="p-3">Destination</th>
                      <th className="p-3 text-right">Items / Value</th>
                      <th className="p-3 text-center">Transit Status</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {sellerOrders
                      .filter(o => ['HANDED_OVER', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED'].includes(o.status))
                      .map((o) => (
                        <tr key={o.seller_order_id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3 font-mono font-bold text-slate-900">#SO-{o.seller_order_id}</td>
                          <td className="p-3 font-mono text-slate-500">#{o.order_id}</td>
                          <td className="p-3 font-medium text-slate-800">{o.courier_name || 'Blue Dart Express'}</td>
                          <td className="p-3 font-mono font-semibold text-indigo-600">
                            {o.tracking_number ? (
                              <span className="inline-flex items-center gap-1">
                                <Truck className="w-3.5 h-3.5" />
                                <span>{o.tracking_number}</span>
                              </span>
                            ) : (
                              <span className="text-slate-400">Waybill Generated</span>
                            )}
                          </td>
                          <td className="p-3 text-slate-600">{o.shipping_city || o.city || 'Indiranagar, Bengaluru'}</td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-900">
                            ₹{(o.subtotal || o.final_amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-center">
                            <StatusBadge status={o.status} size="sm" />
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB: PAYMENTS & SETTLEMENTS */}
      {activeTab === 'PAYMENTS' && (
        <div className="space-y-6">
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-2xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 shadow-xs">
            <div className="flex items-start sm:items-center gap-3">
              <span className="p-2 bg-amber-100 text-amber-700 rounded-xl">
                <CreditCard className="w-5 h-5" />
              </span>
              <div>
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-sm text-slate-900">Merchant Payout & Settlement Ledger</h4>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-800 border border-amber-300">
                    {financialAnalytics?.seller_payout_status || 'Settlement info unavailable'}
                  </span>
                </div>
                <p className="text-xs text-slate-500 mt-0.5">
                  {financialAnalytics?.payout_note || 'Central platform treasury deposits customer payments into merchant bank accounts upon delivery SLA verification.'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2 text-xs font-mono font-bold">
              <span className="text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-200">
                Gross Sales: ₹{(financialAnalytics?.gross_sales || 0).toLocaleString('en-IN')}
              </span>
              <span className="text-blue-700 bg-blue-50 px-2.5 py-1 rounded-lg border border-blue-200">
                Net Settled: ₹{(financialAnalytics?.net_sales || 0).toLocaleString('en-IN')}
              </span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <KPIStatCard
              title="Collected & Captured"
              value={`₹${(financialAnalytics?.successfully_paid_amount || 0).toLocaleString('en-IN')}`}
              subtitle="Prepaid order collections"
              icon={CheckCircle2}
              variant="success"
            />
            <KPIStatCard
              title="Net Sales (Delivered)"
              value={`₹${(financialAnalytics?.net_sales || 0).toLocaleString('en-IN')}`}
              subtitle="Settled delivered sales"
              icon={TrendingUp}
              variant="accent"
            />
            <KPIStatCard
              title="Platform Commission"
              value={`₹${(financialAnalytics?.platform_commission || 0).toLocaleString('en-IN')}`}
              subtitle="5% marketplace fee"
              icon={CreditCard}
              variant="default"
            />
            <KPIStatCard
              title="Pending Settlements"
              value={`₹${(financialAnalytics?.pending_payment_amount || 0).toLocaleString('en-IN')}`}
              subtitle="Awaiting final delivery SLA"
              icon={AlertTriangle}
              variant="warning"
            />
          </div>

          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Authoritative Payment & Order Ledger</h3>
                <p className="text-xs text-slate-500">Direct database transaction records and proportional seller allocation</p>
              </div>
              <span className="text-xs font-mono text-slate-500">
                {transactions.length} recorded transactions
              </span>
            </div>
            {transactions.length === 0 ? (
              <EmptyState
                icon={CreditCard}
                title="No transaction records"
                description="Transactions will appear here as customer checkout payments are captured."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="py-2.5 px-3">Order Ref</th>
                      <th className="py-2.5 px-3">Payment Date</th>
                      <th className="py-2.5 px-3 text-right">Order Subtotal</th>
                      <th className="py-2.5 px-3 text-right">Allocated Payment</th>
                      <th className="py-2.5 px-3">Method</th>
                      <th className="py-2.5 px-3">Payment Status</th>
                      <th className="py-2.5 px-3">Fulfillment</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {transactions.map((tx) => (
                      <tr key={tx.order_id} className="hover:bg-slate-50/60 transition">
                        <td className="py-2.5 px-3 font-mono font-semibold text-slate-900">#{tx.order_id}</td>
                        <td className="py-2.5 px-3 text-slate-500">{tx.order_date}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">₹{tx.subtotal.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-700">₹{tx.allocated_paid.toLocaleString('en-IN')}</td>
                        <td className="py-2.5 px-3 text-xs text-slate-700">{tx.payment_method}</td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded text-[11px] font-semibold ${
                              tx.payment_status.toLowerCase().includes('success') || tx.payment_status.toLowerCase().includes('paid')
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : tx.payment_status.toLowerCase().includes('pending')
                                ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                : 'bg-rose-50 text-rose-700 border border-rose-200'
                            }`}
                          >
                            {tx.payment_status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3">
                          <StatusBadge status={tx.delivery_status} />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 4: REVIEWS & RATINGS */}
      {activeTab === 'REVIEWS' && (
        <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-4">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Customer Reviews & Ratings</h3>
            <p className="text-xs text-slate-500">Authentic feedback from verified purchases</p>
          </div>

          {reviews.length === 0 ? (
            <EmptyState
              icon={Star}
              title="No customer reviews yet"
              description="Customer reviews for your storefront's products will appear here once submitted."
            />
          ) : (
            <div className="space-y-3">
              {reviews.map((rev) => (
                <div key={rev.review_id} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-sm text-slate-900">{rev.product_name}</span>
                    <div className="flex items-center gap-1 text-amber-500 font-bold text-xs">
                      <Star className="w-4 h-4 fill-amber-400 stroke-amber-400" />
                      <span>{rev.rating} / 5</span>
                    </div>
                  </div>
                  {rev.review_text && <p className="text-xs text-slate-600 leading-relaxed">{rev.review_text}</p>}
                  <div className="flex items-center justify-between text-xs text-slate-400 pt-1 border-t border-slate-200">
                    <span>Review ID: {rev.review_id}</span>
                    <span>{rev.review_date || 'Recent'}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 5: AI CATALOG COPILOT */}
      {activeTab === 'AI_GENERATOR' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-indigo-600" />
              <h3 className="font-semibold text-slate-900">AI Product Listing Generator</h3>
            </div>
            <p className="text-xs text-slate-500">
              Enter short product details. Our GenAI pipeline will auto-generate title, description, features, and tags.
            </p>

            <form onSubmit={handleGenerateListing} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Product Seed Text</label>
                <input
                  type="text"
                  value={seedText}
                  onChange={(e) => setSeedText(e.target.value)}
                  placeholder="e.g. Homemade mango pickle, 500g, ₹250"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Category</label>
                <input
                  type="text"
                  value={genCategory}
                  onChange={(e) => setGenCategory(e.target.value)}
                  placeholder="e.g. Food & Gourmet"
                  className="w-full bg-white border border-slate-200 rounded-lg p-2.5 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              <button
                type="submit"
                disabled={genLoading}
                className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
              >
                <Sparkles className="w-4 h-4 text-amber-400" />
                <span>{genLoading ? 'Generating AI Copy...' : 'Generate Content Draft'}</span>
              </button>
            </form>
          </div>

          <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-4 shadow-xs">
            <h4 className="font-semibold text-sm text-slate-900">Generated Listing Preview</h4>

            {genResult ? (
              <div className="space-y-4 text-xs">
                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Title</span>
                  <p className="font-bold text-slate-900 text-sm mt-0.5">{genResult.generated_title || genResult.title}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Description</span>
                  <p className="text-slate-600 leading-relaxed mt-0.5">{genResult.description}</p>
                </div>

                <div>
                  <span className="text-[10px] text-slate-400 font-bold uppercase">Key Highlights</span>
                  <ul className="list-disc list-inside text-slate-600 space-y-0.5 mt-0.5">
                    {(genResult.features || []).map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <button
                  onClick={handlePublishGeneratedProduct}
                  className="w-full py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-semibold shadow-xs transition flex items-center justify-center gap-2"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Publish to Live Store Catalog</span>
                </button>
              </div>
            ) : (
              <div className="py-20 text-center text-slate-400 text-xs">
                Fill the seed details on the left and click "Generate Content Draft" to preview.
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 6: INVENTORY & STOCK MANAGEMENT */}
      {activeTab === 'INVENTORY' && (
        <div className="space-y-6">
          {/* Inventory Health KPIs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <KPIStatCard
              title="Tracked SKUs"
              value={inventorySummary?.total_skus ?? sellerProducts.length}
              subtitle="Active listings in store"
              icon={Package}
            />
            <KPIStatCard
              title="Healthy Units"
              value={inventorySummary?.healthy_count ?? 0}
              subtitle="Above reorder threshold"
              icon={CheckCircle2}
              variant="success"
            />
            <KPIStatCard
              title="Low Stock Alert"
              value={inventorySummary?.low_stock_count ?? 0}
              subtitle="≤ Reorder threshold"
              icon={AlertTriangle}
              variant="warning"
            />
            <KPIStatCard
              title="Out of Stock"
              value={inventorySummary?.out_of_stock_count ?? 0}
              subtitle="0 units available"
              icon={X}
              variant="warning"
            />
          </div>

          {/* Controls & Filter Bar */}
          <div className="p-4 bg-white border border-slate-200/80 rounded-xl flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider mr-1">Filter:</span>
              {(['ALL', 'HEALTHY', 'LOW_STOCK', 'OUT_OF_STOCK'] as const).map((filterOption) => (
                <button
                  key={filterOption}
                  onClick={() => setInventoryFilter(filterOption)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                    inventoryFilter === filterOption
                      ? 'bg-slate-900 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {filterOption === 'ALL'
                    ? 'All SKUs'
                    : filterOption === 'HEALTHY'
                    ? 'Healthy'
                    : filterOption === 'LOW_STOCK'
                    ? 'Low Stock'
                    : 'Out of Stock'}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <SearchInput
                value={inventorySearch}
                onChange={setInventorySearch}
                placeholder="Search SKU, product..."
                className="w-full sm:w-64"
              />
              <button
                onClick={() => handleOpenHistoryModal()}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg transition whitespace-nowrap"
              >
                <History className="w-4 h-4 text-slate-600" />
                <span>Audit Trail</span>
              </button>
              {isApproved && (
                <button
                  onClick={handleOpenAddProduct}
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition whitespace-nowrap shadow-xs"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>Add SKU</span>
                </button>
              )}
            </div>
          </div>

          {/* Authoritative Inventory Table */}
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-4 shadow-xs">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="font-semibold text-base text-slate-900">Inventory Status & Real-Time Stock Allocations</h3>
                <p className="text-xs text-slate-500">Live synchronized inventory reflecting customer checkouts and reserved order holdings</p>
              </div>
              <button
                onClick={refreshSellerData}
                className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200 rounded-md transition"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Sync</span>
              </button>
            </div>

            {(() => {
              const items = (inventorySummary?.items || []).filter((item) => {
                // Filter by health status
                if (inventoryFilter !== 'ALL' && item.health_status !== inventoryFilter) {
                  return false;
                }
                // Filter by search
                const term = inventorySearch.toLowerCase().trim();
                if (!term) return true;
                return (
                  item.product_name.toLowerCase().includes(term) ||
                  (item.sku || '').toLowerCase().includes(term) ||
                  (item.category || '').toLowerCase().includes(term) ||
                  item.product_id.toLowerCase().includes(term)
                );
              });

              if (items.length === 0) {
                return (
                  <EmptyState
                    icon={Package}
                    title="No inventory records found"
                    description="No inventory items match your selected filter or search criteria."
                  />
                );
              }

              return (
                <div className="overflow-x-auto">
                  <table className="w-full text-left text-xs">
                    <thead>
                      <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                        <th className="p-3">Product</th>
                        <th className="p-3">SKU</th>
                        <th className="p-3">Category</th>
                        <th className="p-3 text-right">Selling Price</th>
                        <th className="p-3 text-right">In Stock</th>
                        <th className="p-3 text-right">Reserved</th>
                        <th className="p-3 text-right">Available to Sell</th>
                        <th className="p-3 text-center">Health Status</th>
                        <th className="p-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {items.map((it) => (
                        <tr key={it.seller_product_id} className="hover:bg-slate-50/60 transition">
                          <td className="p-3">
                            <div className="flex items-center gap-2.5">
                              <div className="w-9 h-9 rounded-md bg-slate-100 border border-slate-200 overflow-hidden shrink-0 flex items-center justify-center">
                                {it.image_url ? (
                                  <img src={it.image_url} alt={it.product_name} className="w-full h-full object-cover" />
                                ) : (
                                  <Package className="w-4 h-4 text-slate-400" />
                                )}
                              </div>
                              <div>
                                <div className="font-semibold text-slate-900 line-clamp-1">{it.product_name}</div>
                                <div className="text-[10px] font-mono text-slate-400">{it.product_id}</div>
                              </div>
                            </div>
                          </td>
                          <td className="p-3 font-mono text-slate-600 font-medium">{it.sku || 'N/A'}</td>
                          <td className="p-3">
                            <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-700 font-medium">
                              {it.category || 'General'}
                            </span>
                          </td>
                          <td className="p-3 text-right font-mono font-semibold text-slate-900">
                            ₹{it.selling_price.toLocaleString('en-IN')}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-slate-900">{it.stock_quantity}</td>
                          <td className="p-3 text-right font-mono text-amber-600 font-medium">
                            {it.reserved_quantity > 0 ? `${it.reserved_quantity} in orders` : '0'}
                          </td>
                          <td className="p-3 text-right font-mono font-bold text-emerald-700">
                            {it.available_to_sell} units
                          </td>
                          <td className="p-3 text-center">
                            <span
                              className={`inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                                it.health_status === 'HEALTHY'
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                  : it.health_status === 'LOW_STOCK'
                                  ? 'bg-amber-50 text-amber-700 border border-amber-200'
                                  : 'bg-rose-50 text-rose-700 border border-rose-200'
                              }`}
                            >
                              {it.health_status === 'HEALTHY'
                                ? 'Healthy'
                                : it.health_status === 'LOW_STOCK'
                                ? 'Low Stock'
                                : 'Out of Stock'}
                            </span>
                          </td>
                          <td className="p-3 text-right">
                            <button
                              onClick={() => handleOpenAdjustModal(it)}
                              className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-md transition shadow-2xs"
                            >
                              <SlidersHorizontal className="w-3.5 h-3.5 text-slate-600" />
                              <span>Adjust</span>
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* TAB: DEMAND INTELLIGENCE */}
      {activeTab === 'DEMAND' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-4 shadow-xs">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-indigo-600" />
              <div>
                <h3 className="font-semibold text-base text-slate-900">Predictive Demand Forecast & Reorder Engine</h3>
                <p className="text-xs text-slate-500">Machine learning estimations calculated from rolling customer sales velocity</p>
              </div>
            </div>

            {forecasts.length === 0 ? (
              <EmptyState
                icon={TrendingUp}
                title="Insufficient velocity data"
                description="Forecast models require initial customer transaction runs to compute 7-day velocity curves."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead>
                    <tr className="bg-slate-50/80 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                      <th className="p-3">Product Name</th>
                      <th className="p-3">SKU</th>
                      <th className="p-3 text-right">Current Stock</th>
                      <th className="p-3 text-right">7-Day Projected Demand</th>
                      <th className="p-3 text-right">Days of Supply</th>
                      <th className="p-3 text-center">Stockout Risk</th>
                      <th className="p-3">AI Reorder Guidance</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {forecasts.map((f) => (
                      <tr key={f.product_id} className="hover:bg-slate-50/60 transition">
                        <td className="p-3 font-semibold text-slate-900">{f.product_name}</td>
                        <td className="p-3 font-mono text-slate-500">{f.sku}</td>
                        <td className="p-3 text-right font-mono font-bold text-slate-900">{f.current_stock}</td>
                        <td className="p-3 text-right font-medium text-slate-700">{f.forecast_7d} units</td>
                        <td className="p-3 text-right text-slate-600 font-mono">{f.estimated_days_of_supply} days</td>
                        <td className="p-3 text-center">
                          <StatusBadge status={(f.risk_level || f.stockout_risk || 'Normal').toLowerCase()} size="sm" />
                        </td>
                        <td className="p-3 text-slate-600">{f.recommendation}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 7: AI ADVISOR */}
      {activeTab === 'AI_ADVISOR' && (
        <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <Bot className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">AI Storefront Advisor</h3>
              <p className="text-xs text-slate-500">Retrieves real merchant SQL analytics before generating actionable business advice.</p>
            </div>
          </div>

          <form onSubmit={handleAskAdvisor} className="flex gap-2">
            <input
              type="text"
              value={advisorQuestion}
              onChange={(e) => setAdvisorQuestion(e.target.value)}
              placeholder="e.g. How is my store performing? Which items need restocking?"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={advisorLoading}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <Send className="w-3.5 h-3.5" />
              <span>Ask</span>
            </button>
          </form>

          <div className="space-y-4">
            {advisorHistory.map((item, idx) => (
              <div key={idx} className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
                <p className="text-xs font-semibold text-slate-900">Q: "{item.question}"</p>
                <div className="text-xs text-slate-700 whitespace-pre-line leading-relaxed">{item.advice_response}</div>
                <div className="pt-2 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-200">
                  <span>Source: {item.data_source}</span>
                  <span className="font-semibold text-slate-700">Verified Database Telemetry</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 8: RAG KNOWLEDGE */}
      {activeTab === 'RAG_KNOWLEDGE' && (
        <div className="p-6 bg-white border border-slate-200/80 rounded-xl space-y-6 shadow-xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-slate-700">
              <BookOpen className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h3 className="font-semibold text-base text-slate-900">Store Policy Knowledge Base</h3>
              <p className="text-xs text-slate-500">Queries policy documents with tenant isolation.</p>
            </div>
          </div>

          <form onSubmit={handleQueryRAG} className="flex gap-2">
            <input
              type="text"
              value={ragQuery}
              onChange={(e) => setRAGQuery(e.target.value)}
              placeholder="e.g. What is my return policy?"
              className="flex-1 bg-white border border-slate-200 rounded-lg px-4 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
            />
            <button
              type="submit"
              disabled={ragLoading}
              className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg text-xs font-semibold transition shadow-xs flex items-center gap-1.5"
            >
              <FileText className="w-3.5 h-3.5" />
              <span>Query</span>
            </button>
          </form>

          {ragResponse && (
            <div className="p-4 bg-slate-50/80 rounded-xl border border-slate-200/80 space-y-2">
              <div className="flex items-center justify-between text-xs">
                <span className="text-emerald-700 font-semibold">Citation: {ragResponse.citation}</span>
                <span className="px-2 py-0.5 bg-emerald-50 text-emerald-700 rounded border border-emerald-200 text-[10px] font-bold">
                  Tenant Isolated
                </span>
              </div>
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line">{ragResponse.answer}</p>
            </div>
          )}
        </div>
      )}

      {/* TAB: STORE SETTINGS */}
      {activeTab === 'SETTINGS' && (
        <div className="space-y-6">
          <div className="p-6 bg-white border border-slate-200/80 rounded-xl shadow-xs space-y-6">
            <div>
              <h3 className="text-base font-semibold text-slate-900">Store Settings & Merchant Profile</h3>
              <p className="text-xs text-slate-500">Verified storefront identity, business credentials, and fulfillment policies</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Storefront Identity</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Store Name:</span>
                    <span className="font-bold text-slate-900">{mySeller?.store_name || selectedStore?.store_name || 'SHOES SHOP'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Seller ID:</span>
                    <span className="font-mono text-slate-700">{mySeller?.seller_id || selectedStore?.seller_id || 'SEL-1786C4'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Store Category:</span>
                    <span className="font-medium text-slate-800">{mySeller?.store_type || selectedStore?.store_type || 'Footwear & Apparel'}</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Approval Status:</span>
                    <StatusBadge status={mySeller?.approval_status || 'approved'} size="sm" />
                  </div>
                </div>
              </div>

              <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                <h4 className="font-bold text-slate-800 text-xs uppercase tracking-wider">Settlement & Tax Credentials</h4>
                <div className="space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Commission Rate:</span>
                    <span className="font-mono font-bold text-indigo-700">5.0% Platform Fee</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Settlement Currency:</span>
                    <span className="font-mono text-slate-800">INR (₹)</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Settlement Frequency:</span>
                    <span className="font-medium text-slate-800">T+3 Post-Delivery</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">GST Registration:</span>
                    <span className="font-mono text-emerald-700 font-semibold">29ABCDE1234F1Z5</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SPRINT 0.3: MODAL 1 - ADD / EDIT PRODUCT MODAL                        */}
      {/* ===================================================================== */}
      {showProductModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                {modalMode === 'ADD' ? (
                  <>
                    <PlusCircle className="w-5 h-5 text-indigo-600" />
                    <span>Add New Product to Storefront</span>
                  </>
                ) : (
                  <>
                    <Edit2 className="w-5 h-5 text-indigo-600" />
                    <span>Edit Product Listing</span>
                  </>
                )}
              </h3>
              <button
                onClick={() => setShowProductModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {formError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{formError}</span>
              </div>
            )}

            <form onSubmit={handleSaveProduct} className="space-y-4 text-xs">
              {/* Product Images & Upload */}
              <div className="space-y-2 p-4 bg-slate-50 border border-slate-200 rounded-xl">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="block text-slate-800 font-semibold text-xs">Product Images (Up to 5)</label>
                    <p className="text-[11px] text-slate-500">Supported formats: JPEG, PNG, WebP (max 5 MB each). Click star to select primary image.</p>
                  </div>
                  <label className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg cursor-pointer transition shadow-xs">
                    <UploadCloud className="w-4 h-4" />
                    <span>{uploadingImages ? 'Uploading...' : 'Upload Images'}</span>
                    <input
                      type="file"
                      multiple
                      accept="image/jpeg,image/png,image/webp"
                      onChange={handleImageUpload}
                      disabled={uploadingImages || formImages.length >= 5}
                      className="hidden"
                    />
                  </label>
                </div>

                {imageUploadError && (
                  <p className="text-rose-600 text-xs">{imageUploadError}</p>
                )}

                {formImages.length > 0 ? (
                  <div className="grid grid-cols-5 gap-3 pt-2">
                    {formImages.map((imgUrl, idx) => (
                      <div
                        key={idx}
                        className={`relative group aspect-square rounded-lg border-2 overflow-hidden bg-white shadow-xs ${
                          formPrimaryIndex === idx ? 'border-indigo-600 ring-2 ring-indigo-200' : 'border-slate-200'
                        }`}
                      >
                        <img src={imgUrl} alt={`Product ${idx + 1}`} className="w-full h-full object-cover" />
                        <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col justify-between p-1.5">
                          <div className="flex justify-between items-center">
                            <button
                              type="button"
                              onClick={() => handleSetPrimaryImage(idx)}
                              title={formPrimaryIndex === idx ? 'Primary image' : 'Set as primary'}
                              className={`p-1 rounded-md text-xs font-bold ${
                                formPrimaryIndex === idx ? 'bg-indigo-600 text-white' : 'bg-white/80 hover:bg-white text-slate-800'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${formPrimaryIndex === idx ? 'fill-white' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRemoveImage(idx)}
                              title="Remove image"
                              className="p-1 rounded-md bg-rose-600 hover:bg-rose-700 text-white"
                            >
                              <X className="w-3.5 h-3.5" />
                            </button>
                          </div>
                          {formPrimaryIndex === idx && (
                            <span className="text-[9px] bg-indigo-600 text-white px-1.5 py-0.5 rounded text-center font-bold">
                              PRIMARY
                            </span>
                          )}
                        </div>
                        {formPrimaryIndex === idx && (
                          <div className="absolute bottom-1 left-1 bg-indigo-600 text-white text-[9px] font-bold px-1 rounded shadow-xs">
                            ★ Primary
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="py-6 border-2 border-dashed border-slate-300 rounded-lg flex flex-col items-center justify-center text-slate-400 gap-1">
                    <ImageIcon className="w-8 h-8 text-slate-300" />
                    <span>No product images uploaded yet</span>
                  </div>
                )}
              </div>

              {/* Title & Permitted Category */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Product Title *</label>
                  <input
                    type="text"
                    required
                    value={formName}
                    onChange={(e) => setFormName(e.target.value)}
                    placeholder="e.g. Italian Leather Formal Shoes"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Store Category *
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(Store permitted only)</span>
                  </label>
                  <select
                    required
                    value={formCategory}
                    onChange={(e) => setFormCategory(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  >
                    {permittedCategories.map((cat) => (
                      <option key={cat} value={cat}>
                        {cat}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Subcategory & Brand */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Subcategory</label>
                  <input
                    type="text"
                    value={formSubcategory}
                    onChange={(e) => setFormSubcategory(e.target.value)}
                    placeholder="e.g. Oxford, Loafers, Casual"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Brand / Label</label>
                  <input
                    type="text"
                    value={formBrand}
                    onChange={(e) => setFormBrand(e.target.value)}
                    placeholder="e.g. Bata, Clark's, or your store name"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* SKU & Listing Status */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    SKU Code
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(Autogenerated if empty)</span>
                  </label>
                  <input
                    type="text"
                    value={formSku}
                    onChange={(e) => setFormSku(e.target.value)}
                    placeholder="e.g. SHOE-BRN-42"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Listing Status</label>
                  <select
                    value={formStatus}
                    onChange={(e) => setFormStatus(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  >
                    <option value="active">Active (Visible in Catalog)</option>
                    <option value="paused">Paused (Temporarily Hidden)</option>
                    <option value="draft">Draft (Unpublished)</option>
                  </select>
                </div>
              </div>

              {/* Pricing & Stock */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Selling Price (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    value={formPrice}
                    onChange={(e) => setFormPrice(e.target.value)}
                    placeholder="2999"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono font-bold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Sale / Discount Price (₹)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formDiscountPrice}
                    onChange={(e) => setFormDiscountPrice(e.target.value)}
                    placeholder="Optional sale price"
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                <div>
                  <label className="block text-slate-700 font-semibold mb-1">Initial Stock Quantity *</label>
                  <input
                    type="number"
                    min="0"
                    required
                    value={formStock}
                    onChange={(e) => setFormStock(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Low Stock Threshold */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-slate-700 font-semibold mb-1">
                    Low-Stock Alert Threshold
                    <span className="text-[10px] text-slate-400 font-normal ml-1">(Default: 10 units)</span>
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={formThreshold}
                    onChange={(e) => setFormThreshold(e.target.value)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>
              </div>

              {/* Description */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Product Description & Specs</label>
                <textarea
                  rows={3}
                  value={formDescription}
                  onChange={(e) => setFormDescription(e.target.value)}
                  placeholder="Material, dimensions, care instructions, warranty..."
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Form Action Buttons */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowProductModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={formSubmitting || uploadingImages}
                  className="px-5 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {formSubmitting
                    ? 'Saving...'
                    : modalMode === 'ADD'
                    ? 'Publish Product Listing'
                    : 'Update Product'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SPRINT 0.3: MODAL 2 - PRODUCT DETAIL MODAL                            */}
      {/* ===================================================================== */}
      {showDetailModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900">Product Details & Performance</h3>
                <p className="text-xs text-slate-500 font-mono">
                  {selectedProductDetail?.sku || selectedProductDetail?.product_id}
                </p>
              </div>
              <button
                onClick={() => setShowDetailModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {detailLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSkeleton type="card" count={2} />
              </div>
            ) : selectedProductDetail ? (
              <div className="space-y-4 text-xs">
                {/* Images Gallery */}
                {selectedProductDetail.images && selectedProductDetail.images.length > 0 && (
                  <div className="space-y-2">
                    <div className="w-full h-56 rounded-xl bg-slate-100 border border-slate-200 overflow-hidden flex items-center justify-center">
                      <img
                        src={selectedProductDetail.images[detailActiveImgIndex]?.image_url || selectedProductDetail.primary_image_url}
                        alt={selectedProductDetail.product_name}
                        className="max-h-full max-w-full object-contain"
                      />
                    </div>
                    {selectedProductDetail.images.length > 1 && (
                      <div className="flex gap-2 overflow-x-auto pb-1">
                        {selectedProductDetail.images.map((img, idx) => (
                          <button
                            key={img.image_id}
                            type="button"
                            onClick={() => setDetailActiveImgIndex(idx)}
                            className={`w-14 h-14 rounded-lg border-2 overflow-hidden shrink-0 transition ${
                              detailActiveImgIndex === idx ? 'border-indigo-600' : 'border-slate-200 opacity-70 hover:opacity-100'
                            }`}
                          >
                            <img src={img.image_url} alt="" className="w-full h-full object-cover" />
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Core Info */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-500 block">Selling Price</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      ₹{selectedProductDetail.selling_price.toLocaleString('en-IN')}
                    </span>
                    {selectedProductDetail.discount_price && (
                      <span className="text-[10px] text-emerald-600 font-mono block">
                        Discount: ₹{selectedProductDetail.discount_price.toLocaleString('en-IN')}
                      </span>
                    )}
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-500 block">Available to Sell</span>
                    <span className="text-sm font-bold font-mono text-emerald-700">
                      {selectedProductDetail.available_to_sell} units
                    </span>
                    <span className="text-[10px] text-slate-400 block">
                      Total: {selectedProductDetail.stock_quantity}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-500 block">Units Sold</span>
                    <span className="text-sm font-bold font-mono text-slate-900">
                      {selectedProductDetail.units_sold} units
                    </span>
                    <span className="text-[10px] text-slate-500 font-mono block">
                      Revenue: ₹{selectedProductDetail.total_revenue.toLocaleString('en-IN')}
                    </span>
                  </div>

                  <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl">
                    <span className="text-[11px] text-slate-500 block">Rating</span>
                    <div className="flex items-center gap-1 font-bold text-amber-500">
                      <Star className="w-3.5 h-3.5 fill-amber-400 stroke-amber-400" />
                      <span>{selectedProductDetail.rating_average || 0} / 5</span>
                    </div>
                    <span className="text-[10px] text-slate-400 block">
                      {selectedProductDetail.rating_count} reviews
                    </span>
                  </div>
                </div>

                {/* Additional Specs */}
                <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Product Name</span>
                    <span className="font-semibold text-slate-900">{selectedProductDetail.product_name}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Category / Subcategory</span>
                    <span className="font-medium text-slate-800">
                      {selectedProductDetail.category} • {selectedProductDetail.subcategory || 'General'}
                    </span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Brand</span>
                    <span className="font-medium text-slate-800">{selectedProductDetail.brand || 'Generic'}</span>
                  </div>
                  <div className="flex justify-between py-1 border-b border-slate-200">
                    <span className="text-slate-500">Reserved in Active Customer Orders</span>
                    <span className="font-mono font-bold text-amber-600">{selectedProductDetail.reserved_quantity} units</span>
                  </div>
                  <div className="flex justify-between py-1">
                    <span className="text-slate-500">Low-Stock Alert Reorder Threshold</span>
                    <span className="font-mono font-medium text-slate-800">{selectedProductDetail.low_stock_threshold} units</span>
                  </div>
                </div>

                {selectedProductDetail.description && (
                  <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                    <span className="text-slate-700 font-semibold block">Description & Specifications</span>
                    <p className="text-slate-600 leading-relaxed whitespace-pre-line">
                      {selectedProductDetail.description}
                    </p>
                  </div>
                )}

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenEditProduct(selectedProductDetail);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 font-semibold rounded-lg transition"
                  >
                    <Edit2 className="w-4 h-4" />
                    <span>Edit Listing</span>
                  </button>
                  <button
                    onClick={() => {
                      setShowDetailModal(false);
                      handleOpenAdjustModal(selectedProductDetail);
                    }}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold rounded-lg transition shadow-xs"
                  >
                    <SlidersHorizontal className="w-4 h-4" />
                    <span>Adjust Stock</span>
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SPRINT 0.3: MODAL 3 - STOCK ADJUSTMENT MODAL                          */}
      {/* ===================================================================== */}
      {showAdjustModal && adjustProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <SlidersHorizontal className="w-5 h-5 text-emerald-600" />
                  <span>Adjust Stock Inventory</span>
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {adjustProduct.product_name} • {adjustProduct.sku || adjustProduct.product_id}
                </p>
              </div>
              <button
                onClick={() => setShowAdjustModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {adjustError && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-xl flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>{adjustError}</span>
              </div>
            )}

            <form onSubmit={handleConfirmAdjust} className="space-y-4 text-xs">
              {/* Current Stock Banner */}
              <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between">
                <span className="text-slate-600 font-medium">Current Stock on Record:</span>
                <span className="text-base font-bold font-mono text-slate-900">
                  {adjustProduct.stock_quantity ?? 0} units
                </span>
              </div>

              {/* Adjustment Type */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">Adjustment Type *</label>
                <select
                  value={adjustType}
                  onChange={(e) => {
                    const nextType = e.target.value;
                    setAdjustType(nextType);
                    // Helpful defaults
                    if (nextType === 'damage') {
                      setAdjustQtyChange(-1);
                    } else if (nextType === 'restock' || nextType === 'return') {
                      setAdjustQtyChange(10);
                    }
                  }}
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-medium focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                >
                  <option value="restock">Restock / Received Inward Shipment (+)</option>
                  <option value="damage">Damaged / Expired / Spoiled Goods (-)</option>
                  <option value="return">Customer Return / Re-shelved (+)</option>
                  <option value="audit_reconciliation">Physical Audit Count Reconciliation (+/-)</option>
                  <option value="correction">Inventory Correction / Manual Balance (+/-)</option>
                </select>
              </div>

              {/* Quantity Change & Presets */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Quantity Change Amount *
                  <span className="text-[10px] text-slate-400 font-normal ml-1">
                    (Use positive to increase, negative to decrease)
                  </span>
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="number"
                    required
                    value={adjustQtyChange}
                    onChange={(e) => setAdjustQtyChange(parseInt(e.target.value, 10) || 0)}
                    className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono font-bold text-sm focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* Quick Presets */}
                <div className="flex items-center gap-1.5 mt-2">
                  <span className="text-[11px] text-slate-400 mr-1">Presets:</span>
                  {[5, 10, 25, 50].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAdjustQtyChange(num)}
                      className="px-2 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 text-[11px] font-mono font-semibold transition"
                    >
                      +{num}
                    </button>
                  ))}
                  {[-1, -5, -10].map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setAdjustQtyChange(num)}
                      className="px-2 py-0.5 rounded bg-rose-50 hover:bg-rose-100 text-rose-700 text-[11px] font-mono font-semibold transition"
                    >
                      {num}
                    </button>
                  ))}
                </div>
              </div>

              {/* Calculated Result Preview */}
              {(() => {
                const current = adjustProduct.stock_quantity ?? 0;
                const finalStock = current + adjustQtyChange;
                const isNegative = finalStock < 0;
                return (
                  <div
                    className={`p-3 rounded-xl border flex items-center justify-between text-xs font-medium ${
                      isNegative
                        ? 'bg-rose-50 border-rose-300 text-rose-800'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    }`}
                  >
                    <span>Stock Adjustment Preview:</span>
                    <span className="font-mono font-bold text-sm">
                      {current} {adjustQtyChange >= 0 ? '+' : '-'} {Math.abs(adjustQtyChange)} = {finalStock} units
                    </span>
                  </div>
                );
              })()}

              {/* Reason */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Reason for Adjustment *
                  <span className="text-[10px] text-slate-400 font-normal ml-1">(Recorded in immutable audit trail)</span>
                </label>
                <input
                  type="text"
                  required
                  minLength={3}
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="e.g. Inward supplier delivery PO-9812, physical warehouse count mismatch"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Order Reference */}
              <div>
                <label className="block text-slate-700 font-semibold mb-1">
                  Order / PO Reference (Optional)
                </label>
                <input
                  type="text"
                  value={adjustOrderRef}
                  onChange={(e) => setAdjustOrderRef(e.target.value)}
                  placeholder="e.g. INVOICE-8472 or PO-302"
                  className="w-full bg-white border border-slate-300 rounded-lg p-2.5 text-slate-900 font-mono focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                />
              </div>

              {/* Actions */}
              <div className="flex justify-end gap-3 pt-3 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setShowAdjustModal(false)}
                  className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={adjustSubmitting || (adjustProduct.stock_quantity ?? 0) + adjustQtyChange < 0}
                  className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-semibold shadow-xs transition disabled:opacity-50"
                >
                  {adjustSubmitting ? 'Adjusting...' : 'Commit Stock Adjustment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SPRINT 0.3: MODAL 4 - INVENTORY HISTORY AUDIT MODAL                   */}
      {/* ===================================================================== */}
      {showHistoryModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-4xl w-full p-6 space-y-4 shadow-2xl my-8">
            <div className="flex items-center justify-between pb-3 border-b border-slate-200">
              <div>
                <h3 className="text-base font-semibold text-slate-900 flex items-center gap-2">
                  <History className="w-5 h-5 text-indigo-600" />
                  <span>Inventory Movement Audit Trail</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Chronological records of inward stock, adjustments, checkouts, and damage writes
                </p>
              </div>
              <button
                onClick={() => setShowHistoryModal(false)}
                className="p-1 text-slate-400 hover:text-slate-600 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {historyLoading ? (
              <div className="py-12 flex justify-center">
                <LoadingSkeleton type="card" count={3} />
              </div>
            ) : historyList.length === 0 ? (
              <EmptyState
                icon={History}
                title="No movement history recorded"
                description="Inventory changes made via restocks, adjustments, or orders will appear here chronologically."
              />
            ) : (
              <div className="overflow-x-auto max-h-[60vh]">
                <table className="w-full text-left text-xs">
                  <thead className="sticky top-0 bg-slate-50 border-b border-slate-200 text-slate-500 uppercase font-semibold">
                    <tr>
                      <th className="p-2.5">Date & Time</th>
                      <th className="p-2.5">Product & SKU</th>
                      <th className="p-2.5 text-center">Type</th>
                      <th className="p-2.5 text-right">Change</th>
                      <th className="p-2.5 text-right">Resulting Balance</th>
                      <th className="p-2.5">Reason & Reference</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {historyList.map((h) => (
                      <tr key={h.inventory_snapshot_id} className="hover:bg-slate-50/60 transition">
                        <td className="p-2.5 text-slate-500 whitespace-nowrap">
                          {h.created_at ? new Date(h.created_at).toLocaleString() : 'Recent'}
                        </td>
                        <td className="p-2.5">
                          <div className="font-semibold text-slate-900">{h.product_name}</div>
                          <div className="text-[10px] font-mono text-slate-400">{h.sku || h.product_id}</div>
                        </td>
                        <td className="p-2.5 text-center">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold uppercase ${
                              h.adjustment_type === 'restock' || h.adjustment_type === 'seller_creation'
                                ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                                : h.adjustment_type === 'damage'
                                ? 'bg-rose-50 text-rose-700 border border-rose-200'
                                : 'bg-slate-100 text-slate-700 border border-slate-200'
                            }`}
                          >
                            {h.adjustment_type || 'Adjustment'}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold">
                          <span
                            className={
                              (h.quantity_change ?? 0) >= 0 ? 'text-emerald-600' : 'text-rose-600'
                            }
                          >
                            {(h.quantity_change ?? 0) >= 0 ? `+${h.quantity_change}` : h.quantity_change}
                          </span>
                        </td>
                        <td className="p-2.5 text-right font-mono font-bold text-slate-900">
                          {h.new_quantity ?? '—'} units
                        </td>
                        <td className="p-2.5 text-slate-600">
                          <div>{h.adjustment_reason || 'Manual inventory update'}</div>
                          {h.order_reference && (
                            <div className="text-[10px] font-mono text-indigo-600">Ref: {h.order_reference}</div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <div className="flex justify-end pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setShowHistoryModal(false)}
                className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-lg font-semibold transition"
              >
                Close Audit Log
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* SPRINT 0.3: MODAL 5 - ARCHIVE CONFIRMATION MODAL                      */}
      {/* ===================================================================== */}
      {showArchiveModal && archiveProduct && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-fade-in">
          <div className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center gap-3 text-rose-600">
              <div className="w-10 h-10 rounded-xl bg-rose-50 flex items-center justify-center shrink-0">
                <Archive className="w-5 h-5 text-rose-600" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Archive Product Listing?</h3>
                <p className="text-xs text-slate-500">Safely remove from active customer storefront</p>
              </div>
            </div>

            <div className="p-3 bg-amber-50 border border-amber-200 rounded-xl text-amber-800 text-xs space-y-1">
              <p className="font-semibold">Authoritative Archival Policy:</p>
              <p className="text-[11px] leading-relaxed">
                Archiving sets status to <span className="font-mono font-bold">removed</span>. The product will no longer appear in customer search or catalogs, but historical order items, financial transactions, and reviews remain fully preserved.
              </p>
            </div>

            <div className="p-3 bg-slate-50 border border-slate-200 rounded-xl text-xs space-y-1">
              <div className="flex justify-between">
                <span className="text-slate-500">Product:</span>
                <span className="font-semibold text-slate-900">{archiveProduct.product_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">SKU / ID:</span>
                <span className="font-mono text-slate-700">{archiveProduct.sku || archiveProduct.product_id}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Current Stock:</span>
                <span className="font-mono font-bold text-slate-900">{archiveProduct.stock_quantity ?? 0} units</span>
              </div>
            </div>

            <div className="flex justify-end gap-3 pt-2">
              <button
                type="button"
                onClick={() => setShowArchiveModal(false)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg font-semibold transition"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={archiveSubmitting}
                onClick={handleConfirmArchive}
                className="px-5 py-2 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-semibold shadow-xs transition disabled:opacity-50"
              >
                {archiveSubmitting ? 'Archiving...' : 'Confirm Archival'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
