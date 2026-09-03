import React, { useState } from 'react';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useChat } from '../../context/ChatContext';
import {
  Globe,
  Sun,
  Moon,
  Sparkles,
  User,
  LogOut,
  Languages,
  BookOpen,
  Scale,
  Menu,
} from 'lucide-react';

export const Header = () => {
  const { jurisdiction, setIndia, setInternational, isIndia } = useJurisdiction();
  const { isDark, toggleTheme } = useTheme();
  const { user, isAuthenticated, setIsAuthModalOpen, logout } = useAuth();
  const { setActiveModal, toggleSidebar } = useChat();

  const [selectedLang, setSelectedLang] = useState('en');
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);

  const languages = [
    { code: 'en', label: 'English' },
    { code: 'hi', label: 'हिन्दी (Hindi)' },
    { code: 'sa', label: 'संस्कृतम् (Sanskrit)' },
    { code: 'ta', label: 'தமிழ் (Tamil)' },
    { code: 'te', label: 'తెలుగు (Telugu)' },
    { code: 'mr', label: 'मराठी (Marathi)' },
  ];

  return (
    <header className="sticky top-0 z-30 w-full border-b border-slate-200 dark:border-darkbg-border bg-white/90 dark:bg-darkbg-950/90 backdrop-blur-md transition-colors">
      {/* Main Navigation Bar */}
      <div className="flex items-center justify-between px-3 sm:px-4 lg:px-6 h-14 sm:h-16 gap-2">
        {/* Left: Mobile Drawer Trigger & Brand Logo */}
        <div className="flex items-center space-x-2 sm:space-x-3 min-w-0">
          <button
            type="button"
            onClick={toggleSidebar}
            aria-label="Toggle navigation menu"
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors flex-shrink-0"
          >
            <Menu className="w-5 h-5" />
          </button>

          <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-xl bg-gradient-to-tr from-emerald-600 via-teal-500 to-cyan-400 p-0.5 shadow-sm flex items-center justify-center flex-shrink-0">
            <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-emerald-400 animate-pulse" />
            </div>
          </div>
          
          <div className="min-w-0">
            <div className="flex items-center space-x-1.5">
              <span className="font-extrabold text-base sm:text-lg tracking-tight text-slate-900 dark:text-white truncate">
                AyuSakshi
              </span>
              <span className="text-[10px] sm:text-xs px-1.5 py-0.5 rounded font-bold bg-emerald-100 dark:bg-emerald-500/20 text-emerald-700 dark:text-emerald-400 border border-emerald-300 dark:border-emerald-500/30 whitespace-nowrap">
                IP SHAKTHI
              </span>
            </div>
            <p className="hidden md:block text-[10px] text-slate-500 dark:text-slate-400 font-medium tracking-wide truncate">
              Ayurveda Intellectual Property & Regulatory Assistant
            </p>
          </div>
        </div>

        {/* Center: Jurisdiction Switcher */}
        <div className="flex items-center bg-slate-100 dark:bg-darkbg-card p-0.5 sm:p-1 rounded-xl border border-slate-200 dark:border-darkbg-border flex-shrink-0">
          <button
            onClick={setIndia}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              isIndia
                ? 'bg-emerald-600 text-white shadow-sm shadow-emerald-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span>India</span>
            <span className="text-xs sm:text-sm">🇮🇳</span>
          </button>
          <button
            onClick={setInternational}
            className={`flex items-center space-x-1 sm:space-x-1.5 px-2.5 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-semibold transition-all duration-200 ${
              !isIndia
                ? 'bg-cyan-600 text-white shadow-sm shadow-cyan-600/30'
                : 'text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white'
            }`}
          >
            <span className="hidden xs:inline sm:inline">International</span>
            <span className="xs:hidden sm:hidden">Intl</span>
            <span className="text-xs sm:text-sm">🌍</span>
          </button>
        </div>

        {/* Right: Actions Controls */}
        <div className="flex items-center space-x-1.5 sm:space-x-2.5 flex-shrink-0">
          {/* Language Selector */}
          <div className="relative hidden md:flex items-center">
            <select
              value={selectedLang}
              onChange={(e) => setSelectedLang(e.target.value)}
              className="appearance-none bg-slate-100 dark:bg-darkbg-card text-xs font-medium text-slate-700 dark:text-slate-300 pl-7 pr-6 py-1.5 rounded-lg border border-slate-200 dark:border-darkbg-border focus:outline-none focus:ring-1 focus:ring-emerald-500 cursor-pointer"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code} className="bg-white dark:bg-darkbg-card text-slate-800 dark:text-slate-200">
                  {l.label}
                </option>
              ))}
            </select>
            <Languages className="w-3.5 h-3.5 text-slate-500 absolute left-2 pointer-events-none" />
          </div>

          {/* Theme Toggler */}
          <button
            onClick={toggleTheme}
            aria-label="Toggle Theme"
            className="p-1.5 sm:p-2 rounded-lg text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-card border border-slate-200 dark:border-darkbg-border transition-colors"
          >
            {isDark ? <Sun className="w-4 h-4 text-amber-400" /> : <Moon className="w-4 h-4 text-slate-600" />}
          </button>

          {/* Knowledge Corpus Vault Quick Link */}
          <button
            onClick={() => setActiveModal('admin')}
            title="Knowledge Corpus Vault"
            className="hidden lg:flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card border border-slate-200 dark:border-darkbg-border transition-colors"
          >
            <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
            <span>Corpus</span>
          </button>

          {/* Auth Button / Profile Menu */}
          {isAuthenticated ? (
            <div className="relative">
              <button
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-2 pl-2 pr-3 py-1 rounded-xl bg-slate-100 dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border hover:border-emerald-500/50 transition-colors"
              >
                <div className="w-7 h-7 rounded-lg bg-emerald-500/20 text-emerald-500 flex items-center justify-center font-bold text-xs">
                  {user?.name ? user.name[0].toUpperCase() : 'U'}
                </div>
                <div className="text-left hidden sm:block">
                  <div className="text-xs font-semibold text-slate-800 dark:text-slate-200 leading-tight">
                    {user?.name || 'Practitioner'}
                  </div>
                  <div className="text-[10px] text-emerald-600 dark:text-emerald-400 capitalize">
                    {user?.role || 'User'}
                  </div>
                </div>
              </button>

              {/* User Dropdown */}
              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2 w-48 rounded-xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl py-1 z-50 animate-in fade-in slide-in-from-top-2">
                  <div className="px-3 py-2 border-b border-slate-100 dark:border-darkbg-border">
                    <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{user?.name}</p>
                    <p className="text-[11px] text-slate-500 truncate">{user?.email}</p>
                  </div>
                  {['facilitator', 'admin'].includes(user?.role) && (
                    <button
                      onClick={() => {
                        setActiveModal('facilitator');
                        setIsUserMenuOpen(false);
                      }}
                      className="w-full text-left px-3 py-2 text-xs text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center space-x-2"
                    >
                      <Scale className="w-3.5 h-3.5 text-emerald-500" />
                      <span>Facilitator Queue</span>
                    </button>
                  )}
                  <button
                    onClick={() => {
                      logout();
                      setIsUserMenuOpen(false);
                    }}
                    className="w-full text-left px-3 py-2 text-xs text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center space-x-2"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          ) : (
            <button
              onClick={() => setIsAuthModalOpen(true)}
              className="flex items-center space-x-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-all shadow-md shadow-emerald-600/20"
            >
              <User className="w-3.5 h-3.5" />
              <span>Sign In</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
