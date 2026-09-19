import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { LeafMark } from './LeafMark';
import { Sun, Moon, User, LogOut, Menu, ChevronDown, Scale, PanelLeft, Globe, Languages } from 'lucide-react';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { setIndia, setInternational, isIndia } = useJurisdiction();
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, setIsAuthModalOpen, logout } = useAuth();
  const { setActiveModal, toggleMobileSidebar, toggleDesktopSidebar, isMobileSidebarOpen } = useChat();
  const { language, setLanguage, languages, t } = useLanguage();

  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => {
    const handleOutsideClick = (event) => {
      if (
        isUserMenuOpen &&
        menuRef.current &&
        !menuRef.current.contains(event.target) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target)
      ) {
        setIsUserMenuOpen(false);
      }
    };
    const handleKeyDown = (event) => {
      if (event.key === 'Escape' && isUserMenuOpen) {
        setIsUserMenuOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('touchstart', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('touchstart', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [isUserMenuOpen]);

  useEffect(() => {
    setIsUserMenuOpen(false);
  }, [location.pathname]);

  return (
    <header className="sticky top-0 z-30 w-full border-b border-emerald-900/[0.08] dark:border-emerald-700/20 bg-white/90 dark:bg-[#0a2019]/90 backdrop-blur-md transition-colors">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: menu + wordmark */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleMobileSidebar}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileSidebarOpen}
            className="-ml-1 rounded-lg p-2 text-slate-600 transition-colors hover:bg-emerald-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleDesktopSidebar}
            aria-label="Toggle sidebar"
            className="hidden rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-white/5 dark:hover:text-emerald-300 lg:block"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex min-w-0 select-none items-center gap-2.5 text-left group"
          >
            <span className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 transition-transform group-hover:scale-105 dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20">
              <LeafMark className="h-6 w-6" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-bold leading-tight tracking-tight text-slate-900 dark:text-white">
                IP-SAKTI <span className="font-semibold text-emerald-800 dark:text-emerald-400">Sahayak</span>
              </span>
              <span className="hidden truncate text-[11px] font-medium leading-tight text-slate-500 dark:text-slate-400 sm:block">
                {t('app.subtitle')}
              </span>
            </span>
          </button>
        </div>

        {/* Centre: India / International Regime pill */}
        <div className="flex flex-shrink-0 items-center rounded-full bg-slate-100/90 dark:bg-[#071813] p-1 border border-slate-200/80 dark:border-emerald-800/40 shadow-inner">
          <button
            onClick={setIndia}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all sm:px-4 ${
              isIndia
                ? 'bg-[#2b906a] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <span className="text-sm">🇮🇳</span>
            <span>{t('header.india')}</span>
          </button>
          <button
            onClick={setInternational}
            className={`flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all sm:px-4 ${
              !isIndia
                ? 'bg-[#2b906a] text-white shadow-sm font-semibold'
                : 'text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            <Globe className="h-3.5 w-3.5" />
            <span>{t('header.international')}</span>
          </button>
        </div>

        {/* Right: language, theme, account */}
        <div className="flex flex-shrink-0 items-center gap-2 sm:gap-3">
          {/* Language selector (All 22 Scheduled Indian Languages via Bhashini) */}
          <div className="relative flex items-center">
            <Languages className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
            <select
              value={language}
              onChange={(e) => setLanguage(e.target.value)}
              aria-label="Language"
              title="Select Language (22 Indian Languages via Bhashini)"
              className="cursor-pointer appearance-none rounded-lg border border-slate-200/80 bg-white/70 py-1.5 pl-8 pr-7 text-[12.5px] font-medium text-slate-700 transition-colors hover:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-emerald-800/40 dark:bg-[#0e2720] dark:text-slate-200 max-w-[130px] sm:max-w-[170px]"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} className="bg-white text-slate-800 dark:bg-[#0e2720] dark:text-slate-200">
                  {l.native} ({l.label})
                </option>
              ))}
            </select>
            <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
          </div>

          {/* Theme toggles (Sun and Moon) */}
          <div className="flex items-center rounded-lg p-0.5 text-slate-500 dark:text-slate-400">
            <button
              onClick={() => { if (isDark) toggleTheme(); }}
              aria-label="Switch to light mode"
              title="Light Mode"
              className={`rounded-md p-1.5 transition-colors ${
                !isDark
                  ? 'text-amber-600 bg-amber-50 dark:text-amber-400'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100 dark:hover:bg-white/5'
              }`}
            >
              <Sun className="h-[18px] w-[18px]" />
            </button>
            <button
              onClick={() => { if (!isDark) toggleTheme(); }}
              aria-label="Switch to dark mode"
              title="Dark Mode"
              className={`rounded-md p-1.5 transition-colors ${
                isDark
                  ? 'text-emerald-300 bg-emerald-950/60'
                  : 'text-slate-400 hover:text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Moon className="h-[18px] w-[18px]" />
            </button>
          </div>

          {isAuthenticated ? (
            <div className="relative">
              <button
                ref={buttonRef}
                onClick={() => setIsUserMenuOpen((prev) => !prev)}
                aria-haspopup="menu"
                aria-expanded={isUserMenuOpen}
                aria-label="Account menu"
                className="flex items-center gap-2 rounded-full py-1 pl-1 pr-2 transition-colors hover:bg-slate-100 dark:hover:bg-white/5"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-100 text-[13px] font-medium text-emerald-800 dark:bg-emerald-500/15 dark:text-emerald-300">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </span>
                <ChevronDown
                  className={`h-3.5 w-3.5 text-slate-400 transition-transform ${isUserMenuOpen ? 'rotate-180' : ''}`}
                />
              </button>

              {isUserMenuOpen && (
                <div
                  ref={menuRef}
                  role="menu"
                  className="animate-in fade-in slide-in-from-top-1 absolute right-0 z-50 mt-2 w-60 overflow-hidden rounded-2xl border border-slate-200/80 bg-white py-1.5 shadow-xl shadow-emerald-950/[0.06] dark:border-white/10 dark:bg-[#0e181e] dark:shadow-black/40"
                >
                  <div className="border-b border-slate-100 px-4 py-3 dark:border-white/[0.06]">
                    <div className="truncate text-sm font-medium text-slate-900 dark:text-white">
                      {user?.name || 'Account'}
                    </div>
                    <div className="mt-0.5 truncate text-xs text-slate-400" title={user?.email}>
                      {user?.email}
                    </div>
                  </div>

                  <button
                    role="menuitem"
                    onClick={() => {
                      setIsUserMenuOpen(false);
                      navigate('/profile');
                    }}
                    className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                  >
                    <User className="h-4 w-4 text-slate-400" />
                    Profile
                  </button>

                  {user?.role === 'admin' && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/admin');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-emerald-700 dark:text-emerald-400 font-medium transition-colors hover:bg-emerald-50 dark:hover:bg-white/5"
                    >
                      <Scale className="h-4 w-4" />
                      Admin Portal
                    </button>
                  )}

                  {user?.role === 'facilitator' && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        navigate('/facilitator');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-teal-700 dark:text-teal-400 font-medium transition-colors hover:bg-teal-50 dark:hover:bg-white/5"
                    >
                      <Scale className="h-4 w-4" />
                      Facilitator Workspace
                    </button>
                  )}

                  <div className="mt-1 border-t border-slate-100 pt-1 dark:border-white/[0.06]">
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        logout();
                        navigate('/');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-rose-600 transition-colors hover:bg-rose-50 dark:text-rose-400 dark:hover:bg-rose-950/20"
                    >
                      <LogOut className="h-4 w-4" />
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="rounded-full bg-emerald-700 px-4 py-2 text-[13px] font-medium text-white transition-colors hover:bg-emerald-800 dark:bg-emerald-600 dark:hover:bg-emerald-500"
            >
              Sign in
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
