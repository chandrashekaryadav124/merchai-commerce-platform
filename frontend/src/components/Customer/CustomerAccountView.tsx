import { useState, useEffect } from 'react';
import {
  User as UserIcon,
  Truck,
  CreditCard,
  Star,
  ChevronRight,
  RefreshCw,
  Award,
  Package,
  Calendar,
  CheckCircle2,
  Clock,
  AlertCircle,
  PlusCircle,
  LogIn,
  X,
  MapPin,
  Plus,
  Trash2,
  Edit3,
  TrendingUp,
  PieChart as PieIcon,
  ShieldCheck
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
  CartesianGrid
} from 'recharts';
import type {
  User as UserType,
  CustomerAddress,
  CustomerFinancialOverview,
  CustomerSpendingTrendPoint
} from '../../types';
import {
  fetchCustomerAccountProfile,
  fetchCustomerAccountSummary,
  fetchCustomerAccountOrders,
  fetchCustomerAccountOrderDetail,
  fetchCustomerAccountShipments,
  fetchCustomerAccountPayments,
  fetchCustomerAccountReturns,
  fetchCustomerAccountReviews,
  createCustomerAccountReview,
  fetchCustomerAccountTickets,
  createCustomerAccountTicket,
  fetchCustomerAddresses,
  createCustomerAddress,
  updateCustomerAddress,
  deleteCustomerAddress,
  setDefaultCustomerAddress,
  fetchCustomerFinancialOverview,
  fetchCustomerSpendingTrend
} from '../../services/api';
import { CustomerOrderTrackingModal } from './CustomerOrderTrackingModal';

interface CustomerAccountViewProps {
  currentUser?: UserType | null;
  onOpenAuth?: () => void;
  activeSubTab?: string;
}

export function CustomerAccountView({ currentUser, onOpenAuth, activeSubTab }: CustomerAccountViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'orders' | 'addresses' | 'shipments' | 'payments' | 'returns' | 'reviews' | 'support'>('overview');
  const [trackingOrderId, setTrackingOrderId] = useState<string | null>(null);

  useEffect(() => {
    if (!activeSubTab) return;
    const tabMap: Record<string, 'overview' | 'orders' | 'addresses' | 'shipments' | 'payments' | 'returns' | 'reviews' | 'support'> = {
      overview: 'overview',
      orders: 'orders',
      tracking: 'shipments',
      shipments: 'shipments',
      payments: 'payments',
      returns: 'returns',
      reviews: 'reviews',
      addresses: 'addresses',
      account: 'addresses',
      support: 'support'
    };
    const target = tabMap[activeSubTab.toLowerCase()];
    if (target) setActiveTab(target);
  }, [activeSubTab]);
  
  // State
  const [profile, setProfile] = useState<any>(null);
  const [summary, setSummary] = useState<any>(null);
  const [ordersData, setOrdersData] = useState<any>({ total: 0, page: 1, limit: 10, pages: 1, items: [] });
  const [shipments, setShipments] = useState<any[]>([]);
  const [payments, setPayments] = useState<any[]>([]);
  const [returnsList, setReturnsList] = useState<any[]>([]);
  const [reviewsList, setReviewsList] = useState<any[]>([]);
  const [supportTickets, setSupportTickets] = useState<any[]>([]);

  const [addresses, setAddresses] = useState<CustomerAddress[]>([]);
  const [isAddressModalOpen, setIsAddressModalOpen] = useState(false);
  const [addressModalMode, setAddressModalMode] = useState<'create' | 'edit'>('create');
  const [editingAddressId, setEditingAddressId] = useState<number | null>(null);
  const [addressForm, setAddressForm] = useState({
    recipient_name: '',
    phone_number: '',
    address_line1: '',
    address_line2: '',
    city: '',
    state: '',
    postal_code: '',
    is_default: false
  });
  const [addressFormError, setAddressFormError] = useState<string | null>(null);
  const [isSavingAddress, setIsSavingAddress] = useState(false);

  // Filter & Pagination state
  const [page, setPage] = useState<number>(1);
  const [orderStatusFilter, setOrderStatusFilter] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<any>(null);

  // Financial & Transactions Analytics State
  const [financialOverview, setFinancialOverview] = useState<CustomerFinancialOverview | null>(null);
  const [spendingTrend, setSpendingTrend] = useState<CustomerSpendingTrendPoint[]>([]);
  const [paymentStatusFilter, setPaymentStatusFilter] = useState<string>('all');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState<string>('all');
  
  // Review creation state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [newReviewProdId, setNewReviewProdId] = useState('');
  const [newReviewRating, setNewReviewRating] = useState(5);
  const [newReviewTitle, setNewReviewTitle] = useState('');
  const [newReviewText, setNewReviewText] = useState('');

  // Ticket creation state
  const [isTicketModalOpen, setIsTicketModalOpen] = useState(false);
  const [newTicketOrderId, setNewTicketOrderId] = useState('');
  const [newTicketIssueType, setNewTicketIssueType] = useState('delivery_delay');
  const [newTicketMessage, setNewTicketMessage] = useState('');

  // Loading & Error states
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadAccountData();
  }, []);

  useEffect(() => {
    if (activeTab === 'orders') {
      loadOrders(page, orderStatusFilter);
    }
  }, [page, orderStatusFilter, activeTab]);

  const loadAccountData = async () => {
    const token = localStorage.getItem('access_token');
    if (!token && !currentUser) {
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);
    try {
      const [profRes, sumRes, shipRes, payRes, retRes, revRes, tickRes, addrRes, finRes, trendRes] = await Promise.all([
        fetchCustomerAccountProfile().catch((err) => {
          console.warn('Profile fetch warning:', err);
          return null;
        }),
        fetchCustomerAccountSummary().catch((err) => {
          console.warn('Summary fetch warning:', err);
          return null;
        }),
        fetchCustomerAccountShipments().catch(() => []),
        fetchCustomerAccountPayments().catch(() => []),
        fetchCustomerAccountReturns().catch(() => []),
        fetchCustomerAccountReviews().catch(() => []),
        fetchCustomerAccountTickets().catch(() => []),
        fetchCustomerAddresses().catch(() => []),
        fetchCustomerFinancialOverview().catch(() => null),
        fetchCustomerSpendingTrend().catch(() => [])
      ]);

      setProfile(profRes);
      setSummary(sumRes);
      setShipments(shipRes);
      setPayments(payRes);
      setReturnsList(retRes);
      setReviewsList(revRes);
      setSupportTickets(tickRes);
      setAddresses(addrRes);
      setFinancialOverview(finRes);
      setSpendingTrend(trendRes);
    } catch (err: any) {
      setError(err.message || 'Failed to load customer account information.');
    } finally {
      setLoading(false);
    }
  };

  const handleOpenAddAddress = () => {
    setAddressModalMode('create');
    setEditingAddressId(null);
    setAddressForm({
      recipient_name: currentUser?.full_name || '',
      phone_number: '',
      address_line1: '',
      address_line2: '',
      city: '',
      state: '',
      postal_code: '',
      is_default: addresses.length === 0
    });
    setAddressFormError(null);
    setIsAddressModalOpen(true);
  };

  const handleOpenEditAddress = (addr: CustomerAddress) => {
    setAddressModalMode('edit');
    setEditingAddressId(addr.address_id);
    setAddressForm({
      recipient_name: addr.recipient_name,
      phone_number: addr.phone_number,
      address_line1: addr.address_line1,
      address_line2: addr.address_line2 || '',
      city: addr.city,
      state: addr.state,
      postal_code: addr.postal_code,
      is_default: addr.is_default
    });
    setAddressFormError(null);
    setIsAddressModalOpen(true);
  };

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    setAddressFormError(null);

    // Validation
    if (!addressForm.recipient_name.trim()) {
      setAddressFormError('Please enter recipient full name.');
      return;
    }
    const cleanPhone = addressForm.phone_number.replace(/\D/g, '');
    if (cleanPhone.length < 10 || cleanPhone.length > 12) {
      setAddressFormError('Please provide a valid 10-digit Indian phone number.');
      return;
    }
    if (!addressForm.address_line1.trim()) {
      setAddressFormError('Please enter street address / house details.');
      return;
    }
    if (!addressForm.city.trim()) {
      setAddressFormError('Please enter city.');
      return;
    }
    if (!addressForm.state.trim()) {
      setAddressFormError('Please enter state.');
      return;
    }
    const cleanPin = addressForm.postal_code.trim().replace(/\s/g, '');
    if (!/^[1-9][0-9]{5}$/.test(cleanPin)) {
      setAddressFormError('Please enter a valid 6-digit Indian postal PIN code (e.g. 560001).');
      return;
    }

    setIsSavingAddress(true);
    try {
      if (addressModalMode === 'create') {
        await createCustomerAddress({
          ...addressForm,
          postal_code: cleanPin
        });
      } else if (editingAddressId) {
        await updateCustomerAddress(editingAddressId, {
          ...addressForm,
          postal_code: cleanPin
        });
      }
      setIsAddressModalOpen(false);
      const updatedAddrs = await fetchCustomerAddresses();
      setAddresses(updatedAddrs);
    } catch (err: any) {
      setAddressFormError(err.message || 'Failed to save address.');
    } finally {
      setIsSavingAddress(false);
    }
  };

  const handleDeleteAddress = async (id: number) => {
    if (!confirm('Are you sure you want to delete this delivery address?')) return;
    try {
      await deleteCustomerAddress(id);
      const updatedAddrs = await fetchCustomerAddresses();
      setAddresses(updatedAddrs);
    } catch (err: any) {
      alert(err.message || 'Failed to delete address');
    }
  };

  const handleSetDefaultAddress = async (id: number) => {
    try {
      await setDefaultCustomerAddress(id);
      const updatedAddrs = await fetchCustomerAddresses();
      setAddresses(updatedAddrs);
    } catch (err: any) {
      alert(err.message || 'Failed to update default address');
    }
  };

  const loadOrders = async (pageNum: number, statusFilt: string) => {
    try {
      const data = await fetchCustomerAccountOrders(pageNum, 10, statusFilt || undefined);
      setOrdersData(data);
    } catch (err: any) {
      console.error('Failed to load orders:', err);
    }
  };

  const handleOpenOrderDetail = async (orderId: string) => {
    try {
      const detail = await fetchCustomerAccountOrderDetail(orderId);
      setSelectedOrder(detail);
    } catch (err: any) {
      alert(err.message || 'Failed to fetch order details');
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newReviewProdId || !newReviewTitle || !newReviewText) return;
    try {
      const created = await createCustomerAccountReview({
        product_id: newReviewProdId,
        rating: newReviewRating,
        review_title: newReviewTitle,
        review_text: newReviewText
      });
      setReviewsList(prev => [created, ...prev]);
      setIsReviewModalOpen(false);
      setNewReviewTitle('');
      setNewReviewText('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit review');
    }
  };

  const handleSubmitTicket = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTicketMessage) return;
    try {
      const created = await createCustomerAccountTicket({
        order_id: newTicketOrderId || undefined,
        issue_type: newTicketIssueType,
        customer_message: newTicketMessage
      });
      setSupportTickets(prev => [created, ...prev]);
      setIsTicketModalOpen(false);
      setNewTicketMessage('');
      setNewTicketOrderId('');
    } catch (err: any) {
      alert(err.message || 'Failed to submit support ticket');
    }
  };

  const displayName = profile?.full_name || currentUser?.full_name || 'Customer Account';
  const displayEmail = profile?.email || currentUser?.email || 'N/A';
  const displayCustomerId = profile?.customer_id || currentUser?.user_id || 'Unassigned';

  const isAuthenticated = !!(localStorage.getItem('access_token') || currentUser);

  if (!isAuthenticated && !loading) {
    return (
      <div className="my-12 max-w-lg mx-auto p-8 bg-white border border-[#DCEAF0] rounded-3xl text-center space-y-4 shadow-xl">
        <div className="w-14 h-14 bg-[#DCEAF0] border border-[#567C8D]/30 rounded-2xl flex items-center justify-center mx-auto text-[#14213D]">
          <UserIcon className="w-7 h-7" />
        </div>
        <h2 className="text-xl font-bold text-[#14213D]">Authentication Required</h2>
        <p className="text-sm text-[#667085] leading-relaxed">
          Please sign in to access your verified <span className="font-semibold text-[#14213D]">Customer Account</span>, inspect order history, track live shipments, and access support.
        </p>
        {onOpenAuth && (
          <div className="pt-2">
            <button
              onClick={onOpenAuth}
              className="px-6 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-md inline-flex items-center space-x-2 cursor-pointer"
            >
              <LogIn className="w-4 h-4 text-[#FCA311]" />
              <span>Sign In / Register</span>
            </button>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-16">
      
      {/* ACCOUNT TOP HEADER */}
      <div className="bg-[#14213D] border border-[#233554] p-6 md:p-8 rounded-3xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6 text-white">
        <div className="flex items-center space-x-4">
          <div className="w-16 h-16 rounded-2xl bg-[#FCA311] p-0.5 shadow-md">
            <div className="w-full h-full bg-[#14213D] rounded-[14px] flex items-center justify-center text-[#FCA311]">
              <UserIcon className="w-8 h-8" />
            </div>
          </div>
          <div>
            <div className="flex items-center space-x-2.5">
              <h1 className="text-2xl font-bold text-white font-['Space_Grotesk']">{displayName}</h1>
              <span className={`px-2.5 py-0.5 text-xs font-bold rounded-full border ${
                profile?.loyalty_tier === 'Gold' ? 'bg-[#FFF7EB] text-[#B45309] border-[#FCA311]' :
                profile?.loyalty_tier === 'Silver' ? 'bg-[#F1F5F9] text-[#475569] border-[#CBD5E1]' :
                'bg-emerald-50 text-[#15803D] border-emerald-300'
              }`}>
                <Award className="w-3.5 h-3.5 inline mr-1 text-[#FCA311]" />
                {profile?.loyalty_tier || 'Bronze'} Member
              </span>
            </div>
            <p className="text-xs text-[#DCEAF0]/80 mt-1 flex flex-wrap items-center gap-2">
              <span>Email: <code className="text-white font-mono">{displayEmail}</code></span>
              <span>•</span>
              <span>Customer ID: <code className="text-[#87CEEB] font-mono">{displayCustomerId}</code></span>
            </p>
          </div>
        </div>

        <button
          onClick={loadAccountData}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-semibold transition border border-white/15 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Account</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-[#B42318] text-xs flex items-center space-x-2">
          <AlertCircle className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}



      {/* TAB 1: OVERVIEW & DASHBOARD */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          {/* SUMMARY STATS GRID */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Total Lifetime Spend</span>
                <CreditCard className="w-4 h-4 text-[#15803D]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">₹{(summary?.total_spend || 0).toLocaleString('en-IN')}</p>
              <span className="text-[11px] text-[#15803D] font-bold">Verified Customer</span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Total Orders Placed</span>
                <Package className="w-4 h-4 text-[#567C8D]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">{summary?.total_orders || 0}</p>
              <span className="text-[11px] text-[#567C8D] font-semibold">{summary?.completed_orders_count || 0} Delivered</span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Active Orders In Transit</span>
                <Clock className="w-4 h-4 text-[#567C8D]" />
              </div>
              <p className="text-2xl font-extrabold text-[#14213D]">{summary?.active_orders_count || 0}</p>
              <span className="text-[11px] text-[#567C8D] font-semibold">Live courier sync</span>
            </div>

            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
              <div className="flex justify-between items-center text-[#667085] text-xs">
                <span>Loyalty Tier</span>
                <Award className="w-4 h-4 text-[#FCA311]" />
              </div>
              <p className="text-2xl font-extrabold text-[#B45309]">{summary?.loyalty_tier || 'Bronze'}</p>
              <span className="text-[11px] text-[#667085] font-semibold">Segment: {summary?.customer_segment || 'Regular'}</span>
            </div>
          </div>

          {/* PROFILE DETAILS & RECENT ACTIVITY GRID */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
            {/* PROFILE CARD */}
            <div className="lg:col-span-5 p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
              <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2">
                <UserIcon className="w-5 h-5 text-[#567C8D]" />
                <span>Customer Profile Details</span>
              </h3>
              <div className="space-y-3 text-xs divide-y divide-[#F5F1E8]">
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Full Name</span>
                  <span className="font-bold text-[#14213D]">{displayName}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Email Address</span>
                  <span className="font-mono text-[#14213D]">{displayEmail}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Customer ID</span>
                  <span className="font-mono text-[#567C8D] font-bold">{displayCustomerId}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Primary Delivery City</span>
                  <span className="text-[#14213D] font-semibold">{profile?.city || 'Bengaluru'}, {profile?.state || 'Karnataka'}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Customer Segment</span>
                  <span className="text-[#14213D] font-semibold">{profile?.customer_segment || 'Regular'}</span>
                </div>
                <div className="pt-2 flex justify-between">
                  <span className="text-[#667085]">Average Order Value (AOV)</span>
                  <span className="font-bold text-[#15803D]">₹{(profile?.average_order_value || 0).toLocaleString('en-IN')}</span>
                </div>
              </div>
            </div>

            {/* RECENT ACTIVITY TIMELINE */}
            <div className="lg:col-span-7 p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
              <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2">
                <Calendar className="w-5 h-5 text-[#567C8D]" />
                <span>Recent Account Orders & Activity</span>
              </h3>
              {summary?.recent_activity?.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#667085]">No recent activity records found.</div>
              ) : (
                <div className="space-y-3">
                  {summary?.recent_activity?.map((act: any, idx: number) => (
                    <div key={idx} className="p-3.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-2xl flex items-center justify-between text-xs">
                      <div className="flex items-center space-x-3">
                        <CheckCircle2 className="w-4 h-4 text-[#15803D] shrink-0" />
                        <span className="text-[#14213D] font-semibold">{act.event}</span>
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-[#14213D]">₹{act.amount?.toLocaleString('en-IN')}</span>
                        <p className="text-[10px] text-[#667085]">{act.date}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: PAGINATED ORDER HISTORY */}
      {activeTab === 'orders' && (
        <div className="space-y-6">
          {/* FILTER CONTROLS */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 bg-white p-4 rounded-2xl border border-[#DCEAF0] shadow-2xs">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xs text-[#667085] font-semibold">Filter Status:</span>
              {['', 'Processing', 'Delivered', 'Shipped', 'Failed'].map((st) => (
                <button
                  key={st}
                  onClick={() => { setOrderStatusFilter(st); setPage(1); }}
                  className={`px-3 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                    orderStatusFilter === st
                      ? 'bg-[#14213D] text-white'
                      : 'bg-[#F5F1E8] text-[#667085] hover:text-[#14213D]'
                  }`}
                >
                  {st === '' ? 'All Orders' : st}
                </button>
              ))}
            </div>

            <span className="text-xs text-[#667085]">
              Showing Page {ordersData.page} of {ordersData.pages} ({ordersData.total} Total Orders)
            </span>
          </div>

          {/* ORDERS LIST */}
          {ordersData.items.length === 0 ? (
            <div className="py-16 text-center bg-white border border-[#DCEAF0] rounded-3xl space-y-2 shadow-xs">
              <Package className="w-10 h-10 text-[#567C8D]/50 mx-auto" />
              <p className="text-[#667085] text-xs">No order records found matching this criteria.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {ordersData.items.map((ord: any) => (
                <div key={ord.order_id} className="p-6 bg-white border border-[#DCEAF0] rounded-2xl hover:border-[#567C8D]/40 transition space-y-4 shadow-xs">
                  <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center border-b border-[#F5F1E8] pb-4 gap-2">
                    <div>
                      <div className="flex items-center space-x-2">
                        <span className="font-mono text-sm font-bold text-[#14213D]">{ord.order_id}</span>
                        <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                          ord.order_status === 'Delivered' ? 'bg-emerald-50 text-[#15803D] border border-emerald-200' :
                          ord.order_status === 'Processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                          'bg-slate-100 text-slate-700'
                        }`}>
                          {ord.order_status}
                        </span>
                      </div>
                      <p className="text-xs text-[#667085] mt-1">Placed on {ord.order_date} at {ord.order_time || '12:00'}</p>
                    </div>

                    <div className="flex items-center space-x-2">
                      <div className="text-right mr-2">
                        <span className="text-[11px] text-[#667085]">Total Authoritative Price</span>
                        <p className="text-base font-extrabold text-[#14213D]">₹{ord.final_amount?.toLocaleString('en-IN')}</p>
                      </div>
                      <button
                        onClick={() => setTrackingOrderId(ord.order_id)}
                        className="px-3 py-1.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer shadow-xs"
                        title="Track shipment progression"
                      >
                        <Truck className="w-3.5 h-3.5 text-[#FCA311]" />
                        <span>Track</span>
                      </button>
                      <button
                        onClick={() => handleOpenOrderDetail(ord.order_id)}
                        className="px-3 py-1.5 bg-[#DCEAF0] hover:bg-[#87CEEB]/40 text-[#14213D] rounded-xl text-xs font-bold transition flex items-center space-x-1 cursor-pointer"
                      >
                        <span>Details</span>
                        <ChevronRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {/* LINE ITEMS */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                    {ord.items.map((it: any) => (
                      <div key={it.order_item_id} className="p-3 bg-[#FAF9F6] rounded-xl border border-[#DCEAF0] flex items-center justify-between">
                        <div className="flex items-center space-x-2">
                          <Package className="w-4 h-4 text-[#567C8D] shrink-0" />
                          <span className="font-semibold text-[#14213D] line-clamp-1">{it.product_name}</span>
                        </div>
                        <span className="font-bold text-[#14213D]">Qty: {it.quantity} × ₹{it.unit_price}</span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* PAGINATION CONTROLS */}
          <div className="flex justify-between items-center pt-2">
            <button
              disabled={page <= 1}
              onClick={() => setPage(p => Math.max(1, p - 1))}
              className="px-4 py-2 bg-white hover:bg-[#F5F1E8] disabled:opacity-40 text-[#14213D] border border-[#DCEAF0] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Previous Page
            </button>
            <span className="text-xs text-[#667085]">Page {page} of {ordersData.pages}</span>
            <button
              disabled={page >= ordersData.pages}
              onClick={() => setPage(p => p + 1)}
              className="px-4 py-2 bg-white hover:bg-[#F5F1E8] disabled:opacity-40 text-[#14213D] border border-[#DCEAF0] rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Next Page
            </button>
          </div>
        </div>
      )}

      {/* TAB: SAVED DELIVERY ADDRESSES */}
      {activeTab === 'addresses' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 shadow-xs">
            <div>
              <h3 className="font-bold text-sm text-[#14213D] flex items-center space-x-2">
                <MapPin className="w-4 h-4 text-[#FCA311]" />
                <span>Saved Delivery Addresses ({addresses.length})</span>
              </h3>
              <p className="text-xs text-[#667085] mt-0.5">
                Manage your authenticated delivery locations. Indian addresses verified with 6-digit PIN codes.
              </p>
            </div>
            <button
              onClick={handleOpenAddAddress}
              className="px-4 py-2 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-xs flex items-center space-x-1.5 cursor-pointer shrink-0"
            >
              <Plus className="w-4 h-4 text-[#FCA311]" />
              <span>Add New Address</span>
            </button>
          </div>

          {addresses.length === 0 ? (
            <div className="p-12 bg-white border border-[#DCEAF0] rounded-2xl text-center space-y-3 shadow-xs">
              <div className="w-12 h-12 rounded-2xl bg-[#F5F1E8] border border-[#DCEAF0] flex items-center justify-center mx-auto text-[#567C8D]">
                <MapPin className="w-6 h-6 text-[#567C8D]" />
              </div>
              <h4 className="text-sm font-bold text-[#14213D]">No Saved Delivery Addresses Found</h4>
              <p className="text-xs text-[#667085] max-w-sm mx-auto">
                Add your verified shipping destination to enable single-click checkout and accurate delivery fee resolution.
              </p>
              <div className="pt-2">
                <button
                  onClick={handleOpenAddAddress}
                  className="px-4 py-2 bg-[#567C8D] hover:bg-[#456574] text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center space-x-1.5 cursor-pointer"
                >
                  <Plus className="w-4 h-4 text-white" />
                  <span>Add Delivery Address</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {addresses.map((addr) => (
                <div
                  key={addr.address_id}
                  className={`p-5 rounded-2xl border transition-all space-y-3 relative ${
                    addr.is_default
                      ? 'bg-white border-[#FCA311] ring-1 ring-[#FCA311]/30 shadow-md'
                      : 'bg-white border-[#DCEAF0] hover:border-[#567C8D] shadow-xs'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex items-center space-x-2">
                      <span className="font-bold text-sm text-[#14213D]">{addr.recipient_name}</span>
                      {addr.is_default && (
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#FFF7EB] text-[#B45309] border border-[#FCA311]">
                          Default Address
                        </span>
                      )}
                    </div>
                    <div className="flex items-center space-x-1">
                      <button
                        onClick={() => handleOpenEditAddress(addr)}
                        className="p-1.5 text-[#667085] hover:text-[#14213D] hover:bg-[#F5F1E8] rounded-lg transition cursor-pointer"
                        title="Edit Address"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                      <button
                        onClick={() => handleDeleteAddress(addr.address_id)}
                        className="p-1.5 text-[#667085] hover:text-[#B42318] hover:bg-red-50 rounded-lg transition cursor-pointer"
                        title="Delete Address"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <p className="text-xs text-[#1F2937] leading-relaxed">
                    {addr.address_line1}
                    {addr.address_line2 && <>, {addr.address_line2}</>}
                    <br />
                    {addr.city}, {addr.state} — <span className="font-bold font-mono text-[#14213D]">{addr.postal_code}</span>
                  </p>

                  <div className="flex items-center justify-between pt-2 border-t border-[#F5F1E8] text-xs">
                    <span className="text-[#667085] font-mono text-[11px]">Phone: {addr.phone_number}</span>
                    {!addr.is_default && (
                      <button
                        onClick={() => handleSetDefaultAddress(addr.address_id)}
                        className="text-[11px] font-bold text-[#567C8D] hover:text-[#14213D] transition cursor-pointer"
                      >
                        Set as Default
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB 3: SHIPMENT TRACKING */}
      {activeTab === 'shipments' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex justify-between items-center shadow-xs">
            <h3 className="font-bold text-sm text-[#14213D]">Shipments & Logistics History ({shipments.length})</h3>
            <span className="text-xs text-[#667085]">Database: shipments</span>
          </div>

          <div className="overflow-x-auto bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                <tr>
                  <th className="p-3">Shipment ID</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Origin Warehouse</th>
                  <th className="p-3">Delivery Destination</th>
                  <th className="p-3">Shipping Method</th>
                  <th className="p-3">Dispatch Date</th>
                  <th className="p-3">Status</th>
                  <th className="p-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1E8]">
                {shipments.map((s) => (
                  <tr key={s.shipment_id} className="hover:bg-[#FAF9F6]">
                    <td className="p-3 font-mono text-[#567C8D] font-bold">{s.shipment_id}</td>
                    <td className="p-3 font-mono text-[#667085]">{s.order_id}</td>
                    <td className="p-3 font-medium text-[#14213D]">{s.warehouse_city}</td>
                    <td className="p-3 font-medium text-[#14213D]">{s.delivery_city}</td>
                    <td className="p-3 text-[#667085]">{s.shipping_method}</td>
                    <td className="p-3 text-[#667085]">{s.dispatch_date}</td>
                    <td className="p-3">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                        s.delivery_status === 'Delivered'
                          ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                          : 'bg-[#DCEAF0] text-[#2F5261] border border-[#567C8D]/20'
                      }`}>
                        {s.delivery_status}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      {s.order_id && (
                        <button
                          onClick={() => setTrackingOrderId(s.order_id)}
                          className="px-2.5 py-1 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-lg text-[10px] font-bold transition inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Truck className="w-3 h-3 text-[#FCA311]" />
                          <span>Track</span>
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: FINANCIAL & PAYMENT OVERVIEW */}
      {activeTab === 'payments' && (
        <div className="space-y-6">
          {/* Header */}
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center space-x-2">
                <span className="p-2 bg-[#DCEAF0] rounded-lg text-[#567C8D]">
                  <CreditCard className="w-5 h-5" />
                </span>
                <div>
                  <h3 className="font-bold text-base text-[#14213D] font-['Space_Grotesk']">Customer Financial & Payment Overview</h3>
                  <p className="text-xs text-[#667085]">Authoritative order finances, payment transaction records and refunds</p>
                </div>
              </div>
            </div>
            <div className="flex items-center space-x-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 mr-1 text-emerald-600" />
                Verified Customer Identity
              </span>
            </div>
          </div>

          {/* 7 KPI CARDS */}
          <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3">
            <div className="p-4 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Total Orders</p>
              <p className="text-xl font-extrabold text-[#14213D] mt-1 font-mono">
                {financialOverview?.total_orders ?? ordersData.total}
              </p>
              <span className="text-[10px] text-[#567C8D]">Placed to date</span>
            </div>

            <div className="p-4 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Total Spending</p>
              <p className="text-xl font-extrabold text-[#14213D] mt-1 font-mono">
                ₹{(financialOverview?.total_spending ?? profile?.total_spend ?? 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-[#567C8D]">Gross order value</span>
            </div>

            <div className="p-4 bg-white border border-emerald-200 bg-emerald-50/20 rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-emerald-700 uppercase tracking-wider">Successfully Paid</p>
              <p className="text-xl font-extrabold text-emerald-700 mt-1 font-mono">
                ₹{(financialOverview?.total_paid ?? payments.reduce((acc, p) => p.payment_status === 'Success' ? acc + (p.amount_paid || 0) : acc, 0)).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-emerald-600">Settled payments</span>
            </div>

            <div className="p-4 bg-white border border-amber-200 bg-amber-50/20 rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-amber-700 uppercase tracking-wider">Pending Payment</p>
              <p className="text-xl font-extrabold text-amber-700 mt-1 font-mono">
                ₹{(financialOverview?.pending_payment_amount ?? 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-amber-600">Awaiting capture</span>
            </div>

            <div className="p-4 bg-white border border-rose-200 bg-rose-50/20 rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-rose-700 uppercase tracking-wider">Failed Payment</p>
              <p className="text-xl font-extrabold text-rose-700 mt-1 font-mono">
                ₹{(financialOverview?.failed_payment_amount ?? 0).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-rose-600">Declined/Uncharged</span>
            </div>

            <div className="p-4 bg-white border border-blue-200 bg-blue-50/20 rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-blue-700 uppercase tracking-wider">Total Refunded</p>
              <p className="text-xl font-extrabold text-blue-700 mt-1 font-mono">
                ₹{(financialOverview?.total_refunded ?? payments.reduce((acc, p) => acc + (p.refund_amount || 0), 0)).toLocaleString('en-IN')}
              </p>
              <span className="text-[10px] text-blue-600">Credited back</span>
            </div>

            <div className="p-4 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <p className="text-[11px] font-bold text-[#667085] uppercase tracking-wider">Transactions</p>
              <p className="text-xl font-extrabold text-[#14213D] mt-1 font-mono">
                {financialOverview?.total_transactions ?? payments.length}
              </p>
              <span className="text-[10px] text-[#567C8D]">Database records</span>
            </div>
          </div>

          {/* VISUALIZATIONS SECTION */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Monthly Spending Trend */}
            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <TrendingUp className="w-4 h-4 text-[#567C8D]" />
                  <h4 className="font-bold text-sm text-[#14213D]">Monthly Spending Trend</h4>
                </div>
                <span className="text-[11px] text-[#667085] font-mono">Amounts in INR (₹)</span>
              </div>
              <div className="h-60 w-full">
                {spendingTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={spendingTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="customerSpendingGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#567C8D" stopOpacity={0.4} />
                          <stop offset="95%" stopColor="#567C8D" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F4F8" />
                      <XAxis dataKey="month" tick={{ fontSize: 10, fill: '#667085' }} tickLine={false} />
                      <YAxis tick={{ fontSize: 10, fill: '#667085' }} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spending']}
                        labelFormatter={(lbl) => `Month: ${lbl}`}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #DCEAF0', fontSize: '11px' }}
                      />
                      <Area type="monotone" dataKey="spending" stroke="#567C8D" strokeWidth={2.5} fillOpacity={1} fill="url(#customerSpendingGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#667085]">
                    No historical monthly spending recorded for this account.
                  </div>
                )}
              </div>
            </div>

            {/* Spending by Category */}
            <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-2">
                  <PieIcon className="w-4 h-4 text-[#567C8D]" />
                  <h4 className="font-bold text-sm text-[#14213D]">Spending by Product Category</h4>
                </div>
                <span className="text-[11px] text-[#667085]">Distribution</span>
              </div>
              <div className="h-60 w-full">
                {financialOverview?.spending_by_category && financialOverview.spending_by_category.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={financialOverview.spending_by_category.slice(0, 5)} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#F0F4F8" />
                      <XAxis dataKey="category" tick={{ fontSize: 9, fill: '#667085' }} interval={0} angle={-15} textAnchor="end" />
                      <YAxis tick={{ fontSize: 10, fill: '#667085' }} tickLine={false} tickFormatter={(v) => `₹${(v / 1000).toFixed(0)}k`} />
                      <Tooltip
                        formatter={(val: any) => [`₹${Number(val).toLocaleString('en-IN')}`, 'Spent']}
                        contentStyle={{ backgroundColor: '#ffffff', borderRadius: '12px', border: '1px solid #DCEAF0', fontSize: '11px' }}
                      />
                      <Bar dataKey="amount" fill="#2F5261" radius={[6, 6, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-[#667085]">
                    Category spending distribution available after completing purchase orders.
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* PAYMENT METHOD BREAKDOWN PILLS */}
          {financialOverview?.payment_methods && financialOverview.payment_methods.length > 0 && (
            <div className="p-4 bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <h4 className="text-xs font-bold text-[#667085] uppercase tracking-wider mb-3">Payment Methods Used</h4>
              <div className="flex flex-wrap gap-2">
                {financialOverview.payment_methods.map((pm) => (
                  <div key={pm.method} className="px-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl flex items-center space-x-2 text-xs">
                    <span className="font-bold text-[#14213D]">{pm.method}</span>
                    <span className="text-[#667085]">({pm.count} txns)</span>
                    <span className="font-mono font-bold text-[#567C8D]">₹{pm.amount.toLocaleString('en-IN')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* FILTERS & TABLE CONTROLS */}
          <div className="p-4 bg-white border border-[#DCEAF0] rounded-2xl flex flex-col md:flex-row md:items-center md:justify-between gap-3 shadow-xs">
            <div className="flex items-center space-x-2">
              <span className="text-xs font-bold text-[#14213D]">Recent Transactions</span>
              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#DCEAF0] text-[#2F5261]">
                {payments.filter(p => {
                  if (paymentStatusFilter !== 'all' && (p.payment_status || '').toLowerCase() !== paymentStatusFilter.toLowerCase()) return false;
                  if (paymentMethodFilter !== 'all' && (p.payment_method || '').toLowerCase() !== paymentMethodFilter.toLowerCase()) return false;
                  return true;
                }).length} Results
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {/* Status Filter */}
              <select
                value={paymentStatusFilter}
                onChange={(e) => setPaymentStatusFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-[#14213D] font-medium focus:outline-none focus:ring-1 focus:ring-[#567C8D]"
              >
                <option value="all">All Payment Statuses</option>
                <option value="Success">Success</option>
                <option value="Refunded">Refunded</option>
                <option value="Failed">Failed</option>
                <option value="Pending">Pending</option>
              </select>

              {/* Method Filter */}
              <select
                value={paymentMethodFilter}
                onChange={(e) => setPaymentMethodFilter(e.target.value)}
                className="text-xs px-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-[#14213D] font-medium focus:outline-none focus:ring-1 focus:ring-[#567C8D]"
              >
                <option value="all">All Payment Methods</option>
                <option value="UPI">UPI</option>
                <option value="Credit Card">Credit Card</option>
                <option value="Debit Card">Debit Card</option>
                <option value="Net Banking">Net Banking</option>
                <option value="Cash on Delivery">Cash on Delivery</option>
              </select>
            </div>
          </div>

          {/* TRANSACTIONS TABLE */}
          <div className="overflow-x-auto bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
            <table className="w-full text-left text-xs text-[#1F2937]">
              <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                <tr>
                  <th className="p-3">Transaction ID</th>
                  <th className="p-3">Order ID</th>
                  <th className="p-3">Payment Date</th>
                  <th className="p-3">Method</th>
                  <th className="p-3">Amount Paid</th>
                  <th className="p-3">Refund Amount</th>
                  <th className="p-3">Payment Status</th>
                  <th className="p-3 text-right">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F5F1E8]">
                {payments
                  .filter(p => {
                    if (paymentStatusFilter !== 'all' && (p.payment_status || '').toLowerCase() !== paymentStatusFilter.toLowerCase()) return false;
                    if (paymentMethodFilter !== 'all' && (p.payment_method || '').toLowerCase() !== paymentMethodFilter.toLowerCase()) return false;
                    return true;
                  })
                  .map((p) => (
                    <tr key={p.payment_id} className="hover:bg-[#FAF9F6] transition">
                      <td className="p-3 font-mono text-[#567C8D] font-bold">{p.payment_id}</td>
                      <td className="p-3">
                        <button
                          onClick={() => handleOpenOrderDetail(p.order_id)}
                          className="font-mono text-[#14213D] hover:text-[#567C8D] font-semibold underline decoration-dotted cursor-pointer"
                        >
                          {p.order_id}
                        </button>
                      </td>
                      <td className="p-3 text-[#667085]">{p.payment_date}</td>
                      <td className="p-3 text-[#14213D] font-semibold">{p.payment_method}</td>
                      <td className="p-3 font-extrabold text-[#14213D]">₹{p.amount_paid?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        {p.refund_amount && p.refund_amount > 0 ? (
                          <span className="font-extrabold text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200 text-[11px]">
                            ₹{p.refund_amount?.toLocaleString('en-IN')}
                          </span>
                        ) : (
                          <span className="text-[#667085]">₹0.00</span>
                        )}
                      </td>
                      <td className="p-3">
                        <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          p.payment_status === 'Success'
                            ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                            : p.payment_status === 'Refunded'
                            ? 'bg-blue-50 text-blue-700 border border-blue-200'
                            : p.payment_status === 'Pending'
                            ? 'bg-amber-50 text-amber-700 border border-amber-200'
                            : 'bg-red-50 text-[#B42318] border border-red-200'
                        }`}>
                          {p.payment_status}
                        </span>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          onClick={() => handleOpenOrderDetail(p.order_id)}
                          className="px-2.5 py-1 text-[11px] font-bold text-[#567C8D] hover:bg-[#DCEAF0] rounded-lg transition cursor-pointer"
                        >
                          Breakdown →
                        </button>
                      </td>
                    </tr>
                  ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={8} className="p-8 text-center text-xs text-[#667085]">
                      No payment or transaction records found for this account.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 5: RETURNS & REFUNDS */}
      {activeTab === 'returns' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex justify-between items-center shadow-xs">
            <h3 className="font-bold text-sm text-[#14213D]">Returns & Refund Requests ({returnsList.length})</h3>
            <span className="text-xs text-[#667085]">Database: returns</span>
          </div>

          {returnsList.length === 0 ? (
            <div className="py-12 text-center bg-white border border-[#DCEAF0] rounded-3xl text-[#667085] text-xs shadow-xs">
              No return or refund requests on record.
            </div>
          ) : (
            <div className="overflow-x-auto bg-white border border-[#DCEAF0] rounded-2xl shadow-xs">
              <table className="w-full text-left text-xs text-[#1F2937]">
                <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] border-b border-[#DCEAF0]">
                  <tr>
                    <th className="p-3">Return ID</th>
                    <th className="p-3">Order ID</th>
                    <th className="p-3">Product Name</th>
                    <th className="p-3">Return Reason</th>
                    <th className="p-3">Refund Amount</th>
                    <th className="p-3">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#F5F1E8]">
                  {returnsList.map((r) => (
                    <tr key={r.return_id} className="hover:bg-[#FAF9F6]">
                      <td className="p-3 font-mono text-[#567C8D] font-bold">{r.return_id}</td>
                      <td className="p-3 font-mono text-[#667085]">{r.order_id}</td>
                      <td className="p-3 font-semibold text-[#14213D]">{r.product_name}</td>
                      <td className="p-3 text-[#667085]">{r.return_reason}</td>
                      <td className="p-3 font-extrabold text-[#15803D]">₹{r.refund_amount?.toLocaleString('en-IN')}</td>
                      <td className="p-3">
                        <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-50 text-[#15803D] border border-emerald-200">
                          {r.return_status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB 6: MY PRODUCT REVIEWS */}
      {activeTab === 'reviews' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex justify-between items-center shadow-xs">
            <h3 className="font-bold text-sm text-[#14213D]">Submitted Product Reviews ({reviewsList.length})</h3>
            <button
              onClick={() => setIsReviewModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#FCA311]" />
              <span>Write Review</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {reviewsList.map((rev) => (
              <div key={rev.review_id} className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-[11px] text-[#567C8D] font-bold">{rev.review_id}</span>
                    <h4 className="font-bold text-[#14213D] text-sm mt-0.5">{rev.product_name}</h4>
                  </div>
                  <div className="flex items-center space-x-1 text-[#FCA311]">
                    <Star className="w-4 h-4 fill-[#FCA311]" />
                    <span className="font-extrabold text-xs text-[#14213D]">{rev.rating}/5</span>
                  </div>
                </div>

                <div className="space-y-1 text-xs">
                  <p className="font-bold text-[#14213D]">{rev.review_title}</p>
                  <p className="text-[#667085] leading-relaxed">{rev.review_text}</p>
                </div>

                <div className="pt-2 border-t border-[#F5F1E8] flex justify-between items-center text-[10px] text-[#667085]">
                  <span>Date: {rev.review_date}</span>
                  <span className="text-[#15803D] font-bold">Verified Purchase</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* TAB 7: SUPPORT TICKETS */}
      {activeTab === 'support' && (
        <div className="space-y-4">
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl flex justify-between items-center shadow-xs">
            <h3 className="font-bold text-sm text-[#14213D]">Customer Support Tickets ({supportTickets.length})</h3>
            <button
              onClick={() => setIsTicketModalOpen(true)}
              className="px-3.5 py-1.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition flex items-center space-x-1.5 cursor-pointer shadow-xs"
            >
              <PlusCircle className="w-3.5 h-3.5 text-[#FCA311]" />
              <span>Raise Support Ticket</span>
            </button>
          </div>

          <div className="space-y-3">
            {supportTickets.map((t) => (
              <div key={t.ticket_id} className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-3 shadow-xs">
                <div className="flex justify-between items-start">
                  <div>
                    <span className="font-mono text-xs text-[#567C8D] font-bold">{t.ticket_id}</span>
                    <h4 className="font-bold text-[#14213D] text-sm capitalize mt-0.5">
                      Issue: {t.issue_type?.replace(/_/g, ' ')}
                    </h4>
                  </div>
                  <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${
                    t.ticket_status === 'Resolved'
                      ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}>
                    {t.ticket_status || 'Open'}
                  </span>
                </div>

                <div className="p-3 bg-[#FAF9F6] rounded-xl border border-[#DCEAF0] text-xs text-[#1F2937]">
                  <p className="font-bold text-[#667085] text-[11px] mb-1">Your Inquiry:</p>
                  <p>{t.customer_message}</p>
                </div>

                {t.resolution_guidance && (
                  <div className="p-3 bg-[#DCEAF0]/40 rounded-xl border border-[#567C8D]/20 text-xs text-[#14213D]">
                    <p className="font-bold text-[#567C8D] text-[11px] mb-1">Support Agent Resolution:</p>
                    <p>{t.resolution_guidance}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ORDER DETAIL DRAWER / MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#DCEAF0] rounded-3xl p-6 md:p-8 w-full max-w-2xl max-h-[90vh] overflow-y-auto relative shadow-2xl space-y-6">
            <button
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#14213D] rounded-full bg-[#F5F1E8] transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="border-b border-[#DCEAF0] pb-4">
              <div className="flex justify-between items-start">
                <div>
                  <span className="font-mono text-xs text-[#567C8D] font-bold">{selectedOrder.order_id}</span>
                  <h2 className="text-xl font-bold text-[#14213D] mt-1 font-['Space_Grotesk']">Order Breakdown</h2>
                  <p className="text-xs text-[#667085]">Placed on {selectedOrder.order_date} {selectedOrder.order_time ? `at ${selectedOrder.order_time}` : ''} • Destination: <span className="text-[#14213D] font-semibold">{selectedOrder.delivery_city || 'Bengaluru'}, {selectedOrder.delivery_state || 'Karnataka'}</span></p>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-bold ${
                  selectedOrder.order_status === 'Delivered' ? 'bg-emerald-50 text-[#15803D] border border-emerald-200' :
                  selectedOrder.order_status === 'Processing' ? 'bg-amber-50 text-amber-700 border border-amber-200' :
                  'bg-slate-100 text-slate-700'
                }`}>
                  {selectedOrder.order_status}
                </span>
              </div>
            </div>

            {/* ORDER ITEMS */}
            <div className="space-y-3">
              <h3 className="text-xs font-bold text-[#667085] uppercase tracking-wider">Ordered Items</h3>
              {selectedOrder.items.map((it: any) => (
                <div key={it.order_item_id} className="p-3.5 bg-[#FAF9F6] rounded-xl border border-[#DCEAF0] flex items-center justify-between text-xs">
                  <div>
                    <p className="font-bold text-[#14213D]">{it.product_name}</p>
                    <p className="text-[#667085] text-[11px]">Product ID: <code className="text-[#567C8D] font-mono">{it.product_id}</code></p>
                  </div>
                  <span className="font-extrabold text-[#14213D]">Qty: {it.quantity} × ₹{it.unit_price?.toLocaleString('en-IN')}</span>
                </div>
              ))}
            </div>

            {/* FINANCIAL BREAKDOWN */}
            <div className="p-4 bg-[#F5F1E8] rounded-xl border border-[#DCEAF0] space-y-2 text-xs">
              <h4 className="font-bold text-[#14213D] uppercase text-[10px] tracking-wider mb-2">Order Financial Reconciliation</h4>
              {selectedOrder.coupon_code && (
                <div className="flex justify-between text-[#567C8D] font-medium border-b border-[#DCEAF0] pb-2 mb-1">
                  <span>Applied Coupon Code:</span>
                  <span className="font-mono bg-white px-2 py-0.5 rounded border border-[#DCEAF0]">{selectedOrder.coupon_code}</span>
                </div>
              )}
              <div className="flex justify-between text-[#667085]"><span>Product Subtotal:</span><span>₹{selectedOrder.subtotal?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-[#667085]"><span>Shipping Charges:</span><span>₹{selectedOrder.shipping_fee?.toLocaleString('en-IN')}</span></div>
              <div className="flex justify-between text-[#667085]"><span>Taxes (GST):</span><span>₹{selectedOrder.tax_amount?.toLocaleString('en-IN')}</span></div>
              {selectedOrder.discount_amount && selectedOrder.discount_amount > 0 ? (
                <div className="flex justify-between text-emerald-700 font-semibold">
                  <span>Promotional Discount:</span>
                  <span>-₹{selectedOrder.discount_amount?.toLocaleString('en-IN')}</span>
                </div>
              ) : null}
              <div className="pt-2 border-t border-[#DCEAF0] flex justify-between font-extrabold text-sm text-[#14213D]">
                <span>Final Order Amount:</span>
                <span className="text-[#14213D]">₹{selectedOrder.final_amount?.toLocaleString('en-IN')}</span>
              </div>
              <div className="flex justify-between text-emerald-700 font-bold pt-1">
                <span>Successfully Paid:</span>
                <span>₹{(selectedOrder.paid_amount ?? (selectedOrder.payment?.amount_paid || selectedOrder.final_amount))?.toLocaleString('en-IN')}</span>
              </div>
              {selectedOrder.refund_amount && selectedOrder.refund_amount > 0 ? (
                <div className="flex justify-between text-blue-700 font-bold">
                  <span>Refunded Amount:</span>
                  <span>₹{selectedOrder.refund_amount?.toLocaleString('en-IN')}</span>
                </div>
              ) : null}
              {selectedOrder.outstanding_amount && selectedOrder.outstanding_amount > 0 ? (
                <div className="flex justify-between text-rose-700 font-bold">
                  <span>Outstanding Balance:</span>
                  <span>₹{selectedOrder.outstanding_amount?.toLocaleString('en-IN')}</span>
                </div>
              ) : null}
            </div>

            {/* SHIPMENT & PAYMENT STATUS */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {selectedOrder.shipment ? (
                <div className="p-4 bg-[#DCEAF0]/40 border border-[#567C8D]/20 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#14213D] flex items-center space-x-1"><Truck className="w-3.5 h-3.5 inline mr-1 text-[#567C8D]" />Shipment Tracking</span>
                  <p className="text-[#1F2937]">Status: <span className="font-bold text-[#567C8D]">{selectedOrder.shipment.delivery_status}</span></p>
                  <p className="text-[#667085] text-[11px]">Courier: {selectedOrder.shipment.shipping_method || selectedOrder.shipping_method || 'Standard Express'}</p>
                  {selectedOrder.shipment.warehouse_city && (
                    <p className="text-[#667085] text-[10px]">Origin: {selectedOrder.shipment.warehouse_city} → {selectedOrder.shipment.delivery_city}</p>
                  )}
                </div>
              ) : (
                <div className="p-4 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#667085] flex items-center space-x-1"><Truck className="w-3.5 h-3.5 inline mr-1" />Shipment Tracking</span>
                  <p className="text-[#667085]">Order confirmed. Dispatch preparation in progress.</p>
                </div>
              )}

              {selectedOrder.payment ? (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#15803D] flex items-center space-x-1"><CreditCard className="w-3.5 h-3.5 inline mr-1" />Payment Verified</span>
                  <p className="text-[#1F2937]">Method: <span className="font-bold text-[#15803D]">{selectedOrder.payment.payment_method || 'UPI / RuPay Card'}</span></p>
                  <p className="text-[#667085] text-[11px]">Status: {selectedOrder.payment.payment_status || 'Success'}</p>
                  <p className="text-[#667085] text-[10px]">Txn Ref: {selectedOrder.payment.payment_id}</p>
                </div>
              ) : (
                <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl text-xs space-y-1">
                  <span className="font-bold text-[#15803D] flex items-center space-x-1"><CreditCard className="w-3.5 h-3.5 inline mr-1" />Payment Confirmed</span>
                  <p className="text-[#1F2937]">Status: <span className="font-bold text-[#15803D]">Paid Authoritatively</span></p>
                  <p className="text-[#667085] text-[11px]">Total: ₹{selectedOrder.final_amount?.toLocaleString('en-IN')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* WRITE REVIEW MODAL */}
      {isReviewModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#DCEAF0] rounded-3xl p-6 md:p-8 w-full max-w-md relative shadow-2xl space-y-4">
            <button onClick={() => setIsReviewModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#14213D] rounded-full bg-[#F5F1E8]"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-[#14213D]">Write Product Review</h3>
            <form onSubmit={handleSubmitReview} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Product ID (e.g. PROD10001)</label>
                <input type="text" required value={newReviewProdId} onChange={e => setNewReviewProdId(e.target.value)} className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]" />
              </div>
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Rating (1 to 5 Stars)</label>
                <select value={newReviewRating} onChange={e => setNewReviewRating(Number(e.target.value))} className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]">
                  <option value={5}>5 Stars - Excellent</option>
                  <option value={4}>4 Stars - Good</option>
                  <option value={3}>3 Stars - Average</option>
                  <option value={2}>2 Stars - Poor</option>
                  <option value={1}>1 Star - Terrible</option>
                </select>
              </div>
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Review Title</label>
                <input type="text" required value={newReviewTitle} onChange={e => setNewReviewTitle(e.target.value)} placeholder="Great artisanal quality!" className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]" />
              </div>
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Review Feedback</label>
                <textarea rows={4} required value={newReviewText} onChange={e => setNewReviewText(e.target.value)} placeholder="Share your experience with other shoppers..." className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white font-bold rounded-xl transition cursor-pointer">Submit Verified Review</button>
            </form>
          </div>
        </div>
      )}

      {/* RAISE SUPPORT TICKET MODAL */}
      {isTicketModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#DCEAF0] rounded-3xl p-6 md:p-8 w-full max-w-md relative shadow-2xl space-y-4">
            <button onClick={() => setIsTicketModalOpen(false)} className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#14213D] rounded-full bg-[#F5F1E8]"><X className="w-5 h-5" /></button>
            <h3 className="text-lg font-bold text-[#14213D]">Raise Customer Support Ticket</h3>
            <form onSubmit={handleSubmitTicket} className="space-y-3 text-xs">
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Associated Order ID (Optional)</label>
                <input type="text" value={newTicketOrderId} onChange={e => setNewTicketOrderId(e.target.value)} placeholder="e.g. ORD1000002" className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]" />
              </div>
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Issue Category</label>
                <select value={newTicketIssueType} onChange={e => setNewTicketIssueType(e.target.value)} className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]">
                  <option value="delivery_delay">Delivery Delay</option>
                  <option value="damaged_item">Damaged Item</option>
                  <option value="return_refund">Return / Refund Query</option>
                  <option value="order_information">General Order Information</option>
                </select>
              </div>
              <div>
                <label className="block text-[#14213D] font-bold mb-1">Describe Issue</label>
                <textarea rows={4} required value={newTicketMessage} onChange={e => setNewTicketMessage(e.target.value)} placeholder="Provide full details for our support team..." className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]" />
              </div>
              <button type="submit" className="w-full py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white font-bold rounded-xl transition cursor-pointer">Submit Support Ticket</button>
            </form>
          </div>
        </div>
      )}

      {/* ADD / EDIT ADDRESS MODAL */}
      {isAddressModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="bg-white border border-[#DCEAF0] rounded-3xl p-6 md:p-8 w-full max-w-lg relative shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <button
              onClick={() => setIsAddressModalOpen(false)}
              className="absolute top-4 right-4 p-2 text-[#667085] hover:text-[#14213D] rounded-full bg-[#F5F1E8] cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>

            <div className="flex items-center space-x-2.5">
              <div className="w-9 h-9 rounded-xl bg-[#F5F1E8] border border-[#DCEAF0] flex items-center justify-center text-[#FCA311]">
                <MapPin className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-[#14213D]">
                  {addressModalMode === 'create' ? 'Add Delivery Address' : 'Edit Delivery Address'}
                </h3>
                <p className="text-xs text-[#667085]">Verified Indian address with 6-digit postal PIN code.</p>
              </div>
            </div>

            {addressFormError && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl text-xs text-[#B42318] flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{addressFormError}</span>
              </div>
            )}

            <form onSubmit={handleSaveAddress} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Recipient Name *</label>
                  <input
                    type="text"
                    required
                    value={addressForm.recipient_name}
                    onChange={e => setAddressForm({ ...addressForm, recipient_name: e.target.value })}
                    placeholder="Full Name"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Phone Number *</label>
                  <input
                    type="tel"
                    required
                    value={addressForm.phone_number}
                    onChange={e => setAddressForm({ ...addressForm, phone_number: e.target.value })}
                    placeholder="10-digit mobile number"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[#14213D] font-bold mb-1">Address Line 1 (Street, Building, Flat) *</label>
                <input
                  type="text"
                  required
                  value={addressForm.address_line1}
                  onChange={e => setAddressForm({ ...addressForm, address_line1: e.target.value })}
                  placeholder="e.g. Flat 302, Palm Heights, Outer Ring Road"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div>
                <label className="block text-[#14213D] font-bold mb-1">Address Line 2 (Landmark, Area - Optional)</label>
                <input
                  type="text"
                  value={addressForm.address_line2}
                  onChange={e => setAddressForm({ ...addressForm, address_line2: e.target.value })}
                  placeholder="e.g. Near Metro Station / Behind Central Mall"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">City *</label>
                  <input
                    type="text"
                    required
                    value={addressForm.city}
                    onChange={e => setAddressForm({ ...addressForm, city: e.target.value })}
                    placeholder="e.g. Bengaluru"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">State *</label>
                  <input
                    type="text"
                    required
                    value={addressForm.state}
                    onChange={e => setAddressForm({ ...addressForm, state: e.target.value })}
                    placeholder="e.g. Karnataka"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
                <div>
                  <label className="block text-[#14213D] font-bold mb-1">Postal PIN Code *</label>
                  <input
                    type="text"
                    required
                    maxLength={6}
                    value={addressForm.postal_code}
                    onChange={e => setAddressForm({ ...addressForm, postal_code: e.target.value })}
                    placeholder="e.g. 560001"
                    className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-2.5 text-[#1F2937] font-mono focus:outline-none focus:border-[#567C8D]"
                  />
                </div>
              </div>

              <div className="flex items-center space-x-2 pt-2">
                <input
                  type="checkbox"
                  id="addr_is_default"
                  checked={addressForm.is_default}
                  onChange={e => setAddressForm({ ...addressForm, is_default: e.target.checked })}
                  className="rounded border-[#DCEAF0] text-[#14213D] focus:ring-[#567C8D]"
                />
                <label htmlFor="addr_is_default" className="text-xs text-[#14213D] font-semibold cursor-pointer">
                  Set as default delivery address for checkout
                </label>
              </div>

              <div className="flex items-center space-x-3 pt-3 border-t border-[#DCEAF0]">
                <button
                  type="button"
                  onClick={() => setIsAddressModalOpen(false)}
                  className="flex-1 py-2.5 border border-[#DCEAF0] hover:bg-[#F5F1E8] text-[#14213D] font-bold rounded-xl transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSavingAddress}
                  className="flex-1 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white font-bold rounded-xl transition cursor-pointer flex items-center justify-center space-x-2 shadow-md"
                >
                  {isSavingAddress ? <span>Saving...</span> : <span>Save Delivery Address</span>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MULTI-SELLER LIVE TRACKING MODAL */}
      {trackingOrderId && (
        <CustomerOrderTrackingModal
          orderId={trackingOrderId}
          onClose={() => setTrackingOrderId(null)}
        />
      )}

    </div>
  );
}
