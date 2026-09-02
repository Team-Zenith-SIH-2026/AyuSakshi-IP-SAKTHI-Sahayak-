import React from 'react';
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
  ExternalLink,
  ChevronRight,
  ShieldCheck,
} from 'lucide-react';

export const Sidebar = () => {
  const {
    conversations,
    activeConversationId,
    setActiveConversationId,
    startNewConversation,
    deleteConversation,
    setActiveModal,
  } = useChat();
  const { jurisdiction } = useJurisdiction();

  return (
    <aside className="w-64 lg:w-72 flex-shrink-0 border-r border-slate-200 dark:border-darkbg-border bg-white dark:bg-darkbg-950 flex flex-col justify-between h-[calc(100vh-5.25rem)] select-none">
      {/* Top Controls & New Chat */}
      <div className="p-3 space-y-3">
        <button
          onClick={() => startNewConversation()}
          className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-semibold text-xs shadow-lg shadow-emerald-600/20 transition-all active:scale-[0.98]"
        >
          <Plus className="w-4 h-4" />
          <span>New Regulatory Inquiry</span>
        </button>

        {/* Specialized AYUSH IP Toolkit Navigator */}
        <div className="pt-2">
          <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 px-2 mb-1.5 flex items-center justify-between">
            <span>AYUSH IP Toolkit</span>
            <Sparkles className="w-3 h-3 text-emerald-500" />
          </div>

          <div className="space-y-0.5">
            <button
              onClick={() => setActiveModal('classify')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <FlaskConical className="w-4 h-4 text-emerald-500 group-hover:scale-110 transition-transform" />
                <span>Formulation Classifier</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => setActiveModal('abs')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <Dna className="w-4 h-4 text-teal-500 group-hover:scale-110 transition-transform" />
                <span>ABS Navigator (NBA/SBB)</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => setActiveModal('tkdl')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <BookMarked className="w-4 h-4 text-cyan-500 group-hover:scale-110 transition-transform" />
                <span>TKDL Prior-Art Pointer</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => setActiveModal('escalate')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <UserCheck className="w-4 h-4 text-amber-500 group-hover:scale-110 transition-transform" />
                <span>Human IP Facilitator</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>

            <button
              onClick={() => setActiveModal('admin')}
              className="w-full flex items-center justify-between px-2.5 py-1.5 rounded-lg text-xs font-medium text-slate-700 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-darkbg-card transition-colors group"
            >
              <div className="flex items-center space-x-2">
                <Database className="w-4 h-4 text-purple-500 group-hover:scale-110 transition-transform" />
                <span>Knowledge Base Corpus</span>
              </div>
              <ChevronRight className="w-3 h-3 text-slate-400 opacity-0 group-hover:opacity-100" />
            </button>
          </div>
        </div>

        {/* Recent Conversations List */}
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
                    onClick={() => setActiveConversationId(conv.id)}
                    className={`group flex items-center justify-between px-2.5 py-2 rounded-xl text-xs cursor-pointer transition-all ${
                      isActive
                        ? 'bg-emerald-500/10 dark:bg-emerald-500/15 text-emerald-800 dark:text-emerald-300 font-semibold border border-emerald-500/20 shadow-sm'
                        : 'text-slate-600 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-darkbg-card'
                    }`}
                  >
                    <div className="flex items-center space-x-2 truncate">
                      <MessageSquare className={`w-3.5 h-3.5 flex-shrink-0 ${isActive ? 'text-emerald-500' : 'text-slate-400'}`} />
                      <span className="truncate">{conv.title || 'Untitled Inquiry'}</span>
                    </div>

                    <button
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

      {/* Bottom Pro / System Status Card matching user reference */}
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
    </aside>
  );
};
