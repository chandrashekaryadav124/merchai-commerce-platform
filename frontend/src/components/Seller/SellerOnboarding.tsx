import React, { useState, useEffect } from 'react';
import type { User } from '../../types';
import { fetchMySellerProfile, applyForSeller, STORE_TYPES } from '../../services/api';
import {
  Store,
  ShieldCheck,
  Clock,
  CheckCircle2,
  AlertOctagon,
  XCircle,
  Building,
  Mail,
  Phone,
  MapPin,
  Sparkles,
  ArrowRight,
  RefreshCw,
  Tag
} from 'lucide-react';

interface SellerOnboardingProps {
  currentUser: User | null;
  onOpenAuth: () => void;
  onGoToSellerDashboard: () => void;
}

export const SellerOnboarding: React.FC<SellerOnboardingProps> = ({
  currentUser,
  onOpenAuth,
  onGoToSellerDashboard
}) => {
  const [sellerProfile, setSellerProfile] = useState<any | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form inputs
  const [storeName, setStoreName] = useState<string>('');
  const [storeType, setStoreType] = useState<string>('Fashion & Footwear');
  const [businessDesc, setBusinessDesc] = useState<string>('');
  const [contactEmail, setContactEmail] = useState<string>(currentUser?.email || '');
  const [contactPhone, setContactPhone] = useState<string>('');
  const [businessAddress, setBusinessAddress] = useState<string>('');

  useEffect(() => {
    if (currentUser?.email && !contactEmail) {
      setContactEmail(currentUser.email);
    }
  }, [currentUser]);

  useEffect(() => {
    checkProfile();
  }, [currentUser]);

  const checkProfile = async () => {
    if (!currentUser) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const profile = await fetchMySellerProfile();
      setSellerProfile(profile);
    } catch {
      // 404 or no profile means eligible to apply
      setSellerProfile(null);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!currentUser) {
      onOpenAuth();
      return;
    }

    if (!storeName.trim() || storeName.trim().length < 2) {
      setError('Store Name is required and must be at least 2 characters.');
      return;
    }

    if (!storeType.trim()) {
      setError('Store Type / Business Category is required.');
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccessMsg(null);

    try {
      const newProfile = await applyForSeller({
        store_name: storeName.trim(),
        store_type: storeType.trim(),
        business_description: businessDesc.trim(),
        contact_email: contactEmail.trim() || currentUser.email,
        contact_phone: contactPhone.trim(),
        business_address: businessAddress.trim()
      });

      setSellerProfile(newProfile);
      setSuccessMsg('🎉 Store onboarding application submitted successfully! Status is set to PENDING administrative review.');
    } catch (err: any) {
      setError(err.message || 'Failed to submit store application.');
    } finally {
      setSubmitting(false);
    }
  };

  if (!currentUser) {
    return (
      <div className="my-12 max-w-xl mx-auto p-8 bg-white border border-[#DCEAF0] rounded-3xl text-center space-y-6 shadow-xl">
        <div className="w-16 h-16 bg-[#14213D] rounded-3xl flex items-center justify-center mx-auto text-[#FCA311] shadow-md">
          <Store className="w-8 h-8" />
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-extrabold text-[#14213D] tracking-tight font-['Space_Grotesk']">
            Become a Seller Partner
          </h2>
          <p className="text-sm text-[#667085] max-w-md mx-auto leading-relaxed">
            Expand your merchant business across our AI-powered discovery network. Sign in or create an account to start your store onboarding.
          </p>
        </div>
        <button
          onClick={onOpenAuth}
          className="px-8 py-3.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-2xl font-bold text-xs transition-all shadow-md flex items-center justify-center space-x-2 mx-auto cursor-pointer"
        >
          <span>Sign In / Register to Apply</span>
          <ArrowRight className="w-4 h-4 text-[#FCA311]" />
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="py-20 text-center space-y-3">
        <RefreshCw className="w-8 h-8 text-[#567C8D] animate-spin mx-auto" />
        <p className="text-xs text-[#667085] font-semibold">Verifying seller profile & application status...</p>
      </div>
    );
  }

  // STATUS PAGE VIEW IF APPLICATION/PROFILE EXISTS
  if (sellerProfile) {
    const status = sellerProfile.approval_status;

    return (
      <div className="max-w-3xl mx-auto space-y-6 py-6">
        <div className="p-8 bg-white border border-[#DCEAF0] rounded-3xl space-y-6 shadow-xl">
          <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-[#DCEAF0]">
            <div className="flex items-center space-x-4">
              <div className="w-14 h-14 rounded-2xl bg-[#DCEAF0] flex items-center justify-center text-[#14213D] font-black text-xl shadow-xs">
                {sellerProfile.store_name ? sellerProfile.store_name[0] : 'S'}
              </div>
              <div>
                <h2 className="text-xl font-bold text-[#14213D] font-['Space_Grotesk']">{sellerProfile.store_name}</h2>
                <p className="text-xs font-mono text-[#567C8D] font-bold">Seller ID: {sellerProfile.seller_id}</p>
              </div>
            </div>

            {/* Status Badge */}
            <div>
              {status === 'approved' && (
                <span className="px-3 py-1 bg-emerald-50 text-[#15803D] border border-emerald-300 text-xs font-bold rounded-full flex items-center space-x-1.5 uppercase">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Approved</span>
                </span>
              )}
              {status === 'pending' && (
                <span className="px-3 py-1 bg-amber-50 text-amber-700 border border-amber-300 text-xs font-bold rounded-full flex items-center space-x-1.5 uppercase">
                  <Clock className="w-4 h-4" />
                  <span>Pending Review</span>
                </span>
              )}
              {status === 'suspended' && (
                <span className="px-3 py-1 bg-red-50 text-[#B42318] border border-red-300 text-xs font-bold rounded-full flex items-center space-x-1.5 uppercase">
                  <AlertOctagon className="w-4 h-4" />
                  <span>Suspended</span>
                </span>
              )}
              {status === 'rejected' && (
                <span className="px-3 py-1 bg-slate-100 text-slate-600 border border-slate-300 text-xs font-bold rounded-full flex items-center space-x-1.5 uppercase">
                  <XCircle className="w-4 h-4" />
                  <span>Rejected</span>
                </span>
              )}
            </div>
          </div>

          {successMsg && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 text-[#15803D] rounded-2xl text-xs font-semibold flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{successMsg}</span>
            </div>
          )}

          {/* Detailed Guidance Box */}
          <div className="p-5 bg-[#FAF9F6] border border-[#DCEAF0] rounded-2xl space-y-3">
            <h4 className="text-sm font-bold text-[#14213D] flex items-center space-x-2">
              <ShieldCheck className="w-4 h-4 text-[#567C8D]" />
              <span>Application Status & Guidelines</span>
            </h4>

            {status === 'pending' && (
              <p className="text-xs text-[#1F2937] leading-relaxed">
                Your storefront application is currently <strong>UNDER ADMINISTRATIVE REVIEW</strong>. Our operations & governance desk is verifying your business details. Selling operations (listing products and receiving merchant orders) will unlock automatically upon admin approval.
              </p>
            )}

            {status === 'approved' && (
              <div className="space-y-3">
                <p className="text-xs text-[#1F2937] leading-relaxed">
                  Congratulations! Your seller storefront application has been <strong>APPROVED</strong>. You now have full access to product creation, inventory management, demand forecasting, and seller order fulfillment.
                </p>
                <button
                  onClick={onGoToSellerDashboard}
                  className="px-6 py-2.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl text-xs font-bold transition shadow-md flex items-center space-x-2 cursor-pointer"
                >
                  <Store className="w-4 h-4 text-[#FCA311]" />
                  <span>Open Seller Portal & Dashboard</span>
                </button>
              </div>
            )}

            {status === 'suspended' && (
              <div className="space-y-3">
                <p className="text-xs text-[#B42318] leading-relaxed">
                  Storefront selling operations are currently <strong>SUSPENDED</strong> due to administrative compliance review. Product creation and order fulfillment features are disabled. Your user account remains active to permit appeals.
                </p>
              </div>
            )}

            {status === 'rejected' && (
              <p className="text-xs text-[#667085] leading-relaxed">
                Your store application was not approved by marketplace administrators. Please review your submitted contact details or reach out to support.
              </p>
            )}
          </div>

          {/* Metadata details */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-xs text-[#667085] pt-2 border-t border-[#DCEAF0]">
            <div>
              <span className="text-[10px] text-[#667085] uppercase font-bold">Store Type / Category</span>
              <p className="text-[#14213D] font-bold mt-0.5">{sellerProfile.store_type || 'Other / General Store'}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#667085] uppercase font-bold">Contact Email</span>
              <p className="text-[#14213D] font-medium mt-0.5">{sellerProfile.contact_email || 'N/A'}</p>
            </div>
            <div>
              <span className="text-[10px] text-[#667085] uppercase font-bold">Business Description</span>
              <p className="text-[#14213D] font-medium truncate mt-0.5">{sellerProfile.business_description || 'N/A'}</p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // STORE APPLICATION FORM VIEW (IF NO PROFILE EXISTS YET)
  return (
    <div className="max-w-2xl mx-auto py-6 space-y-6">
      <div className="p-8 bg-white border border-[#DCEAF0] rounded-3xl space-y-6 shadow-xl">
        <div className="flex items-center space-x-3 pb-4 border-b border-[#DCEAF0]">
          <div className="w-12 h-12 rounded-2xl bg-[#DCEAF0] flex items-center justify-center text-[#14213D]">
            <Building className="w-6 h-6 text-[#567C8D]" />
          </div>
          <div>
            <h2 className="text-xl font-bold text-[#14213D] tracking-tight font-['Space_Grotesk']">Apply to Become a Partner Store</h2>
            <p className="text-xs text-[#667085]">Join our AI Commerce discovery network & reach verified Indian customers.</p>
          </div>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-[#B42318] text-xs flex items-center space-x-2">
            <AlertOctagon className="w-4 h-4 flex-shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmitApplication} className="space-y-4 text-xs">
          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">
              Storefront Name <span className="text-[#B42318]">*</span>
            </label>
            <div className="relative">
              <Store className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
              <input
                type="text"
                required
                value={storeName}
                onChange={(e) => setStoreName(e.target.value)}
                placeholder="e.g. Apex Electronics & Mobile Hub"
                className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">
              Store Type / Business Category <span className="text-[#B42318]">*</span>
            </label>
            <div className="relative">
              <Tag className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
              <select
                required
                value={storeType}
                onChange={(e) => setStoreType(e.target.value)}
                className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D] cursor-pointer"
              >
                {STORE_TYPES.map((type) => (
                  <option key={type} value={type}>
                    {type}
                  </option>
                ))}
              </select>
            </div>
            <p className="text-[10px] text-[#667085] mt-1">
              Catalog categories in your seller dashboard will be tailored to this business type.
            </p>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">Business Description</label>
            <textarea
              rows={3}
              value={businessDesc}
              onChange={(e) => setBusinessDesc(e.target.value)}
              placeholder="Tell customers and administrators about your product catalog, brand focus, and business goals..."
              className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">Store Contact Email</label>
              <div className="relative">
                <Mail className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                <input
                  type="email"
                  value={contactEmail}
                  onChange={(e) => setContactEmail(e.target.value)}
                  placeholder="merchant@example.com"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold text-[#14213D] mb-1">Store Contact Phone</label>
              <div className="relative">
                <Phone className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
                <input
                  type="tel"
                  value={contactPhone}
                  onChange={(e) => setContactPhone(e.target.value)}
                  placeholder="+91 98765 43210"
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
                />
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-bold text-[#14213D] mb-1">Business Address / Location</label>
            <div className="relative">
              <MapPin className="w-4 h-4 absolute left-3 top-3 text-[#567C8D]" />
              <input
                type="text"
                value={businessAddress}
                onChange={(e) => setBusinessAddress(e.target.value)}
                placeholder="e.g. Indiranagar, Bengaluru, Karnataka"
                className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl pl-9 pr-3 py-2.5 text-xs text-[#1F2937] placeholder-[#667085] focus:outline-none focus:border-[#567C8D]"
              />
            </div>
          </div>

          <div className="pt-2">
            <button
              type="submit"
              disabled={submitting}
              className="w-full py-3.5 bg-[#14213D] hover:bg-[#0B132B] text-white rounded-xl font-bold text-xs shadow-md transition-all flex items-center justify-center space-x-2 cursor-pointer disabled:opacity-50"
            >
              <Sparkles className="w-4 h-4 text-[#FCA311]" />
              <span>{submitting ? 'Submitting Application...' : 'Submit Store Application for Review'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
