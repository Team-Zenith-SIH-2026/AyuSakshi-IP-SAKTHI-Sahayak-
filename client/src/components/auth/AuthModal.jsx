import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { X, Sparkles, Lock, Mail, User, ShieldAlert, ArrowRight } from 'lucide-react';

export const AuthModal = () => {
  const { isAuthModalOpen, setIsAuthModalOpen, login, register, socialLogin, loading } = useAuth();
  const [isRegister, setIsRegister] = useState(false);
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState('user');
  const [errorMsg, setErrorMsg] = useState('');

  if (!isAuthModalOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErrorMsg('');

    if (isRegister) {
      const res = await register(name, email, password, role);
      if (!res.success) setErrorMsg(res.error);
    } else {
      const res = await login(email, password);
      if (!res.success) setErrorMsg(res.error);
    }
  };

  const handleGoogleLogin = () => {
    // Mock Social Login or OAuth redirect
    socialLogin('Google', `${email || 'user'}@gmail.com`, name || 'Google User', 'https://lh3.googleusercontent.com/a/default-user');
  };

  const handleFacebookLogin = () => {
    socialLogin('Facebook', `${email || 'user'}@facebook.com`, name || 'Facebook User', null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-md rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden p-6 animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between pb-4 border-b border-slate-100 dark:border-darkbg-border">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 flex items-center justify-center">
              <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
                <Sparkles className="w-4 h-4 text-emerald-400" />
              </div>
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                {isRegister ? 'Create AyuSakshi Account' : 'Sign in to AyuSakshi'}
              </h3>
              <p className="text-[11px] text-slate-500">
                AYUSH Practitioner, Researcher & MSME Portal
              </p>
            </div>
          </div>
          <button
            onClick={() => setIsAuthModalOpen(false)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="mt-3 p-3 rounded-xl bg-rose-500/10 border border-rose-500/20 text-rose-600 dark:text-rose-400 text-xs flex items-center space-x-2">
            <ShieldAlert className="w-4 h-4 flex-shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Social Logins: Google & Facebook */}
        <div className="mt-5 space-y-2">
          <button
            type="button"
            onClick={handleGoogleLogin}
            className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-darkbg-border bg-slate-50 dark:bg-darkbg-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z" />
            </svg>
            <span>Continue with Google</span>
          </button>

          <button
            type="button"
            onClick={handleFacebookLogin}
            className="w-full flex items-center justify-center space-x-2.5 py-2.5 px-4 rounded-xl border border-slate-200 dark:border-darkbg-border bg-slate-50 dark:bg-darkbg-950 hover:bg-slate-100 dark:hover:bg-slate-800 text-xs font-semibold text-slate-700 dark:text-slate-200 transition-colors shadow-sm"
          >
            <svg className="w-4 h-4 fill-[#1877F2]" viewBox="0 0 24 24">
              <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
            </svg>
            <span>Continue with Facebook</span>
          </button>
        </div>

        <div className="flex items-center my-4">
          <div className="flex-1 border-t border-slate-200 dark:border-darkbg-border"></div>
          <span className="px-3 text-[10px] uppercase font-bold text-slate-400">or with email</span>
          <div className="flex-1 border-t border-slate-200 dark:border-darkbg-border"></div>
        </div>

        {/* Email & Password Form */}
        <form onSubmit={handleSubmit} className="space-y-3">
          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Full Name</label>
              <div className="relative">
                <input
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Dr. Vaidya / Researcher Name"
                  className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                />
                <User className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
              </div>
            </div>
          )}

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Email Address</label>
            <div className="relative">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="name@ayushstartup.in"
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Mail className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Password</label>
            <div className="relative">
              <input
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl pl-9 pr-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              />
              <Lock className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            </div>
          </div>

          {isRegister && (
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-500 mb-1">Role / Profile</label>
              <select
                value={role}
                onChange={(e) => setRole(e.target.value)}
                className="w-full bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border rounded-xl px-3 py-2 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none"
              >
                <option value="user">Ayurveda Practitioner / Vaidya</option>
                <option value="researcher">Academic Researcher / Scientist</option>
                <option value="msme">AYUSH Startup / MSME Manufacturer</option>
                <option value="facilitator">Accredited IP Facilitator</option>
              </select>
            </div>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98] mt-2 flex items-center justify-center space-x-2"
          >
            <span>{isRegister ? 'Register Account' : 'Sign In'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        {/* Toggle Login vs Register */}
        <div className="mt-4 text-center text-xs text-slate-500">
          {isRegister ? (
            <span>
              Already have an account?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(false)}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Sign In
              </button>
            </span>
          ) : (
            <span>
              New to AyuSakshi?{' '}
              <button
                type="button"
                onClick={() => setIsRegister(true)}
                className="font-bold text-emerald-600 dark:text-emerald-400 hover:underline"
              >
                Create an Account
              </button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
