import React, { useState, useRef, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import { LeafMark } from './LeafMark';
import { Sun, Moon, User, LogOut, Menu, ChevronDown, Scale, PanelLeft } from 'lucide-react';

export const Header = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const { setIndia, setInternational, isIndia } = useJurisdiction();
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, setIsAuthModalOpen, logout } = useAuth();
  const { setActiveModal, toggleMobileSidebar, toggleDesktopSidebar, isMobileSidebarOpen } = useChat();

  const [selectedLang, setSelectedLang] = useState('en');
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

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी' },
    { code: 'sa', label: 'संस्कृतम्' },
    { code: 'ta', label: 'தமிழ்' },
    { code: 'te', label: 'తెలుగు' },
    { code: 'mr', label: 'मराठी' },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-emerald-900/[0.06] dark:border-white/[0.06] bg-white/70 dark:bg-[#060d10]/70 backdrop-blur-xl transition-colors">
      <div className="flex h-16 items-center justify-between gap-3 px-4 sm:px-6 lg:px-8">
        {/* Left: menu + wordmark */}
        <div className="flex min-w-0 items-center gap-2 sm:gap-3">
          <button
            type="button"
            onClick={toggleMobileSidebar}
            aria-label="Toggle navigation menu"
            aria-expanded={isMobileSidebarOpen}
            className="-ml-1 rounded-lg p-2 text-slate-500 transition-colors hover:bg-emerald-50 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white lg:hidden"
          >
            <Menu className="h-5 w-5" />
          </button>

          <button
            type="button"
            onClick={toggleDesktopSidebar}
            aria-label="Toggle sidebar"
            className="hidden rounded-lg p-2 text-slate-400 transition-colors hover:bg-emerald-50 hover:text-emerald-700 dark:hover:bg-white/5 dark:hover:text-emerald-300 lg:block"
          >
            <PanelLeft className="h-4 w-4" />
          </button>

          <button
            onClick={() => navigate('/')}
            className="flex min-w-0 select-none items-center gap-2.5 text-left"
          >
            <span className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/15">
              <LeafMark className="h-5 w-5" />
            </span>
            <span className="min-w-0">
              <span className="block truncate text-[17px] font-medium leading-tight tracking-tight text-slate-900 dark:text-white">
                AyuSakshi
              </span>
              <span className="hidden truncate text-[11px] font-normal leading-tight text-slate-400 dark:text-slate-500 sm:block">
                Ayurveda · IP · Compliance
              </span>
            </span>
          </button>
        </div>

        {/* Centre: where the question applies */}
        <div className="flex flex-shrink-0 items-center rounded-full bg-slate-100/80 p-0.5 dark:bg-white/[0.06]">
          <button
            onClick={setIndia}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all sm:px-4 ${
              isIndia
                ? 'bg-white text-emerald-800 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-200'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            India
          </button>
          <button
            onClick={setInternational}
            className={`rounded-full px-3.5 py-1.5 text-[13px] font-medium transition-all sm:px-4 ${
              !isIndia
                ? 'bg-white text-teal-800 shadow-sm dark:bg-teal-500/15 dark:text-teal-200'
                : 'text-slate-500 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200'
            }`}
          >
            International
          </button>
        </div>

        {/* Right: language, theme, account */}
        <div className="flex flex-shrink-0 items-center gap-1.5 sm:gap-2">
          <select
            value={selectedLang}
            onChange={(e) => setSelectedLang(e.target.value)}
            aria-label="Language"
            className="hidden cursor-pointer appearance-none rounded-lg bg-transparent px-2 py-1.5 text-[13px] font-medium text-slate-600 transition-colors hover:bg-slate-100 focus:outline-none focus:ring-1 focus:ring-emerald-400 dark:text-slate-300 dark:hover:bg-white/5 md:block"
          >
            {languages.map((l) => (
              <option key={l.code} value={l.code} className="bg-white text-slate-800 dark:bg-[#0e181e] dark:text-slate-200">
                {l.label}
              </option>
            ))}
          </select>

          <button
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-slate-200"
          >
            {isDark ? <Sun className="h-[18px] w-[18px]" /> : <Moon className="h-[18px] w-[18px]" />}
          </button>

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

                  {['facilitator', 'admin'].includes(user?.role) && (
                    <button
                      role="menuitem"
                      onClick={() => {
                        setIsUserMenuOpen(false);
                        setActiveModal('facilitator');
                      }}
                      className="flex w-full items-center gap-3 px-4 py-2.5 text-left text-[13px] text-slate-600 transition-colors hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-white/5"
                    >
                      <Scale className="h-4 w-4 text-slate-400" />
                      Review queue
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
