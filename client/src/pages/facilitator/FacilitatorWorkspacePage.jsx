import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { facilitatorAPI } from '../../services/api';
import { LeafMark } from '../../components/layout/LeafMark';
import {
  Scale,
  Clock,
  CheckCircle2,
  FileText,
  Search,
  RefreshCw,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  AlertCircle,
  X,
  ExternalLink,
  ShieldCheck,
  Send
} from 'lucide-react';

export const FacilitatorWorkspacePage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [requests, setRequests] = useState([]);
  const [loading, setLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');

  // Selected request for detail & resolution
  const [selectedTicket, setSelectedTicket] = useState(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [newStatus, setNewStatus] = useState('RESOLVED');
  const [submitting, setSubmitting] = useState(false);
  const [feedbackMsg, setFeedbackMsg] = useState({ type: '', text: '' });

  useEffect(() => {
    fetchAssignedRequests();
  }, []);

  const fetchAssignedRequests = async () => {
    setLoading(true);
    try {
      const res = await facilitatorAPI.getAssignedRequests();
      setRequests(res.data.requests || []);
    } catch (err) {
      console.error('[Facilitator Requests Error]', err);
    } finally {
      setLoading(false);
    }
  };

  const handleSelectTicket = (ticket) => {
    setSelectedTicket(ticket);
    setResolutionNotes(ticket.resolution_notes || '');
    setNewStatus(ticket.status === 'ASSIGNED' ? 'IN_REVIEW' : ticket.status);
    setFeedbackMsg({ type: '', text: '' });
  };

  const handleUpdateStatus = async (e) => {
    e.preventDefault();
    if (!selectedTicket) return;

    setSubmitting(true);
    setFeedbackMsg({ type: '', text: '' });

    try {
      await facilitatorAPI.updateRequestStatus(selectedTicket.id, {
        status: newStatus,
        resolution_notes: resolutionNotes,
      });

      setFeedbackMsg({ type: 'success', text: 'Audit feedback & status saved successfully!' });
      fetchAssignedRequests();

      // Update local selected ticket
      setSelectedTicket((prev) => ({
        ...prev,
        status: newStatus,
        resolution_notes: resolutionNotes,
      }));
    } catch (err) {
      setFeedbackMsg({
        type: 'error',
        text: err.response?.data?.error || 'Failed to update request status.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  // Metrics
  const totalAssigned = requests.length;
  const pendingReviewCount = requests.filter((r) => ['ASSIGNED', 'IN_REVIEW', 'PENDING'].includes(r.status)).length;
  const resolvedCount = requests.filter((r) => ['RESOLVED', 'CLOSED'].includes(r.status)).length;

  const filteredRequests = requests.filter((r) => {
    const q = search.toLowerCase();
    const matchesQuery =
      (r.user_name && r.user_name.toLowerCase().includes(q)) ||
      (r.user_email && r.user_email.toLowerCase().includes(q)) ||
      (r.query && r.query.toLowerCase().includes(q)) ||
      (r.id && r.id.toString().includes(q));

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'active'
        ? ['ASSIGNED', 'IN_REVIEW', 'PENDING'].includes(r.status)
        : ['RESOLVED', 'CLOSED'].includes(r.status);

    return matchesQuery && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071813] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Header */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-emerald-800/40 bg-white/95 dark:bg-[#0a2019]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-600/15">
              <LeafMark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">IP-SAKTI Sahayak</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-teal-500/15 text-teal-700 dark:text-teal-300 border border-teal-500/20">
                  IP Facilitator Workspace
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Statutory Human Review Queue for Traditional Knowledge & Ayurvedic Inventions
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-3">
            {/* Theme Toggle */}
            <div className="flex items-center rounded-lg p-0.5 text-slate-500 dark:text-slate-400 border border-slate-200 dark:border-emerald-800/40">
              <button
                onClick={() => { if (isDark) toggleTheme(); }}
                className={`p-1.5 rounded-md ${!isDark ? 'text-amber-600 bg-amber-50' : 'text-slate-400 hover:text-slate-200'}`}
                title="Light Mode"
              >
                <Sun className="w-4 h-4" />
              </button>
              <button
                onClick={() => { if (!isDark) toggleTheme(); }}
                className={`p-1.5 rounded-md ${isDark ? 'text-emerald-300 bg-emerald-950/60' : 'text-slate-400 hover:text-slate-600'}`}
                title="Dark Mode"
              >
                <Moon className="w-4 h-4" />
              </button>
            </div>

            {/* Facilitator Info & Logout */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-emerald-800/40">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-200">{user?.name || 'Accredited Facilitator'}</div>
                <div className="text-[10px] text-slate-400">{user?.email}</div>
              </div>
              <button
                onClick={() => {
                  logout();
                  navigate('/');
                }}
                className="p-2 rounded-xl text-rose-600 hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20 transition-colors"
                title="Sign Out"
              >
                <LogOut className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full space-y-6">
        {/* Metric Summary Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-slate-400 block mb-1">Total Inquiries Assigned</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{totalAssigned}</span>
            </div>
            <div className="p-3 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
              <Scale className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-amber-500 block mb-1">Active / Pending Review</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{pendingReviewCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-amber-500/10 text-amber-500">
              <Clock className="w-5 h-5" />
            </div>
          </div>

          <div className="p-4 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm flex items-center justify-between">
            <div>
              <span className="text-[11px] font-bold uppercase text-emerald-500 block mb-1">Audited & Resolved</span>
              <span className="text-2xl font-black text-slate-900 dark:text-white">{resolvedCount}</span>
            </div>
            <div className="p-3 rounded-xl bg-emerald-500/10 text-emerald-500">
              <CheckCircle2 className="w-5 h-5" />
            </div>
          </div>
        </div>

        {/* Master-Detail Split Workspace */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left Column: Requests List (5 cols) */}
          <div className="lg:col-span-5 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">Assigned Review Requests</h3>
              <button
                onClick={fetchAssignedRequests}
                className="p-1.5 rounded-lg border border-slate-200 dark:border-emerald-800/40 text-slate-500 hover:text-slate-800 dark:hover:text-slate-200"
                title="Refresh List"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filter & Search */}
            <div className="space-y-2">
              <div className="relative">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search inquiries..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="flex rounded-xl bg-slate-200/60 dark:bg-black/30 p-1 text-[11px]">
                <button
                  onClick={() => setStatusFilter('all')}
                  className={`flex-1 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'all' ? 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  All ({totalAssigned})
                </button>
                <button
                  onClick={() => setStatusFilter('active')}
                  className={`flex-1 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'active' ? 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Active ({pendingReviewCount})
                </button>
                <button
                  onClick={() => setStatusFilter('resolved')}
                  className={`flex-1 py-1 rounded-lg font-medium transition-all ${
                    statusFilter === 'resolved' ? 'bg-white dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300 shadow-xs' : 'text-slate-600 dark:text-slate-400'
                  }`}
                >
                  Resolved ({resolvedCount})
                </button>
              </div>
            </div>

            {/* Requests List Cards */}
            <div className="space-y-2 max-h-[600px] overflow-y-auto pr-1">
              {loading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading assignments...</div>
              ) : filteredRequests.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400 bg-white dark:bg-[#0c241c] rounded-2xl border border-slate-200 dark:border-emerald-800/40">
                  No requests assigned under this filter.
                </div>
              ) : (
                filteredRequests.map((req) => {
                  const isSelected = selectedTicket?.id === req.id;
                  const isResolved = ['RESOLVED', 'CLOSED'].includes(req.status);
                  return (
                    <div
                      key={req.id}
                      onClick={() => handleSelectTicket(req)}
                      className={`p-3.5 rounded-2xl border transition-all cursor-pointer ${
                        isSelected
                          ? 'border-emerald-500 ring-1 ring-emerald-500/30 bg-emerald-50/50 dark:bg-emerald-950/40 shadow-sm'
                          : 'border-slate-200 dark:border-emerald-800/30 bg-white dark:bg-[#0c241c] hover:border-emerald-500/50'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="font-mono text-[11px] font-bold text-emerald-700 dark:text-emerald-400">
                          #{req.id}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isResolved
                              ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                              : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                          }`}
                        >
                          {req.status}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-900 dark:text-white truncate">
                        {req.user_name || 'Anonymous Practitioner'}
                      </div>
                      <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate font-mono">
                        {req.user_email}
                      </div>

                      <p className="mt-2 text-xs text-slate-600 dark:text-slate-300 line-clamp-2 leading-relaxed">
                        {req.question || req.query}
                      </p>
                      {req.reason && (
                        <p className="mt-1 text-[11px] text-amber-700 dark:text-amber-300 font-medium truncate">
                          Reason: {req.reason}
                        </p>
                      )}

                      <div className="mt-2.5 pt-2 border-t border-slate-100 dark:border-emerald-800/20 flex items-center justify-between text-[10px] text-slate-400">
                        <span>{req.jurisdiction === 'international' ? '🌐 International' : '🇮🇳 India'}</span>
                        <span>{req.created_at ? new Date(req.created_at).toLocaleDateString() : ''}</span>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* Right Column: Active Ticket Detail & Resolution Form (7 cols) */}
          <div className="lg:col-span-7">
            {selectedTicket ? (
              <div className="rounded-2xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] p-5 shadow-sm space-y-5">
                {/* Header */}
                <div className="flex items-start justify-between pb-3 border-b border-slate-100 dark:border-emerald-800/30">
                  <div>
                    <div className="flex items-center space-x-2">
                      <span className="font-mono text-xs font-bold text-emerald-600 dark:text-emerald-400">
                        Ticket #{selectedTicket.id}
                      </span>
                      <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-slate-100 dark:bg-white/10 text-slate-600 dark:text-slate-300">
                        {selectedTicket.jurisdiction === 'international' ? '🌐 International Regime' : '🇮🇳 Indian Jurisdiction'}
                      </span>
                    </div>
                    <h3 className="text-base font-bold text-slate-900 dark:text-white mt-1">
                      Statutory Review & Expert Audit
                    </h3>
                  </div>

                  <div className="text-right">
                    <span className="text-[10px] uppercase font-bold text-slate-400 block">Requester</span>
                    <span className="text-xs font-semibold text-slate-800 dark:text-slate-200">
                      {selectedTicket.user_name || 'Practitioner'}
                    </span>
                    <span className="text-[10px] text-slate-400 block font-mono">
                      {selectedTicket.user_email}
                    </span>
                  </div>
                </div>

                {/* Feedback Alerts */}
                {feedbackMsg.text && (
                  <div
                    className={`p-3 rounded-xl text-xs flex items-center space-x-2 ${
                      feedbackMsg.type === 'success'
                        ? 'bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400'
                        : 'bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400'
                    }`}
                  >
                    {feedbackMsg.type === 'success' ? <CheckCircle2 className="w-4 h-4" /> : <AlertCircle className="w-4 h-4" />}
                    <span>{feedbackMsg.text}</span>
                  </div>
                )}

                {/* Inquirer Formulation / Problem */}
                <div className="space-y-1.5">
                  <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                    User Query / Ayurvedic Invention Description
                  </label>
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-[#071813] border border-slate-100 dark:border-emerald-800/30 text-xs text-slate-800 dark:text-slate-200 leading-relaxed whitespace-pre-wrap">
                    {selectedTicket.question || selectedTicket.query}
                  </div>
                </div>

                {selectedTicket.reason && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Escalation Trigger / Requester Concern
                    </label>
                    <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-900 dark:text-amber-200 leading-relaxed">
                      {selectedTicket.reason}
                    </div>
                  </div>
                )}

                {selectedTicket.formulation_summary && (
                  <div className="space-y-1">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Formulation & Statutory Summary
                    </label>
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#071813] border border-slate-100 dark:border-emerald-800/30 text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
                      {selectedTicket.formulation_summary}
                    </div>
                  </div>
                )}

                {/* Evidence / Attachments */}
                {selectedTicket.attachments && selectedTicket.attachments.length > 0 && (
                  <div className="space-y-1.5">
                    <label className="text-[10px] uppercase font-bold text-slate-400 tracking-wider block">
                      Submitted Evidentiary Documents
                    </label>
                    <div className="space-y-1">
                      {selectedTicket.attachments.map((att, idx) => (
                        <div
                          key={idx}
                          className="flex items-center justify-between p-2 rounded-xl bg-slate-50 dark:bg-[#071813] border border-slate-100 dark:border-emerald-800/30 text-xs"
                        >
                          <div className="flex items-center space-x-2 truncate">
                            <FileText className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                            <span className="truncate text-slate-700 dark:text-slate-300 font-medium">
                              {att.name || att.filename || `Attachment_${idx + 1}`}
                            </span>
                          </div>
                          {att.url && (
                            <a
                              href={att.url}
                              target="_blank"
                              rel="noreferrer"
                              className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1 text-[11px]"
                            >
                              <span>View</span>
                              <ExternalLink className="w-3 h-3" />
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Facilitator Action Form */}
                <form onSubmit={handleUpdateStatus} className="space-y-4 pt-2 border-t border-slate-100 dark:border-emerald-800/30">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                        Workflow Status
                      </label>
                      <select
                        value={newStatus}
                        onChange={(e) => setNewStatus(e.target.value)}
                        className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                      >
                        <option value="IN_REVIEW">In Review (Under Analysis)</option>
                        <option value="RESOLVED">Resolved (Audited & Advised)</option>
                        <option value="CLOSED">Closed (Completed)</option>
                      </select>
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                      Official Facilitator Guidance & Prior Art Assessment
                    </label>
                    <textarea
                      rows={6}
                      required
                      value={resolutionNotes}
                      onChange={(e) => setResolutionNotes(e.target.value)}
                      placeholder="Enter legal & technical feedback regarding patentability, TKDL prior art conflicts, Form 1 / Form 3 filing requirements, or NBA Section 3 biological resource compliance..."
                      className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] p-3 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500 leading-relaxed"
                    />
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="submit"
                      disabled={submitting}
                      className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all disabled:opacity-50"
                    >
                      <ShieldCheck className="w-4 h-4" />
                      <span>{submitting ? 'Submitting Assessment...' : 'Save & Publish Assessment'}</span>
                    </button>
                  </div>
                </form>
              </div>
            ) : (
              <div className="h-96 flex flex-col items-center justify-center p-8 rounded-2xl border border-dashed border-slate-300 dark:border-emerald-800/40 bg-white/50 dark:bg-[#0c241c]/40 text-center">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center mb-3">
                  <Scale className="w-6 h-6" />
                </div>
                <h4 className="text-sm font-bold text-slate-800 dark:text-slate-200">No Request Selected</h4>
                <p className="text-xs text-slate-500 max-w-sm mt-1">
                  Select an escalated human review request from the queue on the left to review its Ayurvedic claims and submit statutory guidance.
                </p>
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
};
