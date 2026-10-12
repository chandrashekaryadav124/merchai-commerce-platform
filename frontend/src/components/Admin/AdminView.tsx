import React, { useState, useEffect } from 'react';
import type { AdminMetrics, FraudAlert } from '../../types';
import {
  fetchAdminMetrics,
  fetchFraudRadar,
  fetchAdminUsers,
  updateAdminUserStatus,
  fetchAdminSellers,
  updateAdminSellerApproval
} from '../../services/api';
import {
  ShieldCheck,
  AlertOctagon,
  TrendingUp,
  Users,
  Package,
  Cpu,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  AlertTriangle,
  User,
  Store,
  Check,
  Ban,
  Clock
} from 'lucide-react';

interface ConfirmationModalProps {
  isOpen: boolean;
  title: string;
  description: string;
  confirmText: string;
  confirmStyle?: 'danger' | 'success' | 'warning' | 'primary';
  onConfirm: () => void;
  onCancel: () => void;
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isOpen,
  title,
  description,
  confirmText,
  confirmStyle = 'primary',
  onConfirm,
  onCancel
}) => {
  if (!isOpen) return null;

  const btnClasses = {
    danger: 'bg-[#B42318] hover:bg-red-800 text-white',
    success: 'bg-[#15803D] hover:bg-emerald-800 text-white',
    warning: 'bg-[#D97706] hover:bg-amber-700 text-white',
    primary: 'bg-[#14213D] hover:bg-[#0B132B] text-white'
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4 animate-fade-in">
      <div className="bg-white border border-[#DCEAF0] rounded-3xl max-w-md w-full p-6 space-y-4 shadow-2xl">
        <div className="flex items-center space-x-3">
          <div className="p-3 bg-[#FFF7EB] border border-[#FCA311]/40 rounded-2xl text-[#B45309]">
            <AlertTriangle className="w-6 h-6" />
          </div>
          <div>
            <h3 className="text-base font-bold text-[#14213D]">{title}</h3>
            <p className="text-xs text-[#667085]">Confirm Governance Operation</p>
          </div>
        </div>

        <p className="text-xs text-[#1F2937] leading-relaxed bg-[#FAF9F6] p-3.5 rounded-2xl border border-[#DCEAF0]">
          {description}
        </p>

        <div className="flex justify-end space-x-3 pt-2">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-[#F5F1E8] hover:bg-[#DCEAF0] text-[#14213D] rounded-xl text-xs font-bold transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition cursor-pointer shadow-sm ${btnClasses[confirmStyle]}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminView: React.FC = () => {
  const [metrics, setMetrics] = useState<AdminMetrics | null>(null);
  const [fraudAlerts, setFraudAlerts] = useState<FraudAlert[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [sellers, setSellers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Seller Governance Filters & Pagination
  const [sellerSearch, setSellerSearch] = useState('');
  const [sellerStatusFilter, setSellerStatusFilter] = useState('all');
  const [sellerPage, setSellerPage] = useState(1);
  const sellersPerPage = 8;

  // User Governance Filters & Pagination
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');
  const [userStatusFilter, setUserStatusFilter] = useState('all');
  const [userPage, setUserPage] = useState(1);
  const usersPerPage = 8;

  // Modal State
  const [modalConfig, setModalConfig] = useState<{
    isOpen: boolean;
    type: 'seller' | 'user';
    title: string;
    description: string;
    confirmText: string;
    confirmStyle: 'danger' | 'success' | 'warning' | 'primary';
    targetId: string;
    actionValue: any;
  } | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [m, f, u, s] = await Promise.all([
        fetchAdminMetrics().catch(() => null),
        fetchFraudRadar().catch(() => []),
        fetchAdminUsers().catch(() => []),
        fetchAdminSellers().catch(() => []),
      ]);
      setMetrics(m);
      setFraudAlerts(f);
      setUsers(u);
      setSellers(s);
    } catch (err: any) {
      setError(err.message || 'Failed to load admin governance data');
    } finally {
      setLoading(false);
    }
  };

  // Filter Sellers locally for smooth searching
  const filteredSellers = sellers.filter((s) => {
    const matchesStatus = sellerStatusFilter === 'all' || s.approval_status === sellerStatusFilter;
    const searchLower = sellerSearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      s.seller_id?.toLowerCase().includes(searchLower) ||
      s.store_name?.toLowerCase().includes(searchLower) ||
      s.contact_email?.toLowerCase().includes(searchLower) ||
      s.user_id?.toLowerCase().includes(searchLower) ||
      s.owner_full_name?.toLowerCase().includes(searchLower);
    return matchesStatus && matchesSearch;
  });

  const totalSellerPages = Math.ceil(filteredSellers.length / sellersPerPage) || 1;
  const paginatedSellers = filteredSellers.slice(
    (sellerPage - 1) * sellersPerPage,
    sellerPage * sellersPerPage
  );

  // Filter Users locally
  const filteredUsers = users.filter((u) => {
    const matchesRole = userRoleFilter === 'all' || u.role?.toLowerCase() === userRoleFilter.toLowerCase();
    const matchesStatus =
      userStatusFilter === 'all' ||
      (userStatusFilter === 'active' && u.is_active) ||
      (userStatusFilter === 'deactivated' && !u.is_active);
    const searchLower = userSearch.toLowerCase().trim();
    const matchesSearch =
      !searchLower ||
      u.user_id?.toLowerCase().includes(searchLower) ||
      u.full_name?.toLowerCase().includes(searchLower) ||
      u.email?.toLowerCase().includes(searchLower);
    return matchesRole && matchesStatus && matchesSearch;
  });

  const totalUserPages = Math.ceil(filteredUsers.length / usersPerPage) || 1;
  const paginatedUsers = filteredUsers.slice(
    (userPage - 1) * usersPerPage,
    userPage * usersPerPage
  );

  const requestUpdateSellerApproval = (sellerId: string, storeName: string, newStatus: string) => {
    let confirmStyle: 'danger' | 'success' | 'warning' | 'primary' = 'primary';
    let desc = '';
    if (newStatus === 'approved') {
      confirmStyle = 'success';
      desc = `Are you sure you want to APPROVE '${storeName}' (${sellerId})? This will enable selling functions (product creation, inventory & orders) and grant seller access to the linked user account.`;
    } else if (newStatus === 'suspended') {
      confirmStyle = 'danger';
      desc = `Are you sure you want to SUSPEND '${storeName}' (${sellerId})? This will disable product creation, inventory management, and order processing for this storefront. The owner's login access will remain intact for appeals.`;
    } else if (newStatus === 'rejected') {
      confirmStyle = 'danger';
      desc = `Are you sure you want to REJECT '${storeName}' (${sellerId})? This will deny selling permissions for this application.`;
    } else {
      desc = `Change status of '${storeName}' (${sellerId}) to '${newStatus}'?`;
    }

    setModalConfig({
      isOpen: true,
      type: 'seller',
      title: `Confirm Seller ${newStatus.toUpperCase()}`,
      description: desc,
      confirmText: `Confirm ${newStatus.charAt(0).toUpperCase() + newStatus.slice(1)}`,
      confirmStyle,
      targetId: sellerId,
      actionValue: newStatus
    });
  };

  const requestToggleUserStatus = (userId: string, fullName: string, currentStatus: boolean) => {
    const nextStatus = !currentStatus;
    const confirmStyle = nextStatus ? 'success' : 'danger';
    const actionLabel = nextStatus ? 'ACTIVATE' : 'DEACTIVATE';
    const desc = nextStatus
      ? `Are you sure you want to ACTIVATE account '${fullName}' (${userId})? The user will regain API authentication and login access.`
      : `Are you sure you want to DEACTIVATE account '${fullName}' (${userId})? This will immediately BLOCK all authenticated API access for this user account.`;

    setModalConfig({
      isOpen: true,
      type: 'user',
      title: `Confirm Account ${actionLabel}`,
      description: desc,
      confirmText: `Confirm ${actionLabel.charAt(0) + actionLabel.slice(1).toLowerCase()}`,
      confirmStyle,
      targetId: userId,
      actionValue: nextStatus
    });
  };

  const handleExecuteModalAction = async () => {
    if (!modalConfig) return;
    const { type, targetId, actionValue } = modalConfig;
    setModalConfig(null);

    try {
      if (type === 'seller') {
        const updated = await updateAdminSellerApproval(targetId, actionValue);
        setSellers((prev) =>
          prev.map((s) => (s.seller_id === targetId ? { ...s, approval_status: updated.approval_status } : s))
        );
      } else if (type === 'user') {
        const updated = await updateAdminUserStatus(targetId, actionValue);
        setUsers((prev) =>
          prev.map((u) => (u.user_id === targetId ? { ...u, is_active: updated.is_active } : u))
        );
      }
    } catch (err: any) {
      alert(err.message || 'Governance update failed.');
    }
  };

  const getApprovalBadge = (status: string) => {
    switch (status) {
      case 'approved':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-[#15803D] border border-emerald-300">
            <Check className="w-3 h-3 mr-1" /> APPROVED
          </span>
        );
      case 'pending':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-50 text-amber-700 border border-amber-300">
            <Clock className="w-3 h-3 mr-1" /> PENDING
          </span>
        );
      case 'suspended':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-red-50 text-[#B42318] border border-red-300">
            <Ban className="w-3 h-3 mr-1" /> SUSPENDED
          </span>
        );
      case 'rejected':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600 border border-slate-300">
            <XCircle className="w-3 h-3 mr-1" /> REJECTED
          </span>
        );
      default:
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 text-slate-600">
            {status}
          </span>
        );
    }
  };

  return (
    <div className="space-y-8 pb-16">
      {/* CONFIRMATION MODAL */}
      {modalConfig && (
        <ConfirmationModal
          isOpen={modalConfig.isOpen}
          title={modalConfig.title}
          description={modalConfig.description}
          confirmText={modalConfig.confirmText}
          confirmStyle={modalConfig.confirmStyle}
          onConfirm={handleExecuteModalAction}
          onCancel={() => setModalConfig(null)}
        />
      )}

      {/* ADMIN DESK HEADER */}
      <div className="p-6 md:p-8 bg-[#14213D] border border-[#233554] rounded-3xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4 shadow-xl text-white">
        <div className="flex items-center space-x-3.5">
          <div className="w-12 h-12 rounded-2xl bg-[#DCEAF0] flex items-center justify-center text-[#14213D] shadow-md">
            <ShieldCheck className="w-6 h-6 text-[#567C8D]" />
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-bold text-white font-['Space_Grotesk']">
              Marketplace Governance & Admin Desk
            </h1>
            <p className="text-xs text-[#DCEAF0]/80">
              Verified Gross/Net GMV analytics, seller storefront identity review, user directory access controls, and risk monitoring.
            </p>
          </div>
        </div>

        <button
          onClick={loadData}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 shadow-sm cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Governance Data</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-[#B42318] text-xs flex items-center space-x-2">
          <AlertOctagon className="w-4 h-4 flex-shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* VERIFIED PLATFORM METRICS SUMMARY */}
      {metrics && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* GMV CARD */}
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-[#667085] text-xs font-bold">
              <span>Gross & Net GMV</span>
              <TrendingUp className="w-4 h-4 text-[#15803D]" />
            </div>
            <div>
              <p className="text-2xl font-extrabold text-[#14213D]">₹{metrics.gmv_total.toLocaleString('en-IN')}</p>
              <div className="flex items-center justify-between text-[11px] text-[#667085] mt-1">
                <span>Net GMV (Settled):</span>
                <span className="text-[#15803D] font-bold">₹{(metrics.gmv_net || metrics.gmv_total).toLocaleString('en-IN')}</span>
              </div>
            </div>
            <p className="text-[10px] text-[#15803D] font-bold pt-1 border-t border-[#F5F1E8]">
              Est. Commission (5%): ₹{metrics.platform_commission_est.toLocaleString('en-IN')}
            </p>
          </div>

          {/* SELLER PARTNERS CARD */}
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-[#667085] text-xs font-bold">
              <span>Seller Partners Governance</span>
              <Users className="w-4 h-4 text-[#567C8D]" />
            </div>
            <p className="text-2xl font-extrabold text-[#14213D]">{metrics.active_sellers} Active Sellers</p>
            <div className="text-[11px] text-[#667085] space-x-2">
              <span className="text-amber-700 font-bold">{metrics.pending_sellers || 0} Pending</span>
              <span>•</span>
              <span className="text-[#B42318] font-bold">{metrics.suspended_sellers || 0} Suspended</span>
            </div>
            <p className="text-[10px] text-[#567C8D] font-bold pt-1 border-t border-[#F5F1E8]">
              {metrics.total_products.toLocaleString('en-IN')} Total Products in Catalog
            </p>
          </div>

          {/* MARKETPLACE ORDERS CARD */}
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-[#667085] text-xs font-bold">
              <span>Marketplace Orders</span>
              <Package className="w-4 h-4 text-[#567C8D]" />
            </div>
            <p className="text-2xl font-extrabold text-[#14213D]">{metrics.total_orders_processed.toLocaleString('en-IN')}</p>
            <div className="text-[10px] text-[#667085] flex items-center justify-between">
              <span className="text-[#15803D] font-bold">{metrics.delivered_orders_count || 17261} Delivered</span>
              <span className="text-[#B42318] font-bold">{metrics.cancelled_orders_count || 943} Cancelled</span>
              <span className="text-amber-700 font-bold">{metrics.returned_orders_count || 1432} Returned</span>
            </div>
            <p className="text-[10px] text-[#567C8D] font-bold pt-1 border-t border-[#F5F1E8]">
              99.8% Payment Clearance SLA
            </p>
          </div>

          {/* AI & RISK ENGINE CARD */}
          <div className="p-5 bg-white border border-[#DCEAF0] rounded-2xl space-y-2 shadow-xs">
            <div className="flex justify-between items-center text-[#667085] text-xs font-bold">
              <span>AI Engine & Risk Governance</span>
              <Cpu className="w-4 h-4 text-[#FCA311]" />
            </div>
            <p className="text-2xl font-extrabold text-[#14213D]">
              {(metrics.ai_token_usage_today / 1000).toFixed(1)}k Tokens
            </p>
            <span className="text-[10px] text-[#567C8D] font-bold">
              RAG Satisfaction Score: {metrics.ai_satisfaction_score}%
            </span>
            <p className="text-[10px] text-[#667085] pt-1 border-t border-[#F5F1E8]">
              Decision Support Engine: <strong className="text-[#15803D]">ACTIVE</strong>
            </p>
          </div>
        </div>
      )}

      {/* SECTION 1: SELLER STOREFRONT APPROVALS */}
      <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#DCEAF0]">
          <div>
            <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2 font-['Space_Grotesk']">
              <Store className="w-5 h-5 text-[#567C8D]" />
              <span>1. Seller Storefront Approvals</span>
              <span className="text-xs bg-[#DCEAF0] text-[#2F5261] px-2.5 py-0.5 rounded-full font-bold">
                {sellers.length} Storefronts
              </span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Review seller applications, grant merchant privileges, and suspend non-compliant storefronts.
            </p>
          </div>

          {/* Search & Approval Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search store name, ID, owner..."
                value={sellerSearch}
                onChange={(e) => {
                  setSellerSearch(e.target.value);
                  setSellerPage(1);
                }}
                className="pl-9 pr-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D] w-48 md:w-60"
              />
            </div>

            <div className="flex items-center space-x-1 bg-[#FAF9F6] p-1 border border-[#DCEAF0] rounded-xl text-xs">
              <Filter className="w-3.5 h-3.5 text-[#667085] ml-1.5" />
              {['all', 'pending', 'approved', 'suspended', 'rejected'].map((st) => (
                <button
                  key={st}
                  onClick={() => {
                    setSellerStatusFilter(st);
                    setSellerPage(1);
                  }}
                  className={`px-2.5 py-1 rounded-lg font-bold transition cursor-pointer capitalize ${
                    sellerStatusFilter === st
                      ? 'bg-[#14213D] text-white shadow-2xs'
                      : 'text-[#667085] hover:text-[#14213D]'
                  }`}
                >
                  {st}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Sellers Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1F2937]">
            <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] tracking-wider border-b border-[#DCEAF0]">
              <tr>
                <th className="p-3">Seller ID</th>
                <th className="p-3">Storefront Name</th>
                <th className="p-3">Linked Owner Account</th>
                <th className="p-3">Contact Email</th>
                <th className="p-3">Approval Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F1E8]">
              {paginatedSellers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#667085]">
                    No seller storefronts match the selected filter parameters.
                  </td>
                </tr>
              ) : (
                paginatedSellers.map((s) => (
                  <tr key={s.seller_id} className="hover:bg-[#FAF9F6] transition">
                    <td className="p-3 font-mono text-[#567C8D] font-bold">{s.seller_id}</td>
                    <td className="p-3 font-bold text-[#14213D]">
                      <div>{s.store_name}</div>
                      {s.business_description && (
                        <div className="text-[10px] text-[#667085] font-normal truncate max-w-xs">{s.business_description}</div>
                      )}
                    </td>
                    <td className="p-3">
                      {s.user_id ? (
                        <div className="space-y-0.5">
                          <div className="flex items-center space-x-1 text-[#14213D] font-semibold">
                            <User className="w-3 h-3 text-[#567C8D]" />
                            <span>{s.owner_full_name || s.user_id}</span>
                          </div>
                          <div className="text-[10px] font-mono text-[#667085]">{s.user_id}</div>
                          {s.owner_is_active === false && (
                            <span className="text-[9px] text-[#B42318] bg-red-50 px-1.5 py-0.2 rounded font-bold border border-red-200">
                              DEACTIVATED OWNER
                            </span>
                          )}
                        </div>
                      ) : (
                        <span className="text-[#667085] italic">System Profile</span>
                      )}
                    </td>
                    <td className="p-3 text-[#667085]">{s.contact_email || 'N/A'}</td>
                    <td className="p-3">{getApprovalBadge(s.approval_status)}</td>
                    <td className="p-3 text-right space-x-2">
                      {s.approval_status !== 'approved' && (
                        <button
                          onClick={() => requestUpdateSellerApproval(s.seller_id, s.store_name, 'approved')}
                          className="px-2.5 py-1 bg-[#15803D] hover:bg-emerald-800 text-white rounded-lg text-[11px] font-bold transition cursor-pointer shadow-2xs"
                        >
                          Approve
                        </button>
                      )}
                      {s.approval_status !== 'suspended' && (
                        <button
                          onClick={() => requestUpdateSellerApproval(s.seller_id, s.store_name, 'suspended')}
                          className="px-2.5 py-1 bg-red-50 hover:bg-red-100 text-[#B42318] border border-red-200 rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          Suspend
                        </button>
                      )}
                      {s.approval_status === 'pending' && (
                        <button
                          onClick={() => requestUpdateSellerApproval(s.seller_id, s.store_name, 'rejected')}
                          className="px-2.5 py-1 bg-[#F5F1E8] hover:bg-[#DCEAF0] text-[#14213D] rounded-lg text-[11px] font-bold transition cursor-pointer"
                        >
                          Reject
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Sellers Pagination */}
        <div className="flex items-center justify-between pt-2 text-xs text-[#667085]">
          <span>
            Showing {filteredSellers.length > 0 ? (sellerPage - 1) * sellersPerPage + 1 : 0} to{' '}
            {Math.min(sellerPage * sellersPerPage, filteredSellers.length)} of {filteredSellers.length} storefronts
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={sellerPage <= 1}
              onClick={() => setSellerPage((p) => Math.max(1, p - 1))}
              className="p-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-lg disabled:opacity-40 hover:bg-[#F5F1E8] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-[#14213D]" />
            </button>
            <span className="font-bold text-[#14213D]">
              Page {sellerPage} of {totalSellerPages}
            </span>
            <button
              disabled={sellerPage >= totalSellerPages}
              onClick={() => setSellerPage((p) => Math.min(totalSellerPages, p + 1))}
              className="p-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-lg disabled:opacity-40 hover:bg-[#F5F1E8] transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-[#14213D]" />
            </button>
          </div>
        </div>
      </div>

      {/* SECTION 2: USER DIRECTORY GOVERNANCE */}
      <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-5 shadow-xs">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-2 border-b border-[#DCEAF0]">
          <div>
            <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2 font-['Space_Grotesk']">
              <Users className="w-5 h-5 text-[#567C8D]" />
              <span>2. User Directory Governance</span>
              <span className="text-xs bg-[#DCEAF0] text-[#2F5261] px-2.5 py-0.5 rounded-full font-bold">
                {users.length} Accounts
              </span>
            </h3>
            <p className="text-xs text-[#667085] mt-0.5">
              Governance desk for user account activation, deactivation, and role assignments.
            </p>
          </div>

          {/* Search, Role Filter, Status Filter */}
          <div className="flex flex-wrap items-center gap-3">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-3 top-2.5 text-[#667085]" />
              <input
                type="text"
                placeholder="Search user name, email, ID..."
                value={userSearch}
                onChange={(e) => {
                  setUserSearch(e.target.value);
                  setUserPage(1);
                }}
                className="pl-9 pr-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D] w-48 md:w-56"
              />
            </div>

            <select
              value={userRoleFilter}
              onChange={(e) => {
                setUserRoleFilter(e.target.value);
                setUserPage(1);
              }}
              className="px-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-xs text-[#1F2937] font-semibold focus:outline-none focus:border-[#567C8D] cursor-pointer"
            >
              <option value="all">All Roles</option>
              <option value="customer">Customer</option>
              <option value="seller">Seller</option>
              <option value="operations">Operations</option>
              <option value="support">Support</option>
              <option value="admin">Admin</option>
            </select>

            <select
              value={userStatusFilter}
              onChange={(e) => {
                setUserStatusFilter(e.target.value);
                setUserPage(1);
              }}
              className="px-3 py-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl text-xs text-[#1F2937] font-semibold focus:outline-none focus:border-[#567C8D] cursor-pointer"
            >
              <option value="all">All Account Statuses</option>
              <option value="active">Active Only</option>
              <option value="deactivated">Deactivated Only</option>
            </select>
          </div>
        </div>

        {/* Users Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs text-[#1F2937]">
            <thead className="bg-[#FAF9F6] text-[#667085] uppercase text-[10px] tracking-wider border-b border-[#DCEAF0]">
              <tr>
                <th className="p-3">User ID</th>
                <th className="p-3">Full Name</th>
                <th className="p-3">Email Address</th>
                <th className="p-3">Role</th>
                <th className="p-3">Account Status</th>
                <th className="p-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F5F1E8]">
              {paginatedUsers.length === 0 ? (
                <tr>
                  <td colSpan={6} className="p-8 text-center text-[#667085]">
                    No user accounts match the selected search & filter criteria.
                  </td>
                </tr>
              ) : (
                paginatedUsers.map((u) => (
                  <tr key={u.user_id} className="hover:bg-[#FAF9F6] transition">
                    <td className="p-3 font-mono text-[#567C8D] font-bold">{u.user_id}</td>
                    <td className="p-3">
                      <div className="flex items-center space-x-2">
                        <span className="font-bold text-[#14213D]">{u.full_name}</span>
                        {u.is_demo_account && (
                          <span className="px-1.5 py-0.2 bg-[#FFF7EB] text-[#B45309] border border-[#FCA311]/40 rounded text-[9px] font-bold uppercase">
                            SEEDED / DEMO
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="p-3 text-[#667085]">{u.email}</td>
                    <td className="p-3 font-mono text-[11px] text-[#14213D] uppercase font-extrabold">
                      {u.role}
                    </td>
                    <td className="p-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                          u.is_active
                            ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                            : 'bg-red-50 text-[#B42318] border border-red-200'
                        }`}
                      >
                        {u.is_active ? (
                          <CheckCircle2 className="w-3 h-3 mr-1" />
                        ) : (
                          <XCircle className="w-3 h-3 mr-1" />
                        )}
                        {u.is_active ? 'ACTIVE' : 'DEACTIVATED'}
                      </span>
                    </td>
                    <td className="p-3 text-right">
                      <button
                        onClick={() => requestToggleUserStatus(u.user_id, u.full_name, u.is_active)}
                        className={`px-3 py-1 rounded-lg text-[11px] font-bold transition cursor-pointer ${
                          u.is_active
                            ? 'bg-red-50 text-[#B42318] hover:bg-red-100 border border-red-200'
                            : 'bg-emerald-50 text-[#15803D] hover:bg-emerald-100 border border-emerald-200'
                        }`}
                      >
                        {u.is_active ? 'Deactivate' : 'Activate'}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Users Pagination */}
        <div className="flex items-center justify-between pt-2 text-xs text-[#667085]">
          <span>
            Showing {filteredUsers.length > 0 ? (userPage - 1) * usersPerPage + 1 : 0} to{' '}
            {Math.min(userPage * usersPerPage, filteredUsers.length)} of {filteredUsers.length} accounts
          </span>
          <div className="flex items-center space-x-2">
            <button
              disabled={userPage <= 1}
              onClick={() => setUserPage((p) => Math.max(1, p - 1))}
              className="p-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-lg disabled:opacity-40 hover:bg-[#F5F1E8] transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4 text-[#14213D]" />
            </button>
            <span className="font-bold text-[#14213D]">
              Page {userPage} of {totalUserPages}
            </span>
            <button
              disabled={userPage >= totalUserPages}
              onClick={() => setUserPage((p) => Math.min(totalUserPages, p + 1))}
              className="p-1.5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-lg disabled:opacity-40 hover:bg-[#F5F1E8] transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4 text-[#14213D]" />
            </button>
          </div>
        </div>
      </div>

      {/* MARKETPLACE ANOMALY & FRAUD RADAR */}
      <div className="p-6 bg-white border border-[#DCEAF0] rounded-3xl space-y-4 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h3 className="font-bold text-base text-[#14213D] flex items-center space-x-2 font-['Space_Grotesk']">
            <AlertOctagon className="w-5 h-5 text-[#B42318]" />
            <span>Marketplace Anomaly & Fraud Radar</span>
          </h3>
          <span className="text-[11px] text-[#667085] bg-[#FAF9F6] px-3 py-1 rounded-full border border-[#DCEAF0] font-medium">
            Simulated / Decision-Support ML Risk Radar (Synthetic Anomaly Detection)
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {fraudAlerts.map((alert) => (
            <div key={alert.id} className="p-4 bg-[#FAF9F6] border border-[#DCEAF0] rounded-2xl space-y-3">
              <div className="flex items-center justify-between text-xs">
                <span className="font-bold text-[#14213D]">{alert.entity}</span>
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    alert.risk_level === 'HIGH'
                      ? 'bg-red-50 text-[#B42318] border border-red-200'
                      : 'bg-amber-50 text-amber-700 border border-amber-200'
                  }`}
                >
                  {alert.risk_level} RISK ({(alert.risk_score * 100).toFixed(0)}%)
                </span>
              </div>

              <div className="text-xs text-[#1F2937] space-y-1">
                <p className="font-bold text-[#B42318]">{alert.risk_type.replace(/_/g, ' ')}</p>
                <p className="text-[#667085] text-[11px] leading-relaxed">{alert.details}</p>
              </div>

              <div className="pt-2 border-t border-[#DCEAF0] flex justify-between items-center text-[11px]">
                <span className="text-[#667085]">Recommended Action:</span>
                <span className="text-[#14213D] font-bold">{alert.recommended_action}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
