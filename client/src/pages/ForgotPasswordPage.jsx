import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useTheme } from '../context/ThemeContext';
import { authAPI } from '../services/api';
import {
  ArrowLeft,
  Mail,
  KeyRound,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Sun,
  Moon,
  ShieldCheck,
  RefreshCw,
} from 'lucide-react';

export const ForgotPasswordPage = () => {
  const navigate = useNavigate();
  const { isDark, toggleTheme } = useTheme();

  // Multi-step flow: 1 (Email) -> 2 (OTP) -> 3 (New Password) -> 4 (Success)
  const [step, setStep] = useState(1);

  // Form inputs
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [resetToken, setResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  // Status states
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [infoMsg, setInfoMsg] = useState('');

  // Step 1: Request OTP Code
  const handleRequestCode = async (e) => {
    e.preventDefault();
    setErrorMsg('');
    setInfoMsg('');

    if (!email || !email.includes('@')) {
      setErrorMsg('Please enter a valid registered email address.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.forgotPassword({ email: email.trim().toLowerCase() });
      if (res.data?.success) {
        setInfoMsg(res.data.message || 'If an account exists for this email, a 6-digit verification code has been sent.');
        setStep(2);
      } else {
        setErrorMsg(res.data?.error || 'Failed to send verification code.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to send verification code. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  // Step 2: Verify OTP Code
  const handleVerifyCode = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!code || code.trim().length !== 6) {
      setErrorMsg('Please enter the 6-digit verification code.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.verifyResetCode({
        email: email.trim().toLowerCase(),
        code: code.trim(),
      });

      if (res.data?.success && res.data?.resetToken) {
        setResetToken(res.data.resetToken);
        setStep(3);
      } else {
        setErrorMsg(res.data?.error || 'Invalid or expired verification code.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Invalid verification code. Please check and try again.');
    } finally {
      setLoading(false);
    }
  };

  // Step 3: Set New Password
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please enter and confirm your new password.');
      return;
    }

    if (newPassword.length < 8) {
      setErrorMsg('Password must be at least 8 characters long.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation do not match.');
      return;
    }

    setLoading(true);
    try {
      const res = await authAPI.resetPassword({
        resetToken,
        newPassword,
        confirmPassword,
      });

      if (res.data?.success) {
        setStep(4);
      } else {
        setErrorMsg(res.data?.error || 'Failed to reset password.');
      }
    } catch (err) {
      setErrorMsg(err.response?.data?.error || 'Failed to reset password. The reset link may have expired.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-darkbg-950 text-slate-900 dark:text-slate-100 font-sans flex flex-col justify-between transition-colors duration-200">
      {/* Top Header */}
      <header className="w-full border-b border-slate-200 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-950/90 backdrop-blur-md">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between">
          <Link
            to="/"
            className="flex items-center space-x-2.5 text-xs font-semibold text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
          >
            <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
              <Sparkles className="w-4 h-4" />
            </div>
            <span className="font-extrabold text-slate-900 dark:text-white text-sm">AyuSakshi</span>
          </Link>

          <div className="flex items-center space-x-2">
            <button
              onClick={toggleTheme}
              aria-label="Toggle Theme"
              className="p-2 rounded-xl text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-card border border-slate-200 dark:border-darkbg-border transition-colors"
            >
              {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
            </button>
            <Link
              to="/"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-medium text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>Back to Home</span>
            </Link>
          </div>
        </div>
      </header>

      {/* Center Flow Container */}
      <div className="flex-1 flex items-center justify-center p-4 sm:p-6 my-6 sm:my-10">
        <div className="w-full max-w-md bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border rounded-2xl p-6 sm:p-8 shadow-xl relative overflow-hidden">
          {/* Subtle Top Accent Line */}
          <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-emerald-500 via-teal-500 to-cyan-500" />

          {/* Stepper Progress Bar */}
          <div className="flex items-center justify-between mb-8 px-2">
            {[1, 2, 3, 4].map((num) => (
              <React.Fragment key={num}>
                <div
                  className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-all ${
                    step === num
                      ? 'bg-emerald-600 text-white ring-4 ring-emerald-500/20 shadow-md shadow-emerald-600/30'
                      : step > num
                      ? 'bg-emerald-500/20 text-emerald-500 border border-emerald-500/40'
                      : 'bg-slate-100 dark:bg-darkbg-950 text-slate-400 border border-slate-200 dark:border-darkbg-border'
                  }`}
                >
                  {step > num ? <CheckCircle2 className="w-4 h-4" /> : num}
                </div>
                {num < 4 && (
                  <div
                    className={`flex-1 h-0.5 mx-2 rounded transition-colors ${
                      step > num ? 'bg-emerald-500' : 'bg-slate-200 dark:bg-darkbg-border'
                    }`}
                  />
                )}
              </React.Fragment>
            ))}
          </div>

          {/* Error Message */}
          {errorMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <AlertCircle className="w-4 h-4 flex-shrink-0 text-rose-500" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Info / Success Message */}
          {infoMsg && (
            <div className="mb-5 p-3.5 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-emerald-700 dark:text-emerald-400 text-xs flex items-center space-x-2.5 animate-in fade-in">
              <ShieldCheck className="w-4 h-4 flex-shrink-0 text-emerald-500" />
              <span>{infoMsg}</span>
            </div>
          )}

          {/* STEP 1: Enter Registered Email */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <KeyRound className="w-6 h-6" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Forgot Password?
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Enter your registered email address. We will send a 6-digit verification code to reset your credentials.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5">
                  Registered Email
                </label>
                <div className="relative">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="name@ayushstartup.in"
                    className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-10 pr-4 py-2.5 text-xs text-slate-900 dark:text-slate-100 placeholder:text-slate-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                  />
                  <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-3 pointer-events-none" />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
              >
                {loading ? <span>Sending Code...</span> : <span>Send verification code</span>}
              </button>

              <div className="text-center pt-3 border-t border-slate-100 dark:border-darkbg-border">
                <Link
                  to="/"
                  className="text-xs text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white font-medium transition-colors"
                >
                  Remembered your password? <span className="text-emerald-600 dark:text-emerald-400">Sign in</span>
                </Link>
              </div>
            </form>
          )}

          {/* STEP 2: Enter Verification Code */}
          {step === 2 && (
            <form onSubmit={handleVerifyCode} className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <ShieldCheck className="w-6 h-6" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Enter verification code
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  We sent a 6-digit code to <strong className="text-slate-800 dark:text-slate-200">{email}</strong>.
                </p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-600 dark:text-slate-400 mb-1.5 text-center">
                  Verification Code
                </label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, ''))}
                  placeholder="123456"
                  className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl py-3 text-center text-xl font-extrabold tracking-[0.5em] text-emerald-600 dark:text-emerald-400 focus:ring-1 focus:ring-emerald-500 focus:outline-none transition-colors"
                />
                <p className="text-[11px] text-slate-500 text-center mt-2">
                  Code expires in 10 minutes.
                </p>
              </div>

              <button
                type="submit"
                disabled={loading || code.length !== 6}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
              >
                {loading ? <span>Verifying...</span> : <span>Verify Code</span>}
              </button>

              <div className="flex items-center justify-between pt-3 border-t border-slate-100 dark:border-darkbg-border text-xs">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="text-slate-500 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white transition-colors"
                >
                  Change email
                </button>
                <button
                  type="button"
                  onClick={handleRequestCode}
                  className="text-emerald-600 dark:text-emerald-400 hover:underline flex items-center space-x-1"
                >
                  <RefreshCw className="w-3 h-3" />
                  <span>Resend code</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Create New Password */}
          {step === 3 && (
            <form onSubmit={handleResetPassword} className="space-y-4">
              <div className="text-center mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/20 flex items-center justify-center mx-auto mb-3 shadow-inner">
                  <Lock className="w-6 h-6" />
                </div>
                <h2 className="text-lg sm:text-xl font-bold text-slate-900 dark:text-white">
                  Create New Password
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
                  Choose a strong password containing at least 8 characters.
                </p>
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
                    placeholder="Confirm new password"
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

              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] disabled:opacity-50 flex items-center justify-center space-x-2 mt-2"
              >
                {loading ? <span>Resetting Password...</span> : <span>Reset Password</span>}
              </button>
            </form>
          )}

          {/* STEP 4: Reset Successful */}
          {step === 4 && (
            <div className="text-center space-y-5 py-4 animate-in fade-in">
              <div className="w-16 h-16 rounded-full bg-emerald-500/20 text-emerald-500 border border-emerald-500/40 flex items-center justify-center mx-auto shadow-lg shadow-emerald-500/10">
                <CheckCircle2 className="w-8 h-8" />
              </div>
              <div>
                <h2 className="text-xl font-extrabold text-slate-900 dark:text-white">
                  Password reset successful.
                </h2>
                <p className="text-xs text-slate-500 dark:text-slate-400 mt-1.5 leading-relaxed">
                  Your credentials have been securely updated. You can now log into your AyuSakshi account.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/')}
                className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] flex items-center justify-center space-x-2"
              >
                <span>Back to Login</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Footer Disclaimer */}
      <footer className="w-full py-4 text-center border-t border-slate-200 dark:border-darkbg-border bg-white/50 dark:bg-darkbg-950/50">
        <p className="text-[11px] text-slate-500">
          AyuSakshi (IP-SAKTI Sahayak) • Smart India Hackathon 2026 • SIH26045
        </p>
      </footer>
    </div>
  );
};
