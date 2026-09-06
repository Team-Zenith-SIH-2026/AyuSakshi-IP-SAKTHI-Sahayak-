import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import {
  Plus,
  MessageSquare,
  Leaf,
  Sprout,
  FileSearch,
  UserRound,
  Library,
  Trash2,
  X,
} from 'lucide-react';

/**
 * Primary navigation.
 *
 * Labels are written for the person using this, not for the people who built
 * it. Someone with a herbal product to protect knows what "check my product"
 * means; they do not know what a "Formulation Classifier" or a "TKDL Prior-Art
 * Pointer" is. Domain terms that genuinely matter (ABS, prior art) are kept but
 * introduced in plain words first.
 */
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

  const tools = [
    { key: 'classify', label: 'Check my product', icon: Sprout },
    { key: 'abs', label: 'Biodiversity rules', icon: Leaf },
    { key: 'tkdl', label: 'Prior art check', icon: FileSearch },
    { key: 'escalate', label: 'Talk to an expert', icon: UserRound },
    { key: 'admin', label: 'Sources', icon: Library },
  ];

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

      <div className="flex-1 space-y-7 overflow-y-auto px-3 py-4">
        {/* New question */}
        <button
          onClick={() => handleAction(() => startNewConversation())}
          className="flex w-full items-center gap-2.5 rounded-xl border border-emerald-600/15 bg-emerald-50/70 px-3.5 py-2.5 text-[13px] font-medium text-emerald-900 transition-colors hover:bg-emerald-100/70 dark:border-emerald-400/15 dark:bg-emerald-500/10 dark:text-emerald-200 dark:hover:bg-emerald-500/[0.16]"
        >
          <Plus className="h-4 w-4" strokeWidth={1.75} />
          Ask something new
        </button>

        {/* Tools */}
        <div>
          <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Tools
          </p>
          <div className="space-y-0.5">
            {tools.map(({ key, label, icon: Icon }) => (
              <button
                key={key}
                onClick={() => handleAction(() => setActiveModal(key))}
                className="flex w-full items-center gap-3 rounded-lg px-2.5 py-2 text-[13px] text-slate-600 transition-colors hover:bg-slate-100/80 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-white"
              >
                <Icon className="h-4 w-4 flex-shrink-0 text-emerald-600/70 dark:text-emerald-400/70" strokeWidth={1.75} />
                <span className="truncate">{label}</span>
              </button>
            ))}
          </div>
        </div>

        {/* History */}
        <div>
          <p className="mb-1.5 px-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            Recent
          </p>
          <div className="space-y-0.5">
            {conversations.length === 0 ? (
              <p className="px-2.5 py-3 text-[12.5px] leading-relaxed text-slate-400 dark:text-slate-600">
                Your past questions will appear here.
              </p>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleAction(() => setActiveConversationId(conv.id))}
                    className={`group flex cursor-pointer items-center justify-between gap-2 rounded-lg px-2.5 py-2 text-[13px] transition-colors ${
                      isActive
                        ? 'bg-emerald-50 text-emerald-900 dark:bg-emerald-500/10 dark:text-emerald-200'
                        : 'text-slate-600 hover:bg-slate-100/80 dark:text-slate-400 dark:hover:bg-white/5'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2.5">
                      <MessageSquare
                        className={`h-3.5 w-3.5 flex-shrink-0 ${
                          isActive ? 'text-emerald-600 dark:text-emerald-400' : 'text-slate-300 dark:text-slate-600'
                        }`}
                        strokeWidth={1.75}
                      />
                      <span className="truncate">{conv.title || 'Untitled'}</span>
                    </div>
                    <button
                      type="button"
                      aria-label="Delete"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="flex-shrink-0 p-1 text-slate-300 opacity-0 transition-all hover:text-rose-500 group-hover:opacity-100 dark:text-slate-600"
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Quiet footer: what regime is active, nothing more */}
      <div className="px-5 py-4">
        <p className="text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-600">
          Answering under{' '}
          <span className="font-medium text-emerald-700/80 dark:text-emerald-400/80">
            {jurisdiction === 'india' ? 'Indian' : 'international'}
          </span>{' '}
          law.
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
