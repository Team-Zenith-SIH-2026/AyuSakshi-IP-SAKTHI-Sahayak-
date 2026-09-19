import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { useTheme } from '../../context/ThemeContext';
import { adminAPI } from '../../services/api';
import { LeafMark } from '../../components/layout/LeafMark';
import {
  Users,
  UserCheck,
  Scale,
  Activity,
  Plus,
  RefreshCw,
  Search,
  CheckCircle2,
  XCircle,
  Clock,
  Shield,
  KeyRound,
  LogOut,
  Sun,
  Moon,
  ArrowRight,
  Eye,
  EyeOff,
  Filter,
  AlertCircle,
  FileText,
  X
} from 'lucide-react';

export const AdminPortalPage = () => {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'facilitators' | 'users' | 'requests'

  // Summary Metrics
  const [metrics, setMetrics] = useState(null);
  const [loadingMetrics, setLoadingMetrics] = useState(false);

  // Facilitators State
  const [facilitators, setFacilitators] = useState([]);
  const [loadingFacilitators, setLoadingFacilitators] = useState(false);
  const [facilitatorSearch, setFacilitatorSearch] = useState('');
  const [showAddFacilitatorModal, setShowAddFacilitatorModal] = useState(false);
  const [newFacilitator, setNewFacilitator] = useState({ name: '', email: '', password: '' });
  const [addFacilitatorError, setAddFacilitatorError] = useState('');
  const [addFacilitatorLoading, setAddFacilitatorLoading] = useState(false);
  const [resetPwModal, setResetPwModal] = useState({ open: false, facilitator: null, newPassword: '' });
  const [resetPwMsg, setResetPwMsg] = useState({ error: '', success: '' });

  // Users State
  const [usersList, setUsersList] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(false);
  const [userSearch, setUserSearch] = useState('');
  const [userRoleFilter, setUserRoleFilter] = useState('all');

  // Requests State
  const [requestsList, setRequestsList] = useState([]);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [requestSearch, setRequestSearch] = useState('');
  const [requestStatusFilter, setRequestStatusFilter] = useState('all');
  const [selectedRequest, setSelectedRequest] = useState(null);

  useEffect(() => {
    fetchMetrics();
    if (activeTab === 'facilitators') fetchFacilitators();
    if (activeTab === 'users') fetchUsers();
    if (activeTab === 'requests') fetchRequests();
  }, [activeTab]);

  const fetchMetrics = async () => {
    setLoadingMetrics(true);
    try {
      const res = await adminAPI.getSummary();
      setMetrics(res.data);
    } catch (err) {
      console.error('[Admin Summary Error]', err);
    } finally {
      setLoadingMetrics(false);
    }
  };

  const fetchFacilitators = async () => {
    setLoadingFacilitators(true);
    try {
      const res = await adminAPI.getFacilitators();
      setFacilitators(res.data.facilitators || []);
    } catch (err) {
      console.error('[Admin Facilitators Error]', err);
    } finally {
      setLoadingFacilitators(false);
    }
  };

  const fetchUsers = async () => {
    setLoadingUsers(true);
    try {
      const res = await adminAPI.getUsers();
      setUsersList(res.data.users || []);
    } catch (err) {
      console.error('[Admin Users Error]', err);
    } finally {
      setLoadingUsers(false);
    }
  };

  const fetchRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await adminAPI.getRequests();
      setRequestsList(res.data.requests || []);
    } catch (err) {
      console.error('[Admin Requests Error]', err);
    } finally {
      setLoadingRequests(false);
    }
  };

  const handleCreateFacilitator = async (e) => {
    e.preventDefault();
    setAddFacilitatorError('');
    if (newFacilitator.password.length < 8) {
      setAddFacilitatorError('Password must be at least 8 characters long.');
      return;
    }
    setAddFacilitatorLoading(true);
    try {
      await adminAPI.createFacilitator(newFacilitator);
      setShowAddFacilitatorModal(false);
      setNewFacilitator({ name: '', email: '', password: '' });
      fetchFacilitators();
      fetchMetrics();
    } catch (err) {
      setAddFacilitatorError(err.response?.data?.error || 'Failed to create facilitator account.');
    } finally {
      setAddFacilitatorLoading(false);
    }
  };

  const handleToggleFacilitator = async (id, currentStatus) => {
    try {
      await adminAPI.toggleFacilitatorStatus(id, !currentStatus);
      fetchFacilitators();
      fetchMetrics();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update facilitator status.');
    }
  };

  const handleResetPassword = async (e) => {
    e.preventDefault();
    setResetPwMsg({ error: '', success: '' });
    if (resetPwModal.newPassword.length < 8) {
      setResetPwMsg({ error: 'Password must be at least 8 characters long.', success: '' });
      return;
    }
    try {
      await adminAPI.resetFacilitatorPassword(resetPwModal.facilitator.id, resetPwModal.newPassword);
      setResetPwMsg({ error: '', success: 'Password reset successfully! Facilitator will be prompted to change it upon next login.' });
      setTimeout(() => {
        setResetPwModal({ open: false, facilitator: null, newPassword: '' });
        setResetPwMsg({ error: '', success: '' });
      }, 1600);
    } catch (err) {
      setResetPwMsg({ error: err.response?.data?.error || 'Failed to reset password.', success: '' });
    }
  };

  const handleToggleUser = async (id, currentStatus) => {
    try {
      await adminAPI.toggleUserStatus(id, !currentStatus);
      fetchUsers();
      fetchMetrics();
    } catch (err) {
      alert(err.response?.data?.error || 'Failed to update user status.');
    }
  };

  // Filtered lists
  const filteredFacilitators = facilitators.filter((f) => {
    const q = facilitatorSearch.toLowerCase();
    return f.name.toLowerCase().includes(q) || f.email.toLowerCase().includes(q);
  });

  const filteredUsers = usersList.filter((u) => {
    const q = userSearch.toLowerCase();
    const matchesQuery = u.name.toLowerCase().includes(q) || u.email.toLowerCase().includes(q);
    const matchesRole = userRoleFilter === 'all' || u.role === userRoleFilter;
    return matchesQuery && matchesRole;
  });

  const filteredRequests = requestsList.filter((r) => {
    const q = requestSearch.toLowerCase();
    const matchesQuery =
      (r.user_name && r.user_name.toLowerCase().includes(q)) ||
      (r.user_email && r.user_email.toLowerCase().includes(q)) ||
      (r.query && r.query.toLowerCase().includes(q)) ||
      (r.id && r.id.toString().includes(q));
    const matchesStatus = requestStatusFilter === 'all' || r.status === requestStatusFilter;
    return matchesQuery && matchesStatus;
  });

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-[#071813] text-slate-900 dark:text-slate-100 flex flex-col font-sans transition-colors">
      {/* Top Navigation Bar */}
      <header className="sticky top-0 z-30 border-b border-slate-200 dark:border-emerald-800/40 bg-white/95 dark:bg-[#0a2019]/95 backdrop-blur-md">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-400 flex items-center justify-center ring-1 ring-emerald-600/15">
              <LeafMark className="w-6 h-6" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="text-base font-bold text-slate-900 dark:text-white">IP-SAKTI Sahayak</span>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Admin Portal
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400">
                Governance, Facilitator Registry & Round-Robin Escalations
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

            {/* Admin User Info & Logout */}
            <div className="flex items-center space-x-2 pl-2 border-l border-slate-200 dark:border-emerald-800/40">
              <div className="text-right hidden sm:block">
                <div className="text-xs font-semibold text-slate-900 dark:text-slate-200">{user?.name || 'Administrator'}</div>
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

      {/* Tabs Navigation Header */}
      <div className="border-b border-slate-200 dark:border-emerald-800/30 bg-white dark:bg-[#0c241c]/50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex space-x-1 sm:space-x-4">
          <button
            onClick={() => setActiveTab('overview')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'overview'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Activity className="w-4 h-4" />
            <span>Overview & Metrics</span>
          </button>

          <button
            onClick={() => setActiveTab('facilitators')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'facilitators'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Scale className="w-4 h-4" />
            <span>IP Facilitators</span>
          </button>

          <button
            onClick={() => setActiveTab('users')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'users'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Users className="w-4 h-4" />
            <span>Researchers & Users</span>
          </button>

          <button
            onClick={() => setActiveTab('requests')}
            className={`py-3.5 px-3 text-xs sm:text-sm font-semibold border-b-2 flex items-center space-x-2 transition-colors ${
              activeTab === 'requests'
                ? 'border-emerald-600 text-emerald-600 dark:border-emerald-400 dark:text-emerald-400'
                : 'border-transparent text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <FileText className="w-4 h-4" />
            <span>Human Review Requests</span>
          </button>
        </div>
      </div>

      {/* Main Body */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 flex-1 w-full">
        {/* ======================= TAB: OVERVIEW ======================= */}
        {activeTab === 'overview' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Administrative Overview</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Real-time system telemetry, active facilitators, and escalation workload distribution
                </p>
              </div>
              <button
                onClick={fetchMetrics}
                className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl border border-slate-200 dark:border-emerald-800/40 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingMetrics ? 'animate-spin' : ''}`} />
                <span>Refresh</span>
              </button>
            </div>

            {/* Metric Cards Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Card 1: Facilitators */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Accredited Facilitators</span>
                  <div className="p-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                    <Scale className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {metrics ? metrics.total_facilitators : '—'}
                </div>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                    {metrics ? metrics.active_facilitators : '—'} Active
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-slate-400">
                    {metrics ? metrics.total_facilitators - metrics.active_facilitators : '—'} Inactive
                  </span>
                </div>
              </div>

              {/* Card 2: Registered Users */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Registered Practitioners</span>
                  <div className="p-2 rounded-xl bg-blue-500/10 text-blue-600 dark:text-blue-400">
                    <Users className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {metrics ? metrics.total_users : '—'}
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Ayurveda Vaidyas, Academic Researchers & MSMEs
                </div>
              </div>

              {/* Card 3: Total Requests */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Human Review Requests</span>
                  <div className="p-2 rounded-xl bg-purple-500/10 text-purple-600 dark:text-purple-400">
                    <FileText className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-3xl font-extrabold text-slate-900 dark:text-white">
                  {metrics ? metrics.total_requests : '—'}
                </div>
                <div className="mt-2 flex items-center space-x-2 text-xs">
                  <span className="text-amber-500 font-medium">
                    {metrics ? (metrics.requests_by_status?.PENDING || 0) + (metrics.requests_by_status?.ASSIGNED || 0) : '—'} In Queue
                  </span>
                  <span className="text-slate-400">•</span>
                  <span className="text-emerald-500 font-medium">
                    {metrics ? metrics.requests_by_status?.RESOLVED || 0 : '—'} Resolved
                  </span>
                </div>
              </div>

              {/* Card 4: Round Robin Status */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
                  <span className="text-xs font-semibold uppercase tracking-wider">Round-Robin Engine</span>
                  <div className="p-2 rounded-xl bg-teal-500/10 text-teal-600 dark:text-teal-400">
                    <Activity className="w-4 h-4" />
                  </div>
                </div>
                <div className="text-lg font-bold text-slate-900 dark:text-white flex items-center space-x-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse"></span>
                  <span>Active & Balanced</span>
                </div>
                <div className="mt-2 text-xs text-slate-400">
                  Fair transactional rotation across all active accredited facilitators
                </div>
              </div>
            </div>

            {/* Breakdown Tables / Panels */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              {/* Request Status Breakdown */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  Review Requests by Status
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Pending Assignment', key: 'PENDING', color: 'bg-amber-500' },
                    { label: 'Assigned to Facilitator', key: 'ASSIGNED', color: 'bg-blue-500' },
                    { label: 'In Facilitator Review', key: 'IN_REVIEW', color: 'bg-indigo-500' },
                    { label: 'Resolved / Audited', key: 'RESOLVED', color: 'bg-emerald-500' },
                    { label: 'Closed', key: 'CLOSED', color: 'bg-slate-400' },
                  ].map((s) => {
                    const count = metrics?.requests_by_status?.[s.key] || 0;
                    const total = metrics?.total_requests || 1;
                    const pct = Math.round((count / (total === 0 ? 1 : total)) * 100);
                    return (
                      <div key={s.key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">{s.label}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{count} ({pct}%)</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-black/30 rounded-full overflow-hidden">
                          <div className={`h-full ${s.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* User Roles Breakdown */}
              <div className="p-5 rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 shadow-sm">
                <h3 className="text-sm font-bold text-slate-900 dark:text-white mb-3">
                  User Population by Classification
                </h3>
                <div className="space-y-3">
                  {[
                    { label: 'Ayurvedic Practitioners (Vaidyas)', key: 'user', color: 'bg-emerald-500' },
                    { label: 'Academic & Institutional Researchers', key: 'researcher', color: 'bg-teal-500' },
                    { label: 'AYUSH Startups & MSME Manufacturers', key: 'msme', color: 'bg-amber-500' },
                    { label: 'Accredited IP Facilitators', key: 'facilitator', color: 'bg-blue-500' },
                    { label: 'System Administrators', key: 'admin', color: 'bg-rose-500' },
                  ].map((r) => {
                    const count = metrics?.users_by_role?.[r.key] || 0;
                    const total = metrics?.total_users ? (metrics.total_users + (metrics.total_facilitators || 0)) : 1;
                    const pct = Math.round((count / (total === 0 ? 1 : total)) * 100);
                    return (
                      <div key={r.key} className="space-y-1">
                        <div className="flex justify-between text-xs">
                          <span className="text-slate-600 dark:text-slate-300 font-medium">{r.label}</span>
                          <span className="font-bold text-slate-900 dark:text-white">{count}</span>
                        </div>
                        <div className="h-2 w-full bg-slate-100 dark:bg-black/30 rounded-full overflow-hidden">
                          <div className={`h-full ${r.color} rounded-full`} style={{ width: `${pct}%` }}></div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* ======================= TAB: FACILITATORS ======================= */}
        {activeTab === 'facilitators' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">IP Facilitator Registry</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Manage accredited Ayurvedic IP attorneys and review assignment eligibility
                </p>
              </div>

              <div className="flex items-center space-x-2">
                <button
                  onClick={fetchFacilitators}
                  className="p-2 rounded-xl border border-slate-200 dark:border-emerald-800/40 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                  title="Refresh"
                >
                  <RefreshCw className={`w-4 h-4 ${loadingFacilitators ? 'animate-spin' : ''}`} />
                </button>
                <button
                  onClick={() => setShowAddFacilitatorModal(true)}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-md shadow-emerald-600/20 transition-all"
                >
                  <Plus className="w-4 h-4" />
                  <span>Add IP Facilitator</span>
                </button>
              </div>
            </div>

            {/* Search Filter */}
            <div className="relative max-w-md">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search facilitators by name or email..."
                value={facilitatorSearch}
                onChange={(e) => setFacilitatorSearch(e.target.value)}
                className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              />
            </div>

            {/* Facilitators Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-emerald-800/30 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Facilitator Name</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3 text-center">Assigned Requests</th>
                    <th className="px-4 py-3">Last Login</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-800/20">
                  {loadingFacilitators ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        Loading facilitators...
                      </td>
                    </tr>
                  ) : filteredFacilitators.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        No facilitators found matching your search.
                      </td>
                    </tr>
                  ) : (
                    filteredFacilitators.map((f) => (
                      <tr key={f.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">
                          {f.name}
                        </td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">
                          {f.email}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              f.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {f.is_active ? 'Active' : 'Inactive'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center font-bold text-slate-700 dark:text-slate-300">
                          {f.assigned_requests_count || 0}
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {f.last_login_at ? new Date(f.last_login_at).toLocaleDateString() : 'Never'}
                        </td>
                        <td className="px-4 py-3 text-right space-x-2">
                          <button
                            onClick={() => handleToggleFacilitator(f.id, f.is_active)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              f.is_active
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800/40 dark:hover:bg-rose-950/20'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800/40 dark:hover:bg-emerald-950/20'
                            }`}
                          >
                            {f.is_active ? 'Deactivate' : 'Activate'}
                          </button>
                          <button
                            onClick={() => setResetPwModal({ open: true, facilitator: f, newPassword: '' })}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-emerald-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 transition-colors"
                          >
                            Reset Password
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: USERS ======================= */}
        {activeTab === 'users' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Registered Researchers & Practitioners</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Directory of Ayurveda Vaidyas, Academic Scholars, and MSMEs using the statutory RAG engine
                </p>
              </div>
              <button
                onClick={fetchUsers}
                className="p-2 self-start sm:self-auto rounded-xl border border-slate-200 dark:border-emerald-800/40 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loadingUsers ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name or email..."
                  value={userSearch}
                  onChange={(e) => setUserSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={userRoleFilter}
                onChange={(e) => setUserRoleFilter(e.target.value)}
                className="w-full sm:w-48 py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Roles</option>
                <option value="user">Practitioner (Vaidya)</option>
                <option value="researcher">Academic Researcher</option>
                <option value="msme">AYUSH MSME</option>
              </select>
            </div>

            {/* Users Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-emerald-800/30 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Name</th>
                    <th className="px-4 py-3">Email Address</th>
                    <th className="px-4 py-3">Profile Role</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Registered At</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-800/20">
                  {loadingUsers ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        Loading users...
                      </td>
                    </tr>
                  ) : filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="px-4 py-8 text-center text-slate-400">
                        No registered users found.
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-semibold text-slate-900 dark:text-white">{u.name}</td>
                        <td className="px-4 py-3 text-slate-600 dark:text-slate-300 font-mono text-[11px]">{u.email}</td>
                        <td className="px-4 py-3">
                          <span className="capitalize px-2 py-0.5 rounded-full text-[10px] font-semibold bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-300">
                            {u.role === 'user' ? 'Practitioner' : u.role}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              u.is_active
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20'
                            }`}
                          >
                            {u.is_active ? 'Active' : 'Suspended'}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {u.created_at ? new Date(u.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => handleToggleUser(u.id, u.is_active)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-medium border transition-colors ${
                              u.is_active
                                ? 'border-rose-200 text-rose-600 hover:bg-rose-50 dark:border-rose-800/40 dark:hover:bg-rose-950/20'
                                : 'border-emerald-200 text-emerald-600 hover:bg-emerald-50 dark:border-emerald-800/40 dark:hover:bg-emerald-950/20'
                            }`}
                          >
                            {u.is_active ? 'Suspend' : 'Unsuspend'}
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ======================= TAB: REQUESTS ======================= */}
        {activeTab === 'requests' && (
          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">Human IP Facilitator Review Requests</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Comprehensive audit trail of escalations and round-robin facilitator allocations
                </p>
              </div>
              <button
                onClick={fetchRequests}
                className="p-2 self-start sm:self-auto rounded-xl border border-slate-200 dark:border-emerald-800/40 text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
                title="Refresh"
              >
                <RefreshCw className={`w-4 h-4 ${loadingRequests ? 'animate-spin' : ''}`} />
              </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col sm:flex-row items-center gap-3">
              <div className="relative flex-1 w-full">
                <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by requester, ticket #, or query keywords..."
                  value={requestSearch}
                  onChange={(e) => setRequestSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <select
                value={requestStatusFilter}
                onChange={(e) => setRequestStatusFilter(e.target.value)}
                className="w-full sm:w-48 py-2 px-3 text-xs rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
              >
                <option value="all">All Statuses</option>
                <option value="PENDING">Pending</option>
                <option value="ASSIGNED">Assigned</option>
                <option value="IN_REVIEW">In Review</option>
                <option value="RESOLVED">Resolved</option>
                <option value="CLOSED">Closed</option>
              </select>
            </div>

            {/* Requests Table */}
            <div className="overflow-x-auto rounded-2xl border border-slate-200 dark:border-emerald-800/40 bg-white dark:bg-[#0c241c] shadow-sm">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 dark:bg-black/20 text-slate-500 dark:text-slate-400 border-b border-slate-200 dark:border-emerald-800/30 uppercase text-[10px] tracking-wider">
                  <tr>
                    <th className="px-4 py-3">Ticket ID</th>
                    <th className="px-4 py-3">Requester</th>
                    <th className="px-4 py-3">Jurisdiction</th>
                    <th className="px-4 py-3">Assigned Facilitator</th>
                    <th className="px-4 py-3 text-center">Status</th>
                    <th className="px-4 py-3">Date</th>
                    <th className="px-4 py-3 text-right">Details</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 dark:divide-emerald-800/20">
                  {loadingRequests ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                        Loading requests...
                      </td>
                    </tr>
                  ) : filteredRequests.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="px-4 py-8 text-center text-slate-400">
                        No review requests found.
                      </td>
                    </tr>
                  ) : (
                    filteredRequests.map((r) => (
                      <tr key={r.id} className="hover:bg-slate-50/60 dark:hover:bg-white/5 transition-colors">
                        <td className="px-4 py-3 font-mono font-bold text-emerald-700 dark:text-emerald-400">
                          #{r.id}
                        </td>
                        <td className="px-4 py-3">
                          <div className="font-semibold text-slate-900 dark:text-white">{r.user_name || 'Anonymous User'}</div>
                          <div className="text-[10px] text-slate-400 font-mono">{r.user_email}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className="inline-flex items-center gap-1 font-medium">
                            {r.jurisdiction === 'international' ? '🌐 International' : '🇮🇳 India'}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {(r.assigned_facilitator_name || r.facilitator_name) ? (
                            <div>
                              <div className="font-semibold text-slate-800 dark:text-slate-200">
                                {r.assigned_facilitator_name || r.facilitator_name}
                              </div>
                              <div className="text-[10px] text-slate-400 font-mono">
                                {r.assigned_facilitator_email || r.facilitator_email}
                              </div>
                            </div>
                          ) : (
                            <span className="text-amber-500 font-medium italic">Pending Assignment</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span
                            className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              r.status === 'RESOLVED'
                                ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20'
                                : r.status === 'IN_REVIEW'
                                ? 'bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-500/20'
                                : r.status === 'ASSIGNED'
                                ? 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20'
                                : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20'
                            }`}
                          >
                            {r.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-500 dark:text-slate-400">
                          {r.created_at ? new Date(r.created_at).toLocaleDateString() : '—'}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            onClick={() => setSelectedRequest(r)}
                            className="px-2.5 py-1 rounded-lg text-[11px] font-medium border border-slate-200 dark:border-emerald-800/40 text-emerald-700 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-white/5 transition-colors"
                          >
                            Inspect
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </main>

      {/* ======================= MODAL: ADD FACILITATOR ======================= */}
      {showAddFacilitatorModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-emerald-800/30">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Add Accredited IP Facilitator
              </h3>
              <button
                onClick={() => setShowAddFacilitatorModal(false)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {addFacilitatorError && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{addFacilitatorError}</span>
              </div>
            )}

            <form onSubmit={handleCreateFacilitator} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Full Name / Firm Name
                </label>
                <input
                  type="text"
                  required
                  value={newFacilitator.name}
                  onChange={(e) => setNewFacilitator({ ...newFacilitator, name: e.target.value })}
                  placeholder="e.g., Adv. Ananya Sharma / IP Ayurveda Chambers"
                  className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Official Email Address
                </label>
                <input
                  type="email"
                  required
                  value={newFacilitator.email}
                  onChange={(e) => setNewFacilitator({ ...newFacilitator, email: e.target.value })}
                  placeholder="e.g., asharmalaw@ayushfacilitator.in"
                  className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  Initial Password (minimum 8 characters)
                </label>
                <input
                  type="password"
                  required
                  value={newFacilitator.password}
                  onChange={(e) => setNewFacilitator({ ...newFacilitator, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
                <p className="mt-1 text-[10px] text-slate-400">
                  Facilitator will be prompted to change their password upon their initial login.
                </p>
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setShowAddFacilitatorModal(false)}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-emerald-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={addFacilitatorLoading}
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                >
                  {addFacilitatorLoading ? 'Creating Account...' : 'Create Facilitator'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: RESET PASSWORD ======================= */}
      {resetPwModal.open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-emerald-800/30">
              <h3 className="text-base font-bold text-slate-900 dark:text-white">
                Reset Password for {resetPwModal.facilitator?.name}
              </h3>
              <button
                onClick={() => setResetPwModal({ open: false, facilitator: null, newPassword: '' })}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {resetPwMsg.error && (
              <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                <span>{resetPwMsg.error}</span>
              </div>
            )}

            {resetPwMsg.success && (
              <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{resetPwMsg.success}</span>
              </div>
            )}

            <form onSubmit={handleResetPassword} className="mt-4 space-y-3">
              <div>
                <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
                  New Temporary Password (min 8 chars)
                </label>
                <input
                  type="password"
                  required
                  value={resetPwModal.newPassword}
                  onChange={(e) => setResetPwModal({ ...resetPwModal, newPassword: e.target.value })}
                  placeholder="••••••••"
                  className="w-full rounded-xl border border-slate-200 dark:border-emerald-800/40 bg-slate-50 dark:bg-[#071813] px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="pt-2 flex justify-end space-x-2">
                <button
                  type="button"
                  onClick={() => setResetPwModal({ open: false, facilitator: null, newPassword: '' })}
                  className="px-4 py-2 text-xs font-semibold rounded-xl border border-slate-200 dark:border-emerald-800/40 text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/20"
                >
                  Reset & Flag Mandatory Update
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ======================= MODAL: REQUEST DETAILS ======================= */}
      {selectedRequest && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in">
          <div
            className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-2xl bg-white dark:bg-[#0c241c] border border-slate-200 dark:border-emerald-800/40 p-6 shadow-2xl animate-in zoom-in-95"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-slate-100 dark:border-emerald-800/30">
              <div>
                <span className="font-mono text-xs text-emerald-600 dark:text-emerald-400 font-bold">Ticket #{selectedRequest.id}</span>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">Review Request Audit Details</h3>
              </div>
              <button
                onClick={() => setSelectedRequest(null)}
                className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="mt-4 space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-4 p-3 rounded-xl bg-slate-50 dark:bg-black/20 border border-slate-100 dark:border-emerald-800/20">
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Requester</span>
                  <span className="font-semibold text-slate-900 dark:text-white">{selectedRequest.user_name || 'Anonymous User'}</span>
                  <div className="text-slate-500 font-mono text-[11px]">{selectedRequest.user_email}</div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Assigned Facilitator</span>
                  <span className="font-semibold text-slate-900 dark:text-white">
                    {selectedRequest.assigned_facilitator_name || selectedRequest.facilitator_name || 'Not yet assigned'}
                  </span>
                  <div className="text-slate-500 font-mono text-[11px]">
                    {selectedRequest.assigned_facilitator_email || selectedRequest.facilitator_email || '—'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Jurisdiction</span>
                  <span className="font-semibold">{selectedRequest.jurisdiction === 'international' ? '🌐 International Regime' : '🇮🇳 India (Patents Act & NBA)'}</span>
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold text-slate-400 block">Review Status</span>
                  <span className="font-bold text-emerald-600 dark:text-emerald-400">{selectedRequest.status}</span>
                </div>
              </div>

              <div>
                <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">User Query & Formulation</label>
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-[#071813] border border-slate-100 dark:border-emerald-800/20 text-slate-800 dark:text-slate-200 whitespace-pre-wrap leading-relaxed">
                  {selectedRequest.question || selectedRequest.query || 'No query text available.'}
                </div>
                {selectedRequest.reason && (
                  <div className="mt-2 p-2.5 rounded-xl bg-amber-500/10 border border-amber-500/20 text-amber-800 dark:text-amber-200 text-xs">
                    <span className="font-bold block text-[10px] uppercase tracking-wider">Reason for Escalation:</span>
                    {selectedRequest.reason}
                  </div>
                )}
              </div>

              {selectedRequest.resolution_notes && (
                <div>
                  <label className="text-[10px] uppercase font-bold text-slate-400 block mb-1">Facilitator Audit Notes</label>
                  <div className="p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-900 dark:text-emerald-200 whitespace-pre-wrap leading-relaxed">
                    {selectedRequest.resolution_notes}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRequest(null)}
                className="px-4 py-2 text-xs font-semibold rounded-xl bg-slate-100 dark:bg-white/10 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-white/15"
              >
                Close Audit View
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
