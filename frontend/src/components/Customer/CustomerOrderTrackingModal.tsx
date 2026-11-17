import { useState, useEffect } from 'react';
import type { CustomerOrderTracking } from '../../types';
import { fetchCustomerOrderTracking } from '../../services/api';
import {
  Truck,
  Package,
  CheckCircle2,
  MapPin,
  ExternalLink,
  Building2,
  X,
  RefreshCw
} from 'lucide-react';
import { StatusBadge, LoadingSkeleton } from '../common';

interface CustomerOrderTrackingModalProps {
  orderId: string;
  onClose: () => void;
}

export function CustomerOrderTrackingModal({ orderId, onClose }: CustomerOrderTrackingModalProps) {
  const [trackingData, setTrackingData] = useState<CustomerOrderTracking | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const loadTracking = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchCustomerOrderTracking(orderId);
      setTrackingData(data);
    } catch (err: any) {
      console.error('Failed to load tracking data:', err);
      setError(err.message || 'Unable to retrieve tracking data for this order.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTracking();
  }, [orderId]);

  const getTimelineSteps = (currentStatus: string) => {
    const s = (currentStatus || '').toUpperCase();
    const steps = [
      { key: 'PLACED', label: 'Order Placed', desc: 'Order confirmed with merchant' },
      { key: 'PACKED', label: 'Packed & Labeled', desc: 'Parcel packaged at seller facility' },
      { key: 'HANDED_OVER', label: 'Handed to Courier', desc: 'Dispatched to carrier hub' },
      { key: 'IN_TRANSIT', label: 'In Transit', desc: 'Package in flight to destination' },
      { key: 'DELIVERED', label: 'Delivered', desc: 'Package delivered to recipient' }
    ];

    const statusWeight: Record<string, number> = {
      PLACED: 1,
      ACCEPTED: 1,
      PROCESSING: 1,
      PACKED: 2,
      READY_FOR_PICKUP: 2,
      HANDED_OVER: 3,
      PICKUP_SCHEDULED: 3,
      PICKED_UP: 3,
      IN_TRANSIT: 4,
      OUT_FOR_DELIVERY: 4,
      DELIVERED: 5
    };

    const currentWeight = statusWeight[s] || 1;

    return steps.map((st, idx) => ({
      ...st,
      isCompleted: idx + 1 <= currentWeight,
      isCurrent: idx + 1 === currentWeight
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
      <div className="bg-white rounded-3xl max-w-3xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
              <Truck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-extrabold text-slate-900 text-base">
                Order Tracking & Live Status
              </h3>
              <p className="text-xs text-slate-500 font-mono">
                Order ID: {orderId}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={loadTracking}
              disabled={loading}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
              title="Refresh tracking data"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6 text-xs text-slate-600">
          {loading ? (
            <LoadingSkeleton count={3} />
          ) : error ? (
            <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-800 text-xs">
              {error}
            </div>
          ) : !trackingData ? (
            <p className="text-slate-400 text-center py-8">No tracking information available.</p>
          ) : (
            <div className="space-y-6">
              {/* Parent Order Summary */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900 text-sm">
                      {trackingData.order_id}
                    </span>
                    <StatusBadge status={trackingData.order_status} size="sm" />
                  </div>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Destination: {trackingData.recipient_name || 'Recipient'} • {trackingData.delivery_city}, {trackingData.delivery_state}
                  </p>
                </div>

                <div className="text-left sm:text-right text-[11px]">
                  <span className="text-slate-400">Total Packages in Order:</span>
                  <p className="font-bold text-slate-900 font-mono text-sm">
                    {trackingData.packages.length} {trackingData.packages.length === 1 ? 'Package' : 'Packages (Multi-Seller)'}
                  </p>
                </div>
              </div>

              {/* Multi-Seller Package Cards */}
              <div className="space-y-6">
                {trackingData.packages.map((pkg, pIdx) => {
                  const steps = getTimelineSteps(pkg.status);

                  return (
                    <div
                      key={pkg.seller_order_id}
                      className="bg-white border-2 border-slate-200 rounded-2xl overflow-hidden shadow-xs space-y-4 p-5"
                    >
                      {/* Package Title Bar */}
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-100 pb-3">
                        <div className="flex items-center gap-2">
                          <span className="w-6 h-6 rounded-full bg-slate-900 text-white font-bold text-[10px] flex items-center justify-center">
                            {pIdx + 1}
                          </span>
                          <div>
                            <h4 className="font-bold text-slate-900 text-sm flex items-center gap-1.5">
                              <Building2 className="w-4 h-4 text-amber-500" />
                              <span>Package from {pkg.seller_store_name}</span>
                            </h4>
                            <span className="text-[10px] font-mono text-slate-400">
                              Store Order Ref: #SO-{pkg.seller_order_id}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2">
                          <StatusBadge status={pkg.status} size="sm" />
                          {pkg.tracking_url && (
                            <a
                              href={pkg.tracking_url}
                              target="_blank"
                              rel="noreferrer"
                              className="px-2.5 py-1 bg-blue-50 text-blue-700 hover:bg-blue-100 border border-blue-200 rounded-lg text-[11px] font-semibold transition flex items-center gap-1"
                            >
                              <span>Carrier Tracking</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      </div>

                      {/* Carrier & Tracking Reference */}
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 bg-slate-50/70 p-3.5 rounded-xl border border-slate-200/60 text-xs">
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Assigned Carrier</span>
                          <p className="font-bold text-slate-900 mt-0.5">{pkg.courier_name || 'Carrier Pending Allocation'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Waybill Tracking #</span>
                          <p className="font-mono font-bold text-blue-600 mt-0.5">{pkg.tracking_number || 'Awaiting Handover'}</p>
                        </div>
                        <div>
                          <span className="text-[10px] text-slate-400 uppercase font-semibold">Estimated Delivery</span>
                          <p className="font-semibold text-slate-900 mt-0.5">{pkg.expected_delivery_date || 'Calculated after dispatch'}</p>
                        </div>
                      </div>

                      {/* Items in this Package */}
                      <div>
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                          Items in this parcel ({pkg.items.length})
                        </span>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          {pkg.items.map((it, itIdx) => (
                            <div
                              key={itIdx}
                              className="flex items-center gap-2.5 p-2 bg-slate-50 rounded-xl border border-slate-200/60"
                            >
                              {it.image ? (
                                <img
                                  src={it.image}
                                  alt={it.title}
                                  className="w-8 h-8 rounded-lg object-cover border border-slate-200 shrink-0"
                                />
                              ) : (
                                <div className="w-8 h-8 rounded-lg bg-slate-200 flex items-center justify-center text-slate-400 shrink-0">
                                  <Package className="w-4 h-4" />
                                </div>
                              )}
                              <div className="min-w-0 flex-1">
                                <p className="font-semibold text-slate-800 truncate text-[11px]">{it.title}</p>
                                <p className="text-[10px] text-slate-400 font-mono">Qty: {it.quantity} • ₹{it.unit_price}</p>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Stepper Progress Bar */}
                      <div className="pt-2">
                        <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-3">
                          Fulfillment Progress
                        </span>
                        <div className="grid grid-cols-5 gap-1 relative">
                          {steps.map((st, sIdx) => (
                            <div key={st.key} className="flex flex-col items-center text-center">
                              <div
                                className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition shadow-xs z-10 ${
                                  st.isCompleted
                                    ? 'bg-emerald-600 text-white'
                                    : 'bg-slate-200 text-slate-500'
                                }`}
                              >
                                {st.isCompleted ? <CheckCircle2 className="w-4 h-4" /> : sIdx + 1}
                              </div>
                              <span
                                className={`text-[10px] font-semibold mt-1.5 leading-tight ${
                                  st.isCurrent ? 'text-emerald-700 font-bold' : 'text-slate-600'
                                }`}
                              >
                                {st.label}
                              </span>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Event Log Timeline */}
                      {pkg.events && pkg.events.length > 0 && (
                        <div className="pt-2 border-t border-slate-100">
                          <span className="text-[11px] font-bold text-slate-700 uppercase tracking-wider block mb-2">
                            Checkpoint History ({pkg.events.length})
                          </span>
                          <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                            {pkg.events.map((ev) => (
                              <div key={ev.event_id} className="relative pl-4 space-y-0.5">
                                <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-blue-500" />
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 text-[11px]">{ev.status}</span>
                                  {ev.location && (
                                    <span className="text-[10px] text-slate-500 flex items-center gap-1">
                                      <MapPin className="w-3 h-3 text-slate-400" />
                                      <span>{ev.location}</span>
                                    </span>
                                  )}
                                  <span className="text-[10px] text-slate-400 font-mono ml-auto">
                                    {ev.created_at ? new Date(ev.created_at).toLocaleString() : ''}
                                  </span>
                                </div>
                                {ev.notes && <p className="text-[11px] text-slate-500">{ev.notes}</p>}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
