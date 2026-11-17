import { useState, useEffect } from 'react';
import type { ReadyForPickupItem, CourierPartner, ShipmentDetail } from '../../types';
import {
  fetchReadyForPickupQueue,
  fetchCourierPartners,
  createOperationsShipment
} from '../../services/api';
import {
  PackageCheck,
  Search,
  Truck,
  MapPin,
  RefreshCw,
  Building2,
  X,
  CheckCircle2
} from 'lucide-react';
import { EmptyState, LoadingSkeleton } from '../common';

export function ReadyForPickupQueue() {
  const [queue, setQueue] = useState<ReadyForPickupItem[]>([]);
  const [couriers, setCouriers] = useState<CourierPartner[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState<string>('');
  
  // Dispatch Modal State
  const [dispatchItem, setDispatchItem] = useState<ReadyForPickupItem | null>(null);
  const [selectedCourierId, setSelectedCourierId] = useState<string>('');
  const [warehouseCity, setWarehouseCity] = useState<string>('Bengaluru Central Hub');
  const [shippingMethod, setShippingMethod] = useState<string>('Standard Express');
  const [expectedDays, setExpectedDays] = useState<number>(3);
  const [notes, setNotes] = useState<string>('');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [successShipment, setSuccessShipment] = useState<ShipmentDetail | null>(null);

  const loadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [queueData, courierData] = await Promise.all([
        fetchReadyForPickupQueue(search),
        fetchCourierPartners()
      ]);
      setQueue(queueData);
      setCouriers(courierData);
      if (courierData.length > 0 && !selectedCourierId) {
        setSelectedCourierId(courierData[0].courier_id);
      }
    } catch (err: any) {
      console.error('Failed to load pickup queue:', err);
      setError(err.message || 'Unable to retrieve pickup queue');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenDispatch = (item: ReadyForPickupItem) => {
    setDispatchItem(item);
    setSuccessShipment(null);
    setNotes('');
  };

  const handleSubmitDispatch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dispatchItem || !selectedCourierId) return;

    try {
      setSubmitting(true);
      const res = await createOperationsShipment({
        seller_order_id: dispatchItem.seller_order_id,
        courier_partner_id: selectedCourierId,
        warehouse_city: warehouseCity,
        shipping_method: shippingMethod,
        expected_delivery_days: expectedDays,
        notes: notes || undefined
      });
      setSuccessShipment(res);
      // Remove dispatched item from local queue
      setQueue((prev) => prev.filter((it) => it.seller_order_id !== dispatchItem.seller_order_id));
    } catch (err: any) {
      alert(err.message || 'Failed to dispatch shipment');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Queue Header & Search */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <PackageCheck className="w-5 h-5 text-emerald-600" />
              <span>Ready for Carrier Pickup Queue</span>
            </h2>
            <p className="text-xs text-slate-500">
              Merchant parcels verified packed and labeled, awaiting carrier assignment and tracking generation.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="px-3 py-1 bg-emerald-50 text-emerald-700 font-mono font-bold text-xs rounded-full border border-emerald-200">
              {queue.length} Awaiting Dispatch
            </span>
            <button
              onClick={loadData}
              disabled={loading}
              className="p-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition cursor-pointer"
              title="Refresh Queue"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* Search */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by order ID, customer recipient, or city..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
          >
            Search
          </button>
        </form>
      </div>

      {/* Queue Table */}
      {loading ? (
        <LoadingSkeleton count={3} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-800 text-xs">
          {error}
        </div>
      ) : queue.length === 0 ? (
        <EmptyState
          icon={PackageCheck}
          title="Pickup queue is empty"
          description="All packed seller parcels have been dispatched to courier carriers. Check back once sellers mark orders Ready for Pickup."
        />
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Merchant Store</th>
                  <th className="py-3 px-4">Items Summary</th>
                  <th className="py-3 px-4">Destination</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {queue.map((item) => (
                  <tr key={item.seller_order_id} className="hover:bg-slate-50/60 transition">
                    <td className="py-3.5 px-4">
                      <div className="font-mono font-bold text-slate-900">#SO-{item.seller_order_id}</div>
                      <div className="text-[11px] font-mono text-slate-400">{item.order_id}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{item.order_date || 'Recent'}</div>
                    </td>

                    <td className="py-3.5 px-4 font-semibold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <Building2 className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                        <span className="truncate max-w-[150px]">{item.seller_store_name}</span>
                      </div>
                    </td>

                    <td className="py-3.5 px-4 text-slate-700 max-w-xs">
                      <span className="font-medium truncate block">{item.items_summary}</span>
                      <span className="text-[10px] text-slate-400">{item.items_count} item(s)</span>
                    </td>

                    <td className="py-3.5 px-4">
                      <div className="flex items-center gap-1 text-slate-800">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{item.delivery_city}, {item.delivery_state || ''}</span>
                      </div>
                      <span className="text-[10px] text-slate-400">Recipient: {item.customer_name}</span>
                    </td>

                    <td className="py-3.5 px-4 text-right font-mono font-bold text-slate-900">
                      ₹{item.subtotal.toLocaleString('en-IN')}
                    </td>

                    <td className="py-3.5 px-4 text-right">
                      <button
                        onClick={() => handleOpenDispatch(item)}
                        className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <Truck className="w-3.5 h-3.5" />
                        <span>Assign Courier</span>
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DISPATCH / CARRIER ALLOCATION MODAL */}
      {dispatchItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-lg w-full overflow-hidden shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-slate-50 border-b border-slate-100 p-5 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                  <Truck className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Assign Courier & Dispatch
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    #SO-{dispatchItem.seller_order_id} • Merchant: {dispatchItem.seller_store_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setDispatchItem(null)}
                className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg transition"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body / Form */}
            {successShipment ? (
              <div className="p-6 text-center space-y-4">
                <div className="w-14 h-14 bg-emerald-100 text-emerald-700 rounded-2xl flex items-center justify-center mx-auto shadow-sm">
                  <CheckCircle2 className="w-8 h-8" />
                </div>
                <div>
                  <h4 className="text-base font-extrabold text-slate-900">Shipment Dispatched Successfully</h4>
                  <p className="text-xs text-slate-500 mt-1">
                    Carrier assigned and authoritative tracking number allocated.
                  </p>
                </div>

                <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 text-left space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Carrier:</span>
                    <span className="font-bold text-slate-800">{successShipment.courier_name}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Tracking Number:</span>
                    <span className="font-mono font-bold text-blue-600">{successShipment.tracking_number}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Expected Delivery:</span>
                    <span className="font-semibold text-slate-800">{successShipment.expected_delivery_date}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Status:</span>
                    <span className="font-bold text-emerald-600">{successShipment.delivery_status}</span>
                  </div>
                </div>

                <button
                  onClick={() => setDispatchItem(null)}
                  className="w-full py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs cursor-pointer"
                >
                  Done
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmitDispatch} className="p-6 space-y-4 text-xs">
                {/* Parcel Summary Card */}
                <div className="bg-slate-50 p-3 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex justify-between">
                    <span className="text-slate-400">Destination:</span>
                    <span className="font-semibold text-slate-800">
                      {dispatchItem.delivery_city}, {dispatchItem.delivery_state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-400">Items:</span>
                    <span className="font-medium text-slate-700 truncate max-w-xs">{dispatchItem.items_summary}</span>
                  </div>
                </div>

                {/* Courier Partner Selector */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Select Integrated Courier Partner *
                  </label>
                  <select
                    value={selectedCourierId}
                    onChange={(e) => setSelectedCourierId(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-semibold focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  >
                    {couriers.map((cp) => (
                      <option key={cp.courier_id} value={cp.courier_id}>
                        {cp.name} ({cp.code})
                      </option>
                    ))}
                  </select>
                </div>

                {/* Dispatch Warehouse */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Origin Warehouse / Fulfillment Hub
                  </label>
                  <input
                    type="text"
                    value={warehouseCity}
                    onChange={(e) => setWarehouseCity(e.target.value)}
                    required
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-slate-900"
                  />
                </div>

                {/* Estimated Delivery Days */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Shipping Method
                    </label>
                    <select
                      value={shippingMethod}
                      onChange={(e) => setShippingMethod(e.target.value)}
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium"
                    >
                      <option value="Standard Surface">Standard Surface</option>
                      <option value="Standard Express">Standard Express</option>
                      <option value="Priority Air Cargo">Priority Air Cargo</option>
                    </select>
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1">
                      Expected SLA (Days)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={14}
                      value={expectedDays}
                      onChange={(e) => setExpectedDays(parseInt(e.target.value) || 3)}
                      required
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 font-mono"
                    />
                  </div>
                </div>

                {/* Operational Notes */}
                <div>
                  <label className="block font-bold text-slate-800 mb-1">
                    Dispatch Notes / Waybill Reference
                  </label>
                  <input
                    type="text"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="e.g. Scanned at Bengaluru dock bay 4..."
                    className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder:text-slate-400"
                  />
                </div>

                {/* Submit Actions */}
                <div className="pt-2 flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setDispatchItem(null)}
                    className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-semibold transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition shadow-xs inline-flex items-center gap-1.5 cursor-pointer"
                  >
                    <Truck className="w-3.5 h-3.5" />
                    <span>{submitting ? 'Generating Waybill...' : 'Confirm Dispatch'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
