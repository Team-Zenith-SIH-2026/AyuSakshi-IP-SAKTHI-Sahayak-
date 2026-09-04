import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import {
  ArrowLeft,
  User,
  Mail,
  Shield,
  KeyRound,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  LogOut,
  Sparkles,
  Calendar,
  Lock,
  Sun,
  Moon,
} from 'lucide-react';

export const ProfilePage = () => {
  const navigate = useNavigate();
  const { user, logout, isAuthenticated } = useAuth();
  const { isDark, toggleTheme } = useTheme();

  // Change Password Form State
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');

  const handlePasswordChange = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!currentPassword || !newPassword || !confirmPassword) {
      setErrorMsg('Please fill in all password fields.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirm password do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.changePassword({
        currentPassword,
        newPassword,
        confirmPassword,
      });

      if (res.data?.success) {
        setSuccessMsg(res.data.message || 'Password updated successfully.');
        setCurrentPassword('');
        setNewPassword('');
        setConfirmPassword('');
      } else {
        setErrorMsg(res.data?.error || 'Failed to update password.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update password. Please verify your current password.');
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-darkbg-950 text-slate-900 dark:text-slate-100 font-sans transition-colors duration-200">
      {/* Top Header Navigation */}
      <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-950/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <button
            onClick={() => navigate('/')}
            className="flex items-center space-x-2 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-card border border-transparent hover:border-slate-200 dark:hover:border-darkbg-border transition-all"
            aria-label="Back to Assistant"
          >
            <ArrowLeft className="w-4 h-4 text-emerald-500" />
            <span>Back to Assistant</span>
          </button>

          <div className="flex items-center space-x-2.5">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-card border border-slate-200 dark:border-darkbg-border transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <button
              onClick={handleLogout}
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 border border-rose-200 dark:border-rose-900/30 transition-all"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Logout</span>
            </button>
          </div>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12 space-y-8">
        {/* Page Title */}
        <div>
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
              Account Center
            </span>
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
            <span className="text-xs text-slate-500">Security & Credentials</span>
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 dark:text-white mt-1">
            User Profile
          </h1>
          <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1">
            Manage your personal credentials, role permissions, and AYUSH regulatory authentication settings.
          </p>
        </div>

        {/* User Information Card */}
        <section className="bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-4 sm:space-y-0 sm:space-x-6 pb-6 border-b border-slate-100 dark:border-darkbg-border">
            {/* Avatar Circle */}
            <div className="w-16 h-16 sm:w-20 sm:h-20 rounded-2xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-500 p-0.5 flex-shrink-0 shadow-lg shadow-emerald-500/10">
              <div className="w-full h-full bg-slate-900 rounded-[14px] flex items-center justify-center text-2xl sm:text-3xl font-extrabold text-emerald-400">
                {user?.name ? user.name[0].toUpperCase() : 'U'}
              </div>
            </div>

            <div className="space-y-1 min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-xl sm:text-2xl font-bold text-slate-900 dark:text-white truncate">
                  {user?.name || 'Registered User'}
                </h2>
                <span className="px-2.5 py-0.5 rounded-md text-[11px] font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-200 dark:border-emerald-500/30 uppercase tracking-wide">
                  {user?.role || 'User'}
                </span>
                <span className="px-2 py-0.5 rounded-md text-[10px] font-medium bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-slate-700 capitalize">
                  {user?.auth_provider || 'Local'} Auth
                </span>
              </div>
              <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 flex items-center space-x-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                <span className="truncate">{user?.email || 'No email registered'}</span>
              </p>
            </div>
          </div>

          {/* Account Meta Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-6">
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-darkbg-950/60 border border-slate-200/80 dark:border-darkbg-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Designation / Role
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 capitalize">
                {user?.role === 'user'
                  ? 'Ayurveda Practitioner'
                  : user?.role === 'msme'
                  ? 'AYUSH MSME'
                  : user?.role === 'facilitator'
                  ? 'Accredited IP Facilitator'
                  : user?.role || 'Researcher'}
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-darkbg-950/60 border border-slate-200/80 dark:border-darkbg-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Account Status
              </div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 flex items-center space-x-1">
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Active & Verified</span>
              </div>
            </div>

            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-darkbg-950/60 border border-slate-200/80 dark:border-darkbg-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-1">
                Jurisdiction Scope
              </div>
              <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 flex items-center space-x-1">
                <span>National (IN) & Global (WIPO)</span>
              </div>
            </div>
          </div>
        </section>

        {/* Security & Change Password Section */}
        <section className="bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-2xl p-6 sm:p-8 shadow-sm">
          <div className="flex items-center space-x-3 mb-6">
            <div className="p-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
                Security & Password
              </h3>
              <p className="text-xs text-slate-500 dark:text-slate-400">
                Update your account password or review authentication credentials.
              </p>
            </div>
          </div>

          {/* Success Banner */}
          {successMsg && (
            <div className="mb-6 p-4 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              <span className="font-medium">{successMsg}</span>
            </div>
          )}

          {/* Error Banner */}
          {errorMsg && (
            <div className="mb-6 p-4 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span className="font-medium">{errorMsg}</span>
            </div>
          )}

          {user?.auth_provider === 'google' || user?.auth_provider === 'facebook' ? (
            <div className="p-4 rounded-xl bg-slate-50 dark:bg-darkbg-950/60 border border-slate-200 dark:border-darkbg-border">
              <div className="flex items-center space-x-2 text-xs font-semibold text-slate-800 dark:text-slate-200 mb-1">
                <Sparkles className="w-4 h-4 text-emerald-500" />
                <span>Single Sign-On Managed Account</span>
              </div>
              <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
                This account is signed in via <strong className="text-slate-800 dark:text-slate-200 capitalize">{user?.auth_provider}</strong>. Your authentication credentials, password changes, and two-factor authentication are safely managed by your identity provider.
              </p>
            </div>
          ) : (
            <form onSubmit={handlePasswordChange} className="space-y-4 max-w-lg">
              {/* Current Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password"
                    className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                  />
                  <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2.5 transition-colors"
                  >
                    {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              {/* New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Minimum 8 characters"
                    className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2.5 transition-colors"
                  >
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                <p className="text-[11px] text-slate-500 mt-1">Must be at least 8 characters with letters and numbers.</p>
              </div>

              {/* Confirm New Password */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Confirm New Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-10 pr-10 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                  />
                  <KeyRound className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="p-1 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2.5 transition-colors"
                  >
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div className="pt-2">
                <button
                  type="submit"
                  disabled={loading}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                >
                  {loading ? (
                    <span>Updating Password...</span>
                  ) : (
                    <>
                      <KeyRound className="w-4 h-4" />
                      <span>Update Password</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* Session Management & Logout Section */}
        <section className="bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-2xl p-6 sm:p-8 shadow-sm flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h3 className="text-sm font-bold text-slate-900 dark:text-white">Active Session</h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Signed in as <strong className="text-slate-700 dark:text-slate-300">{user?.email}</strong>. Logging out terminates your local session.
            </p>
          </div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 rounded-xl border border-rose-300 dark:border-rose-900/40 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/30 text-xs font-semibold flex items-center space-x-2 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>Logout from AyuSakshi</span>
          </button>
        </section>
      </main>
    </div>
  );
};
