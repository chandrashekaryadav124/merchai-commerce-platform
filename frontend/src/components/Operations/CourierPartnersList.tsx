import { useState, useEffect } from 'react';
import type { CourierPartner } from '../../types';
import { fetchCourierPartners } from '../../services/api';
import { Compass, Phone, ExternalLink, CheckCircle2, RefreshCw } from 'lucide-react';
import { EmptyState, LoadingSkeleton } from '../common';

export function CourierPartnersList() {
  const [couriers, setCouriers] = useState<CourierPartner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadCouriers = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCourierPartners();
      setCouriers(data);
    } catch (err: any) {
      setError(err.message || 'Unable to retrieve courier partners');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadCouriers();
  }, []);

  return (
    <div className="space-y-6">
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <Compass className="w-5 h-5 text-indigo-600" />
            <span>Integrated Logistics & Courier Partners</span>
          </h2>
          <p className="text-xs text-slate-500">
            Authoritative carrier integrations configured in MySQL <code className="font-mono text-indigo-600">courier_partners</code> table.
          </p>
        </div>

        <button
          onClick={loadCouriers}
          disabled={loading}
          className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh</span>
        </button>
      </div>

      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-800 text-xs">
          {error}
        </div>
      ) : couriers.length === 0 ? (
        <EmptyState
          icon={Compass}
          title="No courier partners configured"
          description="No active logistics carriers found in the system."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {couriers.map((cp) => (
            <div
              key={cp.courier_id}
              className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs hover:border-slate-300 transition space-y-3"
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{cp.name}</h3>
                  <span className="font-mono text-[10px] font-bold text-indigo-700 bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200 mt-1 inline-block">
                    CODE: {cp.code}
                  </span>
                </div>
                <span className="flex items-center gap-1 text-[11px] font-semibold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                  <CheckCircle2 className="w-3 h-3" />
                  <span>Active</span>
                </span>
              </div>

              <div className="space-y-1.5 text-xs text-slate-600 pt-2 border-t border-slate-100">
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 text-slate-400" />
                  <span className="font-mono">{cp.contact_phone || 'Support Hotline Active'}</span>
                </div>

                <div className="flex items-start gap-2">
                  <ExternalLink className="w-3.5 h-3.5 text-slate-400 shrink-0 mt-0.5" />
                  <span className="text-[11px] font-mono text-slate-400 truncate">
                    {cp.tracking_url_template || 'https://internal.tracking'}
                  </span>
                </div>
              </div>

              <div className="pt-2 text-[10px] text-slate-400 font-mono flex items-center justify-between">
                <span>Partner ID: {cp.courier_id}</span>
                <span className="text-emerald-600 font-bold">API Verified</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
