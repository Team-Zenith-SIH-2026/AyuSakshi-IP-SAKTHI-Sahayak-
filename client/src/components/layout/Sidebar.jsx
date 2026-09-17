import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useLanguage } from '../../context/LanguageContext';
import {
  Home,
  MessageSquare,
  FlaskConical,
  Leaf,
  FileSearch,
  BookOpen,
  Clock,
  Languages,
  Mic,
  Trash2,
  X,
  UserRound,
  Plus,
} from 'lucide-react';

export const Sidebar = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    startNewConversation,
    deleteConversation,
    setActiveModal,
    isMobileSidebarOpen,
    closeMobileSidebar,
    isDesktopSidebarPinned,
    isDesktopSidebarHovered,
    setDesktopSidebarHovered,
  } = useChat();

  const { jurisdiction } = useJurisdiction();
  const { t } = useLanguage();
  const [showHistoryList, setShowHistoryList] = React.useState(true);

  const hoverOpenTimerRef = useRef(null);
  const hoverCloseTimerRef = useRef(null);

  useEffect(() => {
    return () => {
      if (hoverOpenTimerRef.current) clearTimeout(hoverOpenTimerRef.current);
      if (hoverCloseTimerRef.current) clearTimeout(hoverCloseTimerRef.current);
    };
  }, []);

  const handleAction = (cb) => {
    cb();
    closeMobileSidebar();
    setDesktopSidebarHovered(false);
  };

  const handleZoneMouseEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    hoverOpenTimerRef.current = setTimeout(() => setDesktopSidebarHovered(true), 80);
  };

  const handleZoneMouseLeave = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    hoverCloseTimerRef.current = setTimeout(() => setDesktopSidebarHovered(false), 250);
  };

  const handleSidebarMouseEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const handleSidebarMouseLeave = () => {
    hoverCloseTimerRef.current = setTimeout(() => setDesktopSidebarHovered(false), 250);
  };

  const isHomeActive = activeConversationId === null;

  const renderSidebarBody = () => (
    <div className="flex h-full select-none flex-col">
      {/* Mobile close */}
      <div className="flex items-center justify-end px-3 pt-3 lg:hidden">
        <button
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Close menu"
          className="rounded-lg p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700 dark:hover:bg-white/5 dark:hover:text-white"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-5 overflow-y-auto px-3 py-4">
        {/* Main Navigation Stack */}
        <div className="space-y-1">
          {/* Home */}
          <button
            onClick={() => handleAction(() => setActiveConversationId(null))}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
              isHomeActive
                ? 'bg-[#e6f4ea] text-[#0f5132] dark:bg-[#1e5b4b]/50 dark:text-emerald-200 shadow-sm'
                : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
          >
            <Home className="h-4 w-4 flex-shrink-0 text-emerald-700 dark:text-emerald-400" />
            <span>{t('sidebar.home')}</span>
          </button>

          {/* Ask an IPR Question */}
          <button
            onClick={() => handleAction(() => startNewConversation())}
            className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium transition-colors ${
              !isHomeActive
                ? 'bg-emerald-50/80 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                : 'text-slate-700 hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5'
            }`}
          >
            <MessageSquare className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t('sidebar.askQuestion')}</span>
          </button>

          {/* Analyze My Product */}
          <button
            onClick={() => handleAction(() => setActiveModal('classify'))}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <FlaskConical className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t('sidebar.analyzeProduct')}</span>
          </button>

          {/* ABS Compliance Helper */}
          <button
            onClick={() => handleAction(() => setActiveModal('abs'))}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <Leaf className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t('sidebar.absHelper')}</span>
          </button>

          {/* TK / Prior Art Check */}
          <button
            onClick={() => handleAction(() => setActiveModal('tkdl'))}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <FileSearch className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t('sidebar.tkCheck')}</span>
          </button>

          {/* Knowledge Hub */}
          <button
            onClick={() => handleAction(() => setActiveModal('admin'))}
            className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <BookOpen className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
            <span className="truncate">{t('sidebar.knowledgeHub')}</span>
          </button>

          {/* My History toggle */}
          <button
            onClick={() => setShowHistoryList((p) => !p)}
            className="flex w-full items-center justify-between rounded-xl px-3.5 py-2.5 text-[13.5px] font-medium text-slate-700 transition-colors hover:bg-slate-100/70 dark:text-slate-300 dark:hover:bg-white/5"
          >
            <div className="flex items-center gap-3 min-w-0">
              <Clock className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t('sidebar.myHistory')}</span>
            </div>
            {conversations.length > 0 && (
              <span className="rounded-full bg-slate-200/70 px-2 py-0.5 text-[11px] text-slate-600 dark:bg-white/10 dark:text-slate-400">
                {conversations.length}
              </span>
            )}
          </button>

          {/* Expanded history list */}
          {showHistoryList && conversations.length > 0 && (
            <div className="ml-4 pl-2 border-l border-emerald-900/10 dark:border-white/10 space-y-1 pt-1 pb-1">
              {conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleAction(() => setActiveConversationId(conv.id))}
                    className={`group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2 py-1.5 text-[12.5px] transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-900 font-medium dark:bg-emerald-500/15 dark:text-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="truncate">{conv.title || 'Inquiry'}</span>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="flex-shrink-0 p-0.5 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100 dark:text-slate-500"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Tools & Features Section */}
        <div className="pt-2 border-t border-slate-200/60 dark:border-emerald-900/40">
          <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {t('sidebar.toolsFeatures')}
          </p>
          <div className="space-y-0.5">
            <button
              onClick={() => {
                // Focus language or show note
                const selectEl = document.querySelector('select[aria-label="Language"]');
                selectEl?.focus();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Languages className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t('sidebar.multilingual')}</span>
            </button>

            <button
              onClick={() => {
                // Trigger voice mic in chat input
                const micBtn = document.querySelector('button[title*="Speak"]');
                if (micBtn) (micBtn).click();
              }}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <Mic className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t('sidebar.voiceAssistant')}</span>
            </button>

            <button
              onClick={() => handleAction(() => setActiveModal('escalate'))}
              className="flex w-full items-center gap-3 rounded-xl px-3.5 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/70 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
            >
              <UserRound className="h-4 w-4 flex-shrink-0 text-emerald-600 dark:text-emerald-400" />
              <span className="truncate">{t('sidebar.talkToExpert')}</span>
            </button>
          </div>
        </div>
      </div>

      {/* Quiet footer: what regime is active, nothing more */}
      <div className="px-5 py-4">
        <p className="text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-600">
          {t('sidebar.answeringUnder')}{' '}
          <span className="font-medium text-emerald-700/80 dark:text-emerald-400/80">
            {jurisdiction === 'india' ? t('sidebar.indianLaw') : t('sidebar.intlLaw')}
          </span>
        </p>
      </div>
    </div>
  );

  return (
    <>
      {isMobileSidebarOpen && (
        <div
          onClick={closeMobileSidebar}
          className="animate-in fade-in fixed inset-0 z-40 bg-slate-900/30 backdrop-blur-sm lg:hidden"
          aria-hidden="true"
        />
      )}

      <aside
        aria-label="Navigation"
        className={`fixed inset-y-0 left-0 z-50 flex w-72 flex-col border-r border-emerald-900/[0.06] bg-white/95 backdrop-blur-xl transition-transform duration-300 ease-out dark:border-white/[0.06] dark:bg-[#081115]/95 lg:hidden ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {renderSidebarBody()}
      </aside>

      {isDesktopSidebarPinned && (
        <aside
          aria-label="Navigation"
          className="hidden h-full w-64 flex-shrink-0 flex-col border-r border-emerald-900/[0.06] bg-white/40 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.015] lg:flex xl:w-[17rem]"
        >
          {renderSidebarBody()}
        </aside>
      )}

      {!isDesktopSidebarPinned && (
        <div
          onMouseEnter={handleZoneMouseEnter}
          onMouseLeave={handleZoneMouseLeave}
          className="group fixed bottom-0 left-0 top-16 z-40 hidden w-3 cursor-pointer lg:block"
          aria-label="Reveal navigation"
        >
          <div className="absolute left-0 top-1/2 h-16 w-0.5 -translate-y-1/2 rounded-r-full bg-emerald-500/20 transition-colors group-hover:bg-emerald-500/60" />
        </div>
      )}

      {!isDesktopSidebarPinned && isDesktopSidebarHovered && (
        <aside
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          aria-label="Navigation"
          className="animate-in fade-in slide-in-from-left-3 fixed bottom-0 left-0 top-16 z-50 hidden w-64 flex-col border-r border-emerald-900/[0.06] bg-white/95 shadow-2xl backdrop-blur-xl duration-200 dark:border-white/[0.06] dark:bg-[#081115]/95 lg:flex xl:w-[17rem]"
        >
          {renderSidebarBody()}
        </aside>
      )}
    </>
  );
};
