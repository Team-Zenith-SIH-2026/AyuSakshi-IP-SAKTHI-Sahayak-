import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { authAPI } from '../../services/api';
import { ShieldAlert, Lock, Eye, EyeOff, CheckCircle2, ArrowRight, LogOut } from 'lucide-react';

export const ForcePasswordChangeModal = () => {
  const { user, updateUser, logout } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Only render if the user is authenticated and must_change_password is true
  if (!user || !user.must_change_password) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (newPassword.length < 8) {
      setErrorMsg('New password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    if (newPassword === currentPassword) {
      setErrorMsg('New password cannot be the same as your temporary password.');
      return;
    }

    setLoading(true);
    try {
      await authAPI.changePassword({ currentPassword, newPassword, confirmPassword });
      setSuccessMsg('Password updated successfully! Redirecting...');
      setTimeout(() => {
        updateUser({ must_change_password: false });
      }, 1200);
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to update password. Please check your current password.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-[#0e2720] border border-amber-500/30 dark:border-amber-500/40 shadow-2xl overflow-hidden p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center space-x-3 pb-4 border-b border-slate-100 dark:border-emerald-800/30">
          <div className="w-10 h-10 rounded-xl bg-amber-500/15 text-amber-600 dark:text-amber-400 flex items-center justify-center flex-shrink-0">
            <ShieldAlert className="w-5 h-5" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 dark:text-white">
              Mandatory Password Update
            </h3>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              Security compliance requirement for administrative & facilitator access
            </p>
          </div>
        </div>

        <p className="mt-4 text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
          Your account was provisioned with a default password. Before accessing the system, you must establish a secure private password.
        </p>

        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {successMsg && (
          <div className="mt-3 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 text-xs flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            <span>{successMsg}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="mt-4 space-y-3.5">
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Current / Temporary Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                required
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[#071813] border border-slate-200 dark:border-emerald-800/40 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              New Password (minimum 8 characters)
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                required
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[#071813] border border-slate-200 dark:border-emerald-800/40 rounded-xl pl-9 pr-10 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="p-1 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 absolute right-2.5 top-2"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 dark:text-slate-400 mb-1">
              Confirm New Password
            </label>
            <div className="relative">
              <input
                type="password"
                required
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-[#071813] border border-slate-200 dark:border-emerald-800/40 rounded-xl pl-9 pr-3 py-2.5 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
            </div>
          </div>

          <div className="pt-2 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={logout}
              className="px-4 py-2.5 rounded-xl border border-slate-200 dark:border-emerald-800/40 text-xs font-semibold text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/5 flex items-center gap-1.5 transition-colors"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2 disabled:opacity-50"
            >
              <span>{loading ? 'Updating Password...' : 'Save & Proceed'}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
