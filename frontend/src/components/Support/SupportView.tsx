import { useState, useEffect } from 'react';
import { LifeBuoy, CheckCircle2, Clock, MessageSquare, AlertCircle, RefreshCw } from 'lucide-react';
import { fetchSupportTickets, updateSupportTicket } from '../../services/api';
import type { SupportTicket } from '../../types';

export function SupportView() {
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedTicket, setSelectedTicket] = useState<SupportTicket | null>(null);
  const [resolutionText, setResolutionText] = useState('');
  const [updating, setUpdating] = useState(false);

  useEffect(() => {
    loadTickets();
  }, []);

  const loadTickets = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await fetchSupportTickets();
      setTickets(data);
      if (data.length > 0 && !selectedTicket) {
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
      setTickets(prev => prev.map(t => t.ticket_id === updated.ticket_id ? updated : t));
    } catch (err: any) {
      alert(err.message || 'Failed to update ticket');
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div className="space-y-6 pb-16">
      {/* HEADER */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-[#14213D] p-6 md:p-8 rounded-3xl border border-[#233554] shadow-xl text-white">
        <div>
          <div className="flex items-center space-x-2.5">
            <LifeBuoy className="w-6 h-6 text-[#FCA311]" />
            <h1 className="text-xl md:text-2xl font-bold text-white font-['Space_Grotesk']">
              Customer Support Operations Desk
            </h1>
          </div>
          <p className="text-xs text-[#DCEAF0]/80 mt-1">
            Resolve customer inquiries, process order returns, and inspect historical ticket records.
          </p>
        </div>
        <button
          onClick={loadTickets}
          className="flex items-center space-x-2 px-4 py-2 bg-white/10 hover:bg-white/20 text-white rounded-xl text-xs font-bold transition border border-white/15 cursor-pointer shadow-xs"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>Refresh Desk</span>
        </button>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-[#B42318] text-xs">
          {error}
        </div>
      )}

      {/* WORKSPACE GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* TICKET LISTING */}
        <div className="lg:col-span-5 bg-white rounded-3xl border border-[#DCEAF0] overflow-hidden flex flex-col max-h-[680px] shadow-xs">
          <div className="p-4 border-b border-[#DCEAF0] flex justify-between items-center bg-[#FAF9F6]">
            <h2 className="text-xs font-bold text-[#14213D] uppercase tracking-wider">Support Tickets ({tickets.length})</h2>
            <span className="text-[11px] text-[#667085]">Database: support_tickets</span>
          </div>

          <div className="divide-y divide-[#F5F1E8] overflow-y-auto flex-1">
            {tickets.map(t => {
              const isSelected = selectedTicket?.ticket_id === t.ticket_id;
              const isResolved = t.ticket_status === 'Resolved';
              return (
                <div
                  key={t.ticket_id}
                  onClick={() => {
                    setSelectedTicket(t);
                    setResolutionText(t.resolution_guidance || '');
                  }}
                  className={`p-4 cursor-pointer transition ${
                    isSelected
                      ? 'bg-[#DCEAF0]/40 border-l-4 border-[#14213D]'
                      : 'hover:bg-[#FAF9F6]'
                  }`}
                >
                  <div className="flex justify-between items-start">
                    <span className="font-mono text-xs font-bold text-[#567C8D]">{t.ticket_id}</span>
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      isResolved
                        ? 'bg-emerald-50 text-[#15803D] border border-emerald-200'
                        : 'bg-amber-50 text-amber-700 border border-amber-200'
                    }`}>
                      {isResolved ? <CheckCircle2 className="w-3 h-3 mr-1" /> : <Clock className="w-3 h-3 mr-1" />}
                      {t.ticket_status || 'Open'}
                    </span>
                  </div>
                  <p className="text-xs font-bold text-[#14213D] mt-2 line-clamp-1">
                    Issue: <span className="capitalize">{t.issue_type?.replace(/_/g, ' ') || 'General'}</span>
                  </p>
                  <p className="text-[11px] text-[#667085] mt-1 line-clamp-2 leading-relaxed">{t.customer_message}</p>
                </div>
              );
            })}
          </div>
        </div>

        {/* TICKET DETAIL & RESOLUTION FORM */}
        <div className="lg:col-span-7 bg-white rounded-3xl border border-[#DCEAF0] p-6 flex flex-col justify-between shadow-xs">
          {selectedTicket ? (
            <div className="space-y-6">
              <div className="flex justify-between items-start pb-4 border-b border-[#DCEAF0]">
                <div>
                  <span className="font-mono text-xs text-[#567C8D] font-bold">{selectedTicket.ticket_id}</span>
                  <h2 className="text-xl font-bold text-[#14213D] capitalize mt-1 font-['Space_Grotesk']">
                    {selectedTicket.issue_type?.replace(/_/g, ' ')}
                  </h2>
                </div>
                <div className="text-right text-xs text-[#667085]">
                  <p>Customer ID: <code className="text-[#14213D] font-mono font-bold">{selectedTicket.customer_id}</code></p>
                  <p>Order ID: <code className="text-[#567C8D] font-mono font-bold">{selectedTicket.order_id || 'N/A'}</code></p>
                </div>
              </div>

              {/* MESSAGE BOX */}
              <div className="bg-[#FAF9F6] p-4 rounded-2xl border border-[#DCEAF0]">
                <div className="flex items-center space-x-2 text-xs text-[#667085] mb-2 font-bold">
                  <MessageSquare className="w-4 h-4 text-[#567C8D]" />
                  <span>Customer Message</span>
                </div>
                <p className="text-xs text-[#1F2937] leading-relaxed">{selectedTicket.customer_message}</p>
              </div>

              {/* RESOLUTION GUIDANCE EDITOR */}
              <div className="space-y-2">
                <label className="block text-xs font-bold text-[#14213D]">
                  Resolution Guidance & Agent Actions
                </label>
                <textarea
                  rows={5}
                  value={resolutionText}
                  onChange={(e) => setResolutionText(e.target.value)}
                  className="w-full bg-[#FAF9F6] border border-[#DCEAF0] rounded-xl p-3 text-xs text-[#1F2937] focus:outline-none focus:border-[#567C8D]"
                  placeholder="Enter support resolution guidance and dispatch notes..."
                />
              </div>

              {/* ACTION BUTTONS */}
              <div className="flex flex-wrap gap-3 pt-2">
                <button
                  disabled={updating}
                  onClick={() => handleUpdateStatus('Resolved')}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-[#15803D] hover:bg-emerald-800 text-white rounded-xl font-bold text-xs transition shadow-md cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Mark as Resolved</span>
                </button>

                <button
                  disabled={updating}
                  onClick={() => handleUpdateStatus('In Progress')}
                  className="flex items-center space-x-2 px-5 py-2.5 bg-[#FCA311] hover:bg-[#E5920C] text-[#14213D] rounded-xl font-bold text-xs transition shadow-md cursor-pointer"
                >
                  <Clock className="w-4 h-4" />
                  <span>Mark In Progress</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-24 text-[#667085] text-xs">
              <AlertCircle className="w-8 h-8 mb-2 text-[#DCEAF0]" />
              <span>Select a support ticket to review details</span>
            </div>
          )}
        </div>

      </div>
    </div>
  );
}
