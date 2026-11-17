import { useState, useEffect } from 'react';
import type { SupportTicket, SupportMetrics, SupportCreationTrendPoint } from '../../types';
import {
  fetchSupportMetrics,
  fetchSupportTicketsFiltered,
  fetchSupportCreationTrend,
  updateSupportTicket
} from '../../services/api';
import {
  PageHeader,
  KPIStatCard,
  StatusBadge,
  SearchInput,
  EmptyState
} from '../common';
import {
  LifeBuoy,
  CheckCircle2,
  Clock,
  MessageSquare,
  RefreshCw,
  AlertOctagon,
  Layers,
  AlertCircle,
  TrendingUp,
  Flame
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid
} from 'recharts';

interface SupportViewProps {
  activeSubTab?: string;
}

export function SupportView({ activeSubTab }: SupportViewProps = {}) {
  const [metrics, setMetrics] = useState<SupportMetrics | null>(null);
  const [creationTrend, setCreationTrend] = useState<SupportCreationTrendPoint[]>([]);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updating, setUpdating] = useState(false);

  // Filters
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [issueTypeFilter, setIssueTypeFilter] = useState('all');
  const [priorityQueue, setPriorityQueue] = useState<'ALL' | 'DELAYS' | 'RETURNS' | 'UNRESOLVED'>('ALL');

  useEffect(() => {
    loadMetrics();
  }, []);

  useEffect(() => {
    if (!activeSubTab) return;
    const sub = activeSubTab.toLowerCase();
    if (sub === 'all_tickets') {
      setStatusFilter('all');
      setPriorityQueue('ALL');
    } else if (sub === 'new_tickets') {
      setStatusFilter('Open');
      setPriorityQueue('ALL');
    } else if (sub === 'order_issues') {
      setPriorityQueue('ALL');
      setIssueTypeFilter('Order');
    } else if (sub === 'shipment_issues') {
      setPriorityQueue('DELAYS');
    } else if (sub === 'returns_requests') {
      setPriorityQueue('RETURNS');
    } else if (sub === 'escalations') {
      setPriorityQueue('UNRESOLVED');
    }
  }, [activeSubTab]);

  useEffect(() => {
    loadTickets();
  }, [search, statusFilter, issueTypeFilter, priorityQueue]);

  const loadMetrics = async () => {
    try {
      const [m, trend] = await Promise.all([
        fetchSupportMetrics(),
        fetchSupportCreationTrend().catch(() => [])
      ]);
      setMetrics(m);
      setCreationTrend(trend);
    } catch (err: any) {
      console.error('Failed to load support metrics:', err);
    }
  };

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      let effStatus = statusFilter !== 'all' ? statusFilter : undefined;
      let effIssue = issueTypeFilter !== 'all' ? issueTypeFilter : undefined;
      let effPrio: string | undefined = undefined;

      if (priorityQueue === 'DELAYS') {
        effIssue = 'delivery_delay';
      } else if (priorityQueue === 'RETURNS') {
        effIssue = 'return';
      } else if (priorityQueue === 'UNRESOLVED') {
        effStatus = 'Open';
        effPrio = 'high';
      }

      const data = await fetchSupportTicketsFiltered({
        statusFilter: effStatus,
        issueTypeFilter: effIssue,
        priorityFilter: effPrio,
        search: search.trim() || undefined,
        limit: 100
      });
      setTickets(data);
      if (data.length > 0 && (!selectedTicket || !data.some((t) => t.ticket_id === selectedTicket.ticket_id))) {
        setSelectedTicket(data[0]);
        setResolutionText(data[0].resolution_guidance || '');
      }
    } catch (err: any) {
      setError(err.message || 'Failed to load support tickets');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (newStatus: string) => {
    if (!selectedTicket) return;
    setUpdating(true);
    try {
      const updated = await updateSupportTicket(selectedTicket.ticket_id, {
        ticket_status: newStatus,
        resolution_guidance: resolutionText
      });
      setSelectedTicket(updated);
      setTickets((prev) => prev.map((t) => (t.ticket_id === updated.ticket_id ? updated : t)));
      loadMetrics();
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  const isOverview = !activeSubTab || activeSubTab.toLowerCase() === 'overview';
  const isReports = (activeSubTab || '').toLowerCase() === 'reports';

  const getPageTitle = () => {
    const sub = (activeSubTab || '').toLowerCase();
    switch (sub) {
      case 'new_tickets': return 'New & Unassigned Tickets';
      case 'assigned': return 'Assigned Agent Work Queue';
      case 'order_issues': return 'Order Issue Triage Queue';
      case 'shipment_issues': return 'Delivery Delay & Carrier Issues';
      case 'returns_requests': return 'Return Requests & Refund Queue';
      case 'escalations': return 'High-Priority Urgent Escalations';
      case 'reports': return 'Support Resolution Reports & SLA';
      case 'all_tickets': return 'All Customer Support Inquiries';
      default: return 'Customer Support Operations Desk';
    }
  };

  const getPageSubtitle = () => {
    const sub = (activeSubTab || '').toLowerCase();
    switch (sub) {
      case 'new_tickets': return 'Recently submitted inquiries awaiting representative evaluation';
      case 'assigned': return 'Tickets assigned to current support agents for active resolution';
      case 'order_issues': return 'Inquiries involving order cancellations, item replacements, and edits';
      case 'shipment_issues': return 'Dispatched parcels with courier delays exceeding estimated delivery dates';
      case 'returns_requests': return 'Buyer return requests, damaged merchandise claims, and refund checks';
      case 'escalations': return 'Urgent tickets with SLA breach risks requiring supervisor review';
      case 'reports': return 'Historical ticket volume curves, resolution SLAs, and issue classifications';
      default: return 'Customer inquiry resolution, order escalation triage, and customer satisfaction guidance.';
    }
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto pb-16">
      {/* Page Header */}
      <PageHeader
        title={getPageTitle()}
        subtitle={getPageSubtitle()}
        roleBadge="Support Representative"
        actions={
          <button
            onClick={() => {
              loadMetrics();
              loadTickets();
            }}
            disabled={loading}
            className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-semibold text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-50 transition shadow-xs disabled:opacity-50 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
            <span>Refresh Tickets</span>
          </button>
        }
      />

      {error && (
        <div className="p-4 bg-rose-50 border border-rose-200 rounded-xl text-rose-700 text-sm flex items-center gap-2">
          <AlertOctagon className="w-4 h-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      {/* KPI Cards & Trends - Shown on Overview or Reports */}
      {(isOverview || isReports) && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4">
            <KPIStatCard
              title="Total Tickets"
              value={metrics ? metrics.total_tickets.toLocaleString('en-IN') : tickets.length}
              subtitle="All recorded customer tickets"
              icon={LifeBuoy}
            />
            <KPIStatCard
              title="Open Inquiries"
              value={metrics ? metrics.open_tickets.toLocaleString('en-IN') : '...'}
              subtitle="Awaiting agent response"
              icon={Clock}
              variant="warning"
            />
            <KPIStatCard
              title="In Progress"
              value={metrics ? metrics.in_progress_tickets.toLocaleString('en-IN') : '...'}
              subtitle="Under active investigation"
              icon={MessageSquare}
              variant="accent"
            />
            <KPIStatCard
              title="High Priority Escalations"
              value={metrics?.high_priority_tickets != null ? metrics.high_priority_tickets.toLocaleString('en-IN') : '...'}
              subtitle="Delays & return complaints"
              icon={Flame}
              variant="default"
            />
            <KPIStatCard
              title="Resolution SLA Rate"
              value={metrics?.resolution_rate != null ? `${metrics.resolution_rate}%` : 'N/A'}
              subtitle={`Avg response: ${metrics?.avg_resolution_time ?? '4.2h'}`}
              icon={CheckCircle2}
              variant="success"
            />
          </div>

          {/* Ticket Creation Trend & Issue Categories */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 p-5 bg-white border border-slate-200 rounded-xl shadow-xs">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <TrendingUp className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-sm text-slate-900">Support Ticket Creation Volume Trend</h3>
                </div>
                <span className="text-xs font-mono text-slate-400">Monthly Dispatches</span>
              </div>
              <div className="h-56 w-full">
                {creationTrend.length > 0 ? (
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={creationTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="supportTrendGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#3B82F6" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#3B82F6" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                      <XAxis dataKey="period" tick={{ fontSize: 10, fill: '#64748B' }} />
                      <YAxis tick={{ fontSize: 10, fill: '#64748B' }} />
                      <Tooltip
                        formatter={(val: any) => [`${val} tickets`, 'Volume']}
                        contentStyle={{ backgroundColor: '#0F172A', borderRadius: '8px', color: '#fff', fontSize: '12px', border: 'none' }}
                      />
                      <Area type="monotone" dataKey="count" stroke="#3B82F6" strokeWidth={2} fillOpacity={1} fill="url(#supportTrendGrad)" />
                    </AreaChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-full flex items-center justify-center text-xs text-slate-400">
                    Ticket creation history will visualize as customer inquiries are logged.
                  </div>
                )}
              </div>
            </div>

            {/* Issue Type Category Distribution */}
            <div className="p-5 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col justify-between">
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Layers className="w-4 h-4 text-slate-500" />
                  <h3 className="font-bold text-sm text-slate-900">Inquiry Classification Breakdown</h3>
                </div>
                <p className="text-xs text-slate-500 mb-4">Direct classification of 4,987 support requests</p>
                <div className="space-y-3">
                  {metrics?.issue_type_breakdown.map((item) => (
                    <div key={item.issue_type} className="space-y-1">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold text-slate-800 capitalize">{item.issue_type.replace('_', ' ')}</span>
                        <span className="font-mono text-slate-500">{item.count} ({item.percentage}%)</span>
                      </div>
                      <div className="w-full bg-slate-100 h-2 rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full ${
                            item.issue_type === 'delivery_delay' ? 'bg-amber-500' :
                            item.issue_type === 'return' ? 'bg-rose-500' :
                            'bg-blue-500'
                          }`}
                          style={{ width: `${Math.min(100, item.percentage)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Workspace Split Layout - Rendered on queues and overview */}
      {!isReports && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Ticket Queue (Left Column) */}
        <div className="lg:col-span-5 bg-white rounded-xl border border-slate-200/80 overflow-hidden flex flex-col max-h-[720px] shadow-xs">
          {/* Search & Filter Header */}
          <div className="p-3 border-b border-slate-200/80 space-y-2 bg-slate-50/50">
            <SearchInput
              value={search}
              onChange={setSearch}
              placeholder="Search ticket ID, order ID, message..."
            />
            <div className="flex items-center gap-2">
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
              >
                <option value="all">All Statuses</option>
                <option value="Open">Open</option>
                <option value="In Progress">In Progress</option>
                <option value="Resolved">Resolved</option>
                <option value="Closed">Closed</option>
              </select>

              <select
                value={issueTypeFilter}
                onChange={(e) => setIssueTypeFilter(e.target.value)}
                className="flex-1 px-2.5 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-medium text-slate-700"
              >
                <option value="all">All Issue Categories</option>
                <option value="order_information">Order Information (2,531)</option>
                <option value="delivery_delay">Delivery Delay (1,779)</option>
                <option value="return">Returns & Refunds (388)</option>
                <option value="order_status">Order Status Tracking (265)</option>
              </select>
            </div>
          </div>

          {/* Ticket Items List */}
          <div className="divide-y divide-slate-100 overflow-y-auto flex-1">
            {tickets.length === 0 ? (
              <div className="p-8">
                <EmptyState
                  icon={LifeBuoy}
                  title="No tickets found"
                  description="No customer inquiries match your current filters."
                />
              </div>
            ) : (
              tickets.map((t) => {
                const isSelected = selectedTicket?.ticket_id === t.ticket_id;
                return (
                  <div
                    key={t.ticket_id}
                    onClick={() => {
                      setSelectedTicket(t);
                      setResolutionText(t.resolution_guidance || '');
                    }}
                    className={`p-3.5 cursor-pointer transition-colors ${
                      isSelected
                        ? 'bg-slate-100/90 border-l-4 border-slate-900'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex justify-between items-start gap-2">
                      <span className="font-mono text-xs font-bold text-slate-900">{t.ticket_id}</span>
                      <StatusBadge status={t.ticket_status || 'Open'} size="sm" />
                    </div>
                    <p className="text-xs font-semibold text-slate-800 mt-1 capitalize">
                      {t.issue_type?.replace(/_/g, ' ') || 'General Inquiry'}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 line-clamp-2 leading-relaxed">
                      {t.customer_message}
                    </p>
                    <div className="flex items-center justify-between text-[11px] text-slate-400 mt-2">
                      <span>Order: {t.order_id || 'N/A'}</span>
                      <span>{t.created_at || 'Recent'}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Selected Ticket Resolution Workspace (Right Column) */}
        <div className="lg:col-span-7 bg-white rounded-xl border border-slate-200/80 p-6 flex flex-col justify-between shadow-xs">
          {selectedTicket ? (
            <div className="space-y-6">
              {/* Header Info */}
              <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-2 pb-4 border-b border-slate-200">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-sm font-bold text-slate-900">{selectedTicket.ticket_id}</span>
                    <StatusBadge status={selectedTicket.ticket_status || 'Open'} />
                  </div>
                  <h2 className="text-lg font-bold text-slate-900 capitalize mt-1">
                    {selectedTicket.issue_type?.replace(/_/g, ' ') || 'Customer Support Request'}
                  </h2>
                </div>
                <div className="text-xs text-slate-500 space-y-0.5 sm:text-right">
                  <p>
                    Customer: <span className="font-mono font-medium text-slate-800">{selectedTicket.customer_id}</span>
                  </p>
                  <p>
                    Order Ref: <span className="font-mono font-medium text-slate-800">{selectedTicket.order_id || 'N/A'}</span>
                  </p>
                  <p className="text-slate-400">Created: {selectedTicket.created_at || 'N/A'}</p>
                </div>
              </div>

              {/* Customer Message Box */}
              <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/80 space-y-1.5">
                <div className="flex items-center gap-2 text-xs font-semibold text-slate-700">
                  <MessageSquare className="w-4 h-4 text-indigo-600" />
                  <span>Customer Message</span>
                </div>
                <p className="text-sm text-slate-800 leading-relaxed whitespace-pre-line">
                  {selectedTicket.customer_message}
                </p>
              </div>

              {/* Resolution Guidance Editor */}
              <div className="space-y-2">
                <label className="block text-xs font-semibold text-slate-700">
                  Resolution Guidance & Agent Actions
                </label>
                <textarea
                  rows={6}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full bg-white border border-slate-200 rounded-lg p-3 text-sm text-slate-900 placeholder-slate-400 focus:outline-hidden focus:ring-2 focus:ring-slate-900 leading-relaxed"
                  placeholder="Enter ticket resolution notes, replacement authorization, or customer guidance..."
                />
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('Resolved')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white bg-emerald-600 hover:bg-emerald-700 rounded-lg transition shadow-xs disabled:opacity-50"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Resolved</span>
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('In Progress')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-lg transition disabled:opacity-50"
                >
                  <Clock className="w-4 h-4" />
                  <span>Set In Progress</span>
                </button>
                <button
                  type="button"
                  disabled={updating}
                  onClick={() => handleUpdateStatus('Closed')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition disabled:opacity-50"
                >
                  <span>Close Ticket</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-28 text-center">
              <AlertCircle className="w-8 h-8 text-slate-300 mb-2" />
              <p className="text-sm font-medium text-slate-600">Select a support ticket from the queue</p>
              <p className="text-xs text-slate-400 mt-1">Review customer statements, verify orders, and dispatch resolution guidance.</p>
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
}
