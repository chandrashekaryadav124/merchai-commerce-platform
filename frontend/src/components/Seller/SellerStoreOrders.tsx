import { useState, useEffect } from 'react';
import type { SellerOrderDetail } from '../../types';
import { fetchSellerOrders, updateSellerOrderStatus } from '../../services/api';
import {
  ClipboardList,
  Search,
  CheckCircle2,
  Clock,
  Package,
  Truck,
  Eye,
  MapPin,
  Phone,
  Mail,
  X,
  RefreshCw,
  ArrowRight
} from 'lucide-react';
import { StatusBadge, EmptyState, LoadingSkeleton } from '../common';

export function SellerStoreOrders() {
  const [orders, setOrders] = useState<SellerOrderDetail[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedOrder, setSelectedOrder] = useState<SellerOrderDetail | null>(null);
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [transitionNotes, setTransitionNotes] = useState<string>('');

  const loadOrders = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await fetchSellerOrders(statusFilter, searchTerm);
      setOrders(data);
    } catch (err: any) {
      console.error('Failed to load seller orders:', err);
      setError(err.message || 'Unable to retrieve store orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, [statusFilter]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadOrders();
  };

  const handleStatusTransition = async (orderId: number, nextStatus: string) => {
    try {
      setIsUpdating(true);
      const updated = await updateSellerOrderStatus(orderId, nextStatus, transitionNotes || undefined);
      // Update local orders list
      setOrders((prev) => prev.map((o) => (o.seller_order_id === orderId ? updated : o)));
      if (selectedOrder && selectedOrder.seller_order_id === orderId) {
        setSelectedOrder(updated);
      }
      setTransitionNotes('');
    } catch (err: any) {
      alert(err.message || 'Failed to update order status');
    } finally {
      setIsUpdating(false);
    }
  };

  // Get permissible seller action button config
  const getActionConfig = (status: string) => {
    const s = (status || '').toUpperCase();
    switch (s) {
      case 'PLACED':
        return {
          label: 'Accept Order',
          nextStatus: 'ACCEPTED',
          color: 'bg-emerald-600 hover:bg-emerald-700 text-white',
          icon: CheckCircle2
        };
      case 'ACCEPTED':
        return {
          label: 'Start Packing',
          nextStatus: 'PROCESSING',
          color: 'bg-indigo-600 hover:bg-indigo-700 text-white',
          icon: Package
        };
      case 'PROCESSING':
        return {
          label: 'Mark Packed',
          nextStatus: 'PACKED',
          color: 'bg-blue-600 hover:bg-blue-700 text-white',
          icon: Package
        };
      case 'PACKED':
        return {
          label: 'Ready for Pickup',
          nextStatus: 'READY_FOR_PICKUP',
          color: 'bg-amber-600 hover:bg-amber-700 text-white',
          icon: Truck
        };
      default:
        return null;
    }
  };

  const statusTabs = [
    { key: 'ALL', label: 'All Orders' },
    { key: 'PLACED', label: 'Placed' },
    { key: 'ACCEPTED', label: 'Accepted' },
    { key: 'PROCESSING', label: 'Processing' },
    { key: 'PACKED', label: 'Packed' },
    { key: 'READY_FOR_PICKUP', label: 'Ready for Pickup' },
    { key: 'HANDED_OVER', label: 'Handed Over' },
    { key: 'DELIVERED', label: 'Delivered' },
    { key: 'CANCELLED', label: 'Cancelled' }
  ];

  return (
    <div className="space-y-6">
      {/* Header & Filter Controls */}
      <div className="bg-white p-5 rounded-2xl border border-slate-200/80 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
              <ClipboardList className="w-5 h-5 text-amber-500" />
              <span>Store Orders & Customer Delivery Details</span>
            </h2>
            <p className="text-xs text-slate-500">
              Manage fulfillment progression from order acceptance to carrier pickup hand-off.
            </p>
          </div>

          <button
            onClick={loadOrders}
            disabled={loading}
            className="self-start sm:self-auto inline-flex items-center gap-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-xs font-semibold transition"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 custom-scrollbar">
          {statusTabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold whitespace-nowrap transition cursor-pointer ${
                statusFilter === tab.key
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'bg-slate-50 hover:bg-slate-100 text-slate-600 border border-slate-200/60'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search Bar */}
        <form onSubmit={handleSearchSubmit} className="flex gap-2">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by order ID (#ORD...), customer recipient, or city..."
              className="w-full bg-slate-50 border border-slate-200/80 rounded-xl pl-9 pr-4 py-2 text-xs text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-hidden focus:ring-2 focus:ring-slate-900/10 focus:border-slate-900 transition"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white rounded-xl text-xs font-bold transition shadow-xs"
          >
            Search
          </button>
        </form>
      </div>

      {/* Orders Data Table */}
      {loading ? (
        <LoadingSkeleton count={4} />
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-2xl text-center text-red-800 text-xs">
          {error}
        </div>
      ) : orders.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title="No orders found"
          description="There are currently no customer store orders matching your selected status criteria."
        />
      ) : (
        <div className="bg-white border border-slate-200/80 rounded-2xl shadow-xs overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50/80 border-b border-slate-200/80 text-[11px] font-bold text-slate-500 uppercase tracking-wider">
                  <th className="py-3 px-4">Order Ref</th>
                  <th className="py-3 px-4">Customer Delivery</th>
                  <th className="py-3 px-4">Products Ordered</th>
                  <th className="py-3 px-4 text-right">Subtotal</th>
                  <th className="py-3 px-4 text-center">Payment</th>
                  <th className="py-3 px-4 text-center">Fulfillment Status</th>
                  <th className="py-3 px-4 text-center">Shipment</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {orders.map((ord) => {
                  const action = getActionConfig(ord.status);
                  const isReadyOrDispatched = ['READY_FOR_PICKUP', 'HANDED_OVER', 'IN_TRANSIT', 'DELIVERED'].includes(
                    ord.status.toUpperCase()
                  );

                  return (
                    <tr key={ord.seller_order_id} className="hover:bg-slate-50/60 transition group">
                      {/* Order Reference */}
                      <td className="py-3.5 px-4">
                        <div className="font-mono font-bold text-slate-900">#SO-{ord.seller_order_id}</div>
                        <div className="text-[11px] font-mono text-slate-400">{ord.order_id}</div>
                        <div className="text-[10px] text-slate-400 mt-0.5">{ord.order_date || 'Recent'}</div>
                      </td>

                      {/* Customer Delivery Information */}
                      <td className="py-3.5 px-4 max-w-[200px]">
                        <div className="font-semibold text-slate-900 truncate">{ord.customer_name || 'Customer'}</div>
                        <div className="text-[11px] text-slate-500 flex items-center gap-1">
                          <MapPin className="w-3 h-3 text-slate-400 shrink-0" />
                          <span className="truncate">{ord.delivery_city || 'City'}, {ord.delivery_state || ''}</span>
                        </div>
                        {ord.customer_phone_masked && (
                          <div className="text-[10px] text-slate-400 font-mono mt-0.5">
                            {ord.customer_phone_masked}
                          </div>
                        )}
                      </td>

                      {/* Ordered Products Preview */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {ord.items.slice(0, 2).map((it) => (
                            <div key={it.seller_order_item_id} className="flex items-center gap-2">
                              {it.primary_image ? (
                                <img
                                  src={it.primary_image}
                                  alt={it.title}
                                  className="w-6 h-6 rounded object-cover border border-slate-200"
                                />
                              ) : (
                                <div className="w-6 h-6 rounded bg-slate-100 flex items-center justify-center text-slate-400 text-[10px]">
                                  <Package className="w-3 h-3" />
                                </div>
                              )}
                              <span className="truncate max-w-[140px] text-slate-800 font-medium">
                                {it.title}
                              </span>
                              <span className="text-[10px] text-slate-400 font-mono">x{it.quantity}</span>
                            </div>
                          ))}
                          {ord.items.length > 2 && (
                            <span className="text-[10px] text-slate-400 font-semibold">
                              +{ord.items.length - 2} more item(s)
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Subtotal */}
                      <td className="py-3.5 px-4 text-right">
                        <span className="font-mono font-bold text-slate-900">
                          ₹{(ord.subtotal || 0).toLocaleString('en-IN')}
                        </span>
                      </td>

                      {/* Payment Status */}
                      <td className="py-3.5 px-4 text-center">
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold border ${
                            ord.payment_status?.toLowerCase() === 'paid' || ord.payment_status?.toLowerCase() === 'captured'
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-amber-50 text-amber-700 border-amber-200'
                          }`}
                        >
                          {ord.payment_status || 'Pending'}
                        </span>
                      </td>

                      {/* Order Status */}
                      <td className="py-3.5 px-4 text-center">
                        <StatusBadge status={ord.status} size="sm" />
                      </td>

                      {/* Shipment & Tracking Badge */}
                      <td className="py-3.5 px-4 text-center">
                        {ord.tracking_number ? (
                          <div className="text-[10px] font-mono">
                            <span className="px-2 py-0.5 rounded-md bg-blue-50 text-blue-700 border border-blue-200 font-bold">
                              {ord.courier_name || 'Carrier'}: {ord.tracking_number}
                            </span>
                          </div>
                        ) : isReadyOrDispatched ? (
                          <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md border border-amber-200">
                            Awaiting Dispatch
                          </span>
                        ) : (
                          <span className="text-[10px] text-slate-400">Not Dispatched</span>
                        )}
                      </td>

                      {/* Action Buttons */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {action && (
                            <button
                              onClick={() => handleStatusTransition(ord.seller_order_id, action.nextStatus)}
                              disabled={isUpdating}
                              className={`px-2.5 py-1.5 rounded-lg text-[11px] font-bold shadow-xs transition inline-flex items-center gap-1 cursor-pointer ${action.color}`}
                              title={`Advance order to ${action.nextStatus}`}
                            >
                              <action.icon className="w-3.5 h-3.5" />
                              <span>{action.label}</span>
                            </button>
                          )}

                          <button
                            onClick={() => setSelectedOrder(ord)}
                            className="p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
                            title="View Full Order Details"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* DETAILED ORDER MODAL */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/60 backdrop-blur-xs">
          <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] overflow-y-auto shadow-2xl border border-slate-200/80 animate-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="sticky top-0 bg-white border-b border-slate-100 p-5 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center font-bold">
                  <ClipboardList className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-extrabold text-slate-900 text-base">
                    Order #SO-{selectedOrder.seller_order_id}
                  </h3>
                  <p className="text-xs text-slate-500 font-mono">
                    Parent Order: {selectedOrder.order_id} • Placed {selectedOrder.order_date || 'N/A'}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <StatusBadge status={selectedOrder.status} size="sm" />
                <button
                  onClick={() => setSelectedOrder(null)}
                  className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-100 transition"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            {/* Modal Content */}
            <div className="p-6 space-y-6 text-xs text-slate-600">
              {/* Customer & Delivery Section */}
              <div className="bg-slate-50 p-4 rounded-2xl border border-slate-200/80 space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <MapPin className="w-4 h-4 text-amber-500" />
                  <span>Customer Delivery Address & Packaging Label Info</span>
                </h4>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                  <div>
                    <span className="text-[10px] text-slate-400 font-semibold uppercase">Recipient Name</span>
                    <p className="font-bold text-slate-900 text-sm">{selectedOrder.customer_name || 'Customer'}</p>
                    <p className="text-slate-600 mt-1 whitespace-pre-line leading-relaxed">
                      {selectedOrder.shipping_address || 'No address specified'}
                    </p>
                    <p className="font-semibold text-slate-800 mt-1">
                      {selectedOrder.delivery_city}, {selectedOrder.delivery_state} - {selectedOrder.delivery_pincode || ''}
                    </p>
                  </div>

                  <div className="space-y-2 border-t sm:border-t-0 sm:border-l border-slate-200/80 sm:pl-3 pt-2 sm:pt-0">
                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Contact Phone (Masked)</span>
                      <p className="font-mono text-slate-800 flex items-center gap-1">
                        <Phone className="w-3 h-3 text-slate-400" />
                        <span>{selectedOrder.customer_phone_masked || 'Not available'}</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Contact Email (Masked)</span>
                      <p className="font-mono text-slate-800 flex items-center gap-1 truncate">
                        <Mail className="w-3 h-3 text-slate-400" />
                        <span className="truncate">{selectedOrder.customer_email_masked || 'Not available'}</span>
                      </p>
                    </div>

                    <div>
                      <span className="text-[10px] text-slate-400 font-semibold uppercase">Payment Summary</span>
                      <p className="font-semibold text-slate-900">
                        {selectedOrder.payment_method || 'Standard Method'} •{' '}
                        <span className="font-bold text-emerald-600">{selectedOrder.payment_status || 'Pending'}</span>
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* Items Section */}
              <div className="space-y-3">
                <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                  <Package className="w-4 h-4 text-indigo-500" />
                  <span>Items Ordered from Your Catalog ({selectedOrder.items.length})</span>
                </h4>

                <div className="border border-slate-200/80 rounded-2xl overflow-hidden divide-y divide-slate-100">
                  {selectedOrder.items.map((it) => (
                    <div key={it.seller_order_item_id} className="p-3 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        {it.primary_image ? (
                          <img
                            src={it.primary_image}
                            alt={it.title}
                            className="w-12 h-12 rounded-xl object-cover border border-slate-200 shrink-0"
                          />
                        ) : (
                          <div className="w-12 h-12 rounded-xl bg-slate-100 flex items-center justify-center text-slate-400 shrink-0">
                            <Package className="w-5 h-5" />
                          </div>
                        )}
                        <div>
                          <p className="font-bold text-slate-900 text-xs">{it.title}</p>
                          <div className="flex items-center gap-2 text-[10px] text-slate-400 font-mono">
                            <span>SKU: {it.sku || it.product_id}</span>
                            <span>•</span>
                            <span>Qty: {it.quantity}</span>
                          </div>
                        </div>
                      </div>

                      <div className="text-right">
                        <p className="font-bold text-slate-900 font-mono text-xs">
                          ₹{it.subtotal.toLocaleString('en-IN')}
                        </p>
                        <p className="text-[10px] text-slate-400 font-mono">
                          ₹{it.unit_price} each
                        </p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="flex justify-between items-center px-3 py-2 bg-slate-50 rounded-xl font-bold text-slate-900 text-xs">
                  <span>Store Order Subtotal</span>
                  <span className="font-mono text-sm">₹{selectedOrder.subtotal.toLocaleString('en-IN')}</span>
                </div>
              </div>

              {/* Shipment Info Section */}
              <div className="bg-blue-50/50 p-4 rounded-2xl border border-blue-100 space-y-2">
                <h4 className="font-bold text-blue-950 text-xs flex items-center gap-1.5">
                  <Truck className="w-4 h-4 text-blue-600" />
                  <span>Logistics & Shipment Details</span>
                </h4>

                {selectedOrder.tracking_number ? (
                  <div className="grid grid-cols-2 gap-2 text-xs">
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Courier Carrier</span>
                      <p className="font-bold text-slate-900">{selectedOrder.courier_name || 'Assigned Courier'}</p>
                    </div>
                    <div>
                      <span className="text-[10px] text-slate-400 uppercase font-semibold">Tracking Number</span>
                      <p className="font-mono font-bold text-blue-700">{selectedOrder.tracking_number}</p>
                    </div>
                  </div>
                ) : (
                  <p className="text-xs text-slate-500">
                    Package awaiting pickup request or operations allocation. Once marked Ready for Pickup, operations will assign the courier partner.
                  </p>
                )}
              </div>

              {/* Status History Timeline */}
              {selectedOrder.status_history && selectedOrder.status_history.length > 0 && (
                <div className="space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-slate-500" />
                    <span>Order Fulfillment Timeline</span>
                  </h4>

                  <div className="space-y-2 pl-2 border-l-2 border-slate-200">
                    {selectedOrder.status_history.map((hist) => (
                      <div key={hist.history_id} className="relative pl-4 space-y-0.5">
                        <div className="absolute -left-[11px] top-1 w-2.5 h-2.5 rounded-full bg-slate-400" />
                        <div className="flex items-center gap-2">
                          <span className="font-bold text-slate-800 text-[11px]">
                            {hist.new_status}
                          </span>
                          <span className="text-[10px] text-slate-400 font-mono">
                            {hist.created_at ? new Date(hist.created_at).toLocaleString() : ''}
                          </span>
                        </div>
                        {hist.notes && <p className="text-[11px] text-slate-500">{hist.notes}</p>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Action Progression Controls Inside Modal */}
              {getActionConfig(selectedOrder.status) && (
                <div className="p-4 bg-slate-50 border border-slate-200/80 rounded-2xl space-y-3">
                  <h4 className="font-bold text-slate-900 text-xs">Advance Order Progression</h4>
                  <div>
                    <input
                      type="text"
                      value={transitionNotes}
                      onChange={(e) => setTransitionNotes(e.target.value)}
                      placeholder="Optional notes for fulfillment log (e.g. Boxed with bubble wrap)..."
                      className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-800 placeholder:text-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900/10"
                    />
                  </div>
                  <div className="flex justify-end gap-2">
                    <button
                      onClick={() => {
                        const act = getActionConfig(selectedOrder.status);
                        if (act) handleStatusTransition(selectedOrder.seller_order_id, act.nextStatus);
                      }}
                      disabled={isUpdating}
                      className="px-4 py-2 bg-slate-900 hover:bg-slate-800 text-white font-bold rounded-xl text-xs transition shadow-xs flex items-center gap-1.5 cursor-pointer"
                    >
                      <ArrowRight className="w-3.5 h-3.5" />
                      <span>Proceed to {getActionConfig(selectedOrder.status)?.nextStatus}</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
