import React, { useRef, useEffect } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import {
  Plus,
  MessageSquare,
  Sparkles,
  FlaskConical,
  Dna,
  BookMarked,
  UserCheck,
  Trash2,
  Database,
  ChevronRight,
  X,
  PanelLeftClose,
  PanelLeft,
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
    toggleDesktopSidebar,
    isDesktopSidebarHovered,
    setDesktopSidebarHovered,
  } = useChat();

  const { jurisdiction } = useJurisdiction();

  const hoverOpenTimerRef = useRef(null);
  const hoverCloseTimerRef = useRef(null);

  // Clear timers on unmount
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

  // Hover zone handlers for desktop collapsed mode
  const handleZoneMouseEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
    hoverOpenTimerRef.current = setTimeout(() => {
      setDesktopSidebarHovered(true);
    }, 80);
  };

  const handleZoneMouseLeave = () => {
    if (hoverOpenTimerRef.current) {
      clearTimeout(hoverOpenTimerRef.current);
      hoverOpenTimerRef.current = null;
    }
    hoverCloseTimerRef.current = setTimeout(() => {
      setDesktopSidebarHovered(false);
    }, 250);
  };

  const handleSidebarMouseEnter = () => {
    if (hoverCloseTimerRef.current) {
      clearTimeout(hoverCloseTimerRef.current);
      hoverCloseTimerRef.current = null;
    }
  };

  const handleSidebarMouseLeave = () => {
    hoverCloseTimerRef.current = setTimeout(() => {
      setDesktopSidebarHovered(false);
    }, 250);
  };

  // Common inner sidebar content
  const renderSidebarBody = (isFloating = false) => (
    <div className="flex flex-col justify-between h-full select-none">
      {/* Top Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-slate-100 dark:border-darkbg-border bg-slate-50/50 dark:bg-darkbg-950/50">
        <div className="flex items-center space-x-2">
          <Sparkles className="w-4 h-4 text-emerald-500" />
          <span className="font-bold text-xs text-slate-800 dark:text-slate-200">
            AYUSH IP Navigator
          </span>
        </div>

        {/* Mobile close button */}
        <button
          type="button"
          onClick={closeMobileSidebar}
          aria-label="Close navigation menu"
          className="lg:hidden p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors"
        >
          <X className="w-4 h-4" />
        </button>

        {/* Desktop Pin / Unpin button */}
        <div className="hidden lg:flex items-center space-x-1">
          {isFloating ? (
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              title="Pin sidebar open"
              aria-label="Pin sidebar open"
              className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-500 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors"
            >
              <PanelLeft className="w-4 h-4" />
            </button>
          ) : (
            <button
              type="button"
              onClick={toggleDesktopSidebar}
              title="Collapse sidebar"
              aria-label="Collapse sidebar"
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors"
            >
              <PanelLeftClose className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Top Controls & Navigation Items */}
      <div className="p-3 space-y-3 overflow-y-auto flex-1 custom-scrollbar">
        {/* New Inquiry Button */}
        <button
          onClick={() => handleAction(() => startNewConversation())}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-md shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Regulatory Inquiry</span>
        </button>

        {/* Specialized AYUSH IP Toolkit */}
        <div className="pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1.5 flex items-center justify-between">
            <span>AYUSH IP Toolkit</span>
            <Sparkles className="w-3 h-3 text-emerald-500" />
          </div>

          <div className="space-y-0.5">
            <button
              onClick={() => handleAction(() => setActiveModal('classify'))}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <FlaskConical className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate">Formulation Classifier</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>

            <button
              onClick={() => handleAction(() => setActiveModal('abs'))}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <Dna className="w-4 h-4 text-teal-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate">ABS Navigator (NBA/SBB)</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>

            <button
              onClick={() => handleAction(() => setActiveModal('tkdl'))}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <BookMarked className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate">TKDL Prior-Art Pointer</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>

            <button
              onClick={() => handleAction(() => setActiveModal('escalate'))}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate">Human IP Facilitator</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>

            <button
              onClick={() => handleAction(() => setActiveModal('admin'))}
              className="w-full flex items-center justify-between px-2.5 py-2 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform flex-shrink-0" />
                <span className="truncate">Knowledge Base Corpus</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100 flex-shrink-0" />
            </button>
          </div>
        </div>

        {/* Recent Inquiries List */}
        <div className="pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1.5">
            Recent Inquiries ({jurisdiction})
          </div>

          <div className="overflow-y-auto max-h-[36vh] space-y-1 pr-1">
            {conversations.length === 0 ? (
              <div className="px-3 py-4 text-center text-slate-400 dark:text-slate-600 text-xs">
                No previous inquiries in {jurisdiction}.
              </div>
            ) : (
              conversations.map((conv) => {
                const isActive = activeConversationId === conv.id;
                return (
                  <div
                    key={conv.id}
                    onClick={() => handleAction(() => setActiveConversationId(conv.id))}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-card'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <MessageSquare
                        className={`w-3.5 h-3.5 flex-shrink-0 ${
                          isActive ? 'text-emerald-500' : 'text-slate-400'
                        }`}
                      />
                      <span className="truncate">{conv.title || 'Untitled Inquiry'}</span>
                    </div>

                    <button
                      type="button"
                      aria-label="Delete conversation"
                      onClick={(e) => {
                        e.stopPropagation();
                        deleteConversation(conv.id);
                      }}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-rose-500 transition-opacity"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Bottom Pro Badge */}
      <div className="p-3 border-t border-slate-200 dark:border-darkbg-border bg-slate-50/50 dark:bg-darkbg-card/40">
        <div className="p-2.5 rounded-xl bg-gradient-to-br from-emerald-950/40 to-slate-900 border border-emerald-500/20 text-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
              SIH26045 PRO
            </span>
            <span className="text-[10px] text-emerald-400 flex items-center space-x-1">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              <span>Online</span>
            </span>
          </div>
          <p className="text-[11px] text-slate-300 font-medium leading-relaxed">
            Multi-source statutory grounding with verifiable legal citations.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      {/* 1. Mobile/Tablet Drawer Backdrop */}
      {isMobileSidebarOpen && (
        <div
          onClick={closeMobileSidebar}
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40 lg:hidden transition-opacity animate-in fade-in"
          aria-hidden="true"
        />
      )}

      {/* 2. Mobile/Tablet Drawer Aside */}
      <aside
        aria-label="Mobile navigation sidebar"
        className={`fixed inset-y-0 left-0 z-50 lg:hidden w-72 sm:w-80 border-r border-slate-200 dark:border-darkbg-border bg-white dark:bg-darkbg-950 flex flex-col justify-between h-full select-none transition-transform duration-300 ease-in-out ${
          isMobileSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full'
        }`}
      >
        {renderSidebarBody(false)}
      </aside>

      {/* 3. Desktop In-Flow Pinned Sidebar */}
      {isDesktopSidebarPinned && (
        <aside
          aria-label="Desktop primary navigation sidebar"
          className="hidden lg:flex w-64 xl:w-72 flex-shrink-0 border-r border-slate-200 dark:border-darkbg-border bg-white dark:bg-darkbg-950 flex-col justify-between h-full select-none transition-all duration-300"
        >
          {renderSidebarBody(false)}
        </aside>
      )}

      {/* 4. Desktop Collapsed Left-Edge Hover Trigger Zone */}
      {!isDesktopSidebarPinned && (
        <div
          onMouseEnter={handleZoneMouseEnter}
          onMouseLeave={handleZoneMouseLeave}
          className="hidden lg:block fixed left-0 top-14 sm:top-16 bottom-0 w-3.5 z-40 cursor-pointer group"
          aria-label="Hover left edge to reveal sidebar"
        >
          {/* Subtle glowing vertical pill visible on hover near edge */}
          <div className="w-1 h-16 rounded-r-full bg-emerald-500/30 group-hover:bg-emerald-500 transition-colors absolute top-1/2 -translate-y-1/2 left-0 shadow-sm" />
        </div>
      )}

      {/* 5. Desktop Temporary Floating Overlay Sidebar on Hover */}
      {!isDesktopSidebarPinned && isDesktopSidebarHovered && (
        <aside
          onMouseEnter={handleSidebarMouseEnter}
          onMouseLeave={handleSidebarMouseLeave}
          aria-label="Temporary navigation sidebar"
          className="hidden lg:flex fixed left-0 top-14 sm:top-16 bottom-0 w-64 xl:w-72 z-50 shadow-2xl bg-white dark:bg-darkbg-950 border-r border-slate-200 dark:border-darkbg-border flex-col justify-between select-none animate-in fade-in slide-in-from-left-4 duration-200"
        >
          {renderSidebarBody(true)}
        </aside>
      )}
    </>
  );
};
