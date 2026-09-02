import React, { useState, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { escalationAPI } from '../../services/api';
import { Scale, X, CheckCircle2, Clock, ShieldCheck, RefreshCw, MessageSquare } from 'lucide-react';

export const FacilitatorQueue = () => {
  const { activeModal, setActiveModal } = useChat();
  const [tickets, setTickets] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [statusUpdate, setStatusUpdate] = useState('RESOLVED');

  useEffect(() => {
    if (activeModal === 'facilitator') {
      fetchTickets();
    }
  }, [activeModal]);

  const fetchTickets = async () => {
    setLoading(true);
    try {
      const res = await escalationAPI.list();
      if (res.data?.escalations) {
        setTickets(res.data.escalations);
      }
    } catch (err) {
      console.error('[Facilitator Queue Error]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    try {
      await escalationAPI.updateStatus(selectedTicket.id, {
        status: statusUpdate,
        resolution_notes: resolutionNotes,
      });
      setSelectedTicket(null);
      setResolutionNotes('');
      fetchTickets();
    } catch (err) {
      console.error('[Update Status Error]', err.message);
    }
  };

  if (activeModal !== 'facilitator') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-4xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <Scale className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Human IP Facilitator Review Workspace
              </h3>
              <p className="text-[11px] text-slate-500">
                Audit trail and resolution for escalated Ayurvedic IP inquiries
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <button
              onClick={fetchTickets}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-border"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            </button>
            <button
              onClick={() => setActiveModal(null)}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Workspace Body */}
        <div className="p-6 overflow-y-auto flex-1 flex flex-col md:flex-row gap-4 text-xs">
          {/* Tickets List */}
          <div className="w-full md:w-1/2 space-y-2 overflow-y-auto max-h-[60vh] pr-1">
            <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2">
              Pending & Active Escalations ({tickets.length})
            </div>

            {tickets.length === 0 ? (
              <div className="p-6 text-center text-slate-400 bg-slate-50 dark:bg-darkbg-950 rounded-xl">
                No escalated tickets found.
              </div>
            ) : (
              tickets.map((t) => (
                <div
                  key={t.id}
                  onClick={() => {
                    setSelectedTicket(t);
                    setStatusUpdate(t.status);
                    setResolutionNotes(t.resolution_notes || '');
                  }}
                  className={`p-3 rounded-xl border cursor-pointer transition-all ${
                    selectedTicket?.id === t.id
                      ? 'border-emerald-500 bg-emerald-50/30 dark:bg-emerald-950/20'
                      : 'border-slate-200 dark:border-darkbg-border bg-slate-50/50 dark:bg-darkbg-950/50 hover:bg-slate-100 dark:hover:bg-darkbg-border/60'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-mono text-[10px] text-slate-400">#{t.id.slice(0, 8)}</span>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                        t.status === 'PENDING'
                          ? 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                          : t.status === 'RESOLVED'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-slate-500/10 text-slate-600 dark:text-slate-400'
                      }`}
                    >
                      {t.status}
                    </span>
                  </div>
                  <h4 className="font-semibold text-slate-900 dark:text-white truncate">{t.question}</h4>
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mt-2">
                    <span>{t.user_email || 'practitioner@ayusakshi.in'}</span>
                    <span className="capitalize">{t.jurisdiction} Regime</span>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Ticket Detail & Resolution Form */}
          <div className="w-full md:w-1/2 p-4 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border flex flex-col justify-between">
            {selectedTicket ? (
              <form onSubmit={handleUpdateStatus} className="space-y-3">
                <div className="border-b border-slate-200 dark:border-darkbg-border pb-2">
                  <span className="text-[10px] font-bold uppercase text-emerald-600 dark:text-emerald-400">
                    Ticket Details • #{selectedTicket.id.slice(0, 8)}
                  </span>
                  <h4 className="text-xs font-bold text-slate-900 dark:text-white mt-1">
                    {selectedTicket.question}
                  </h4>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Reason for Escalation
                  </label>
                  <p className="p-2 rounded-lg bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border text-slate-700 dark:text-slate-300">
                    {selectedTicket.reason}
                  </p>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">Status</label>
                  <select
                    value={statusUpdate}
                    onChange={(e) => setStatusUpdate(e.target.value)}
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200"
                  >
                    <option value="PENDING">PENDING</option>
                    <option value="IN_REVIEW">IN_REVIEW</option>
                    <option value="RESOLVED">RESOLVED</option>
                    <option value="CLOSED">CLOSED</option>
                  </select>
                </div>

                <div>
                  <label className="block text-[10px] font-bold uppercase text-slate-400 mb-1">
                    Facilitator Statutory Opinion & Guidance Notes
                  </label>
                  <textarea
                    rows={4}
                    value={resolutionNotes}
                    onChange={(e) => setResolutionNotes(e.target.value)}
                    placeholder="Write accredited guidance referencing specific sections of Patents Act or Biological Diversity Rules..."
                    className="w-full bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-lg p-2 text-xs text-slate-800 dark:text-slate-200 focus:outline-none focus:ring-1 focus:ring-emerald-500 resize-none"
                  />
                </div>

                <button
                  type="submit"
                  className="w-full py-2 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20"
                >
                  Save & Update Ticket Status
                </button>
              </form>
            ) : (
              <div className="h-full flex items-center justify-center text-center text-slate-400 text-xs p-6">
                Select an escalation ticket from the queue on the left to review evidence and record resolution notes.
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
