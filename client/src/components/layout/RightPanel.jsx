import React from 'react';
import { useChat } from '../../context/ChatContext';
import { LeafMark } from './LeafMark';
import {
  ShieldCheck,
  FileText,
  Clock,
  Link2,
  Calendar,
  ChevronRight,
} from 'lucide-react';

export const RightPanel = () => {
  const { sendMessage, setActiveModal } = useChat();

  const quickAccessItems = [
    {
      title: 'IP Rights Overview',
      icon: ShieldCheck,
      action: () =>
        sendMessage(
          'Provide an overview of Intellectual Property Rights applicable to Ayurvedic formulations, patentability criteria, and branding protection.'
        ),
    },
    {
      title: 'Regulatory Framework',
      icon: FileText,
      action: () =>
        sendMessage(
          'What is the statutory regulatory framework for ASU (Ayurveda, Siddha, Unani) drugs under the Drugs and Cosmetics Act and Rules?'
        ),
    },
    {
      title: 'Recent Updates',
      icon: Clock,
      action: () =>
        sendMessage(
          'What are the most recent notifications, biological diversity guidelines, and patent rule amendments affecting Ayurvedic innovations?'
        ),
    },
    {
      title: 'Useful Links',
      icon: Link2,
      action: () => setActiveModal('admin'),
    },
  ];

  return (
    <aside
      aria-label="Traditional Knowledge & Quick Access"
      className="hidden w-72 flex-shrink-0 flex-col gap-4 overflow-y-auto px-4 py-6 xl:flex 2xl:w-80"
    >
      {/* Traditional Knowledge Hero Card */}
      <div className="flex items-center gap-3.5 rounded-2xl border border-emerald-300/40 bg-[#eaf5ef] p-3.5 shadow-sm transition-colors dark:border-emerald-600/30 dark:bg-[#13382d]">
        <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-200/60 text-emerald-800 dark:bg-emerald-500/20 dark:text-emerald-300">
          <LeafMark className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h4 className="text-[13px] font-bold leading-tight text-emerald-950 dark:text-emerald-100">
            Traditional Knowledge
          </h4>
          <p className="mt-0.5 text-[11px] font-medium text-emerald-800/80 dark:text-emerald-300/80">
            Protected. Innovation Empowered.
          </p>
        </div>
      </div>

      {/* Quick Access Card */}
      <div className="rounded-2xl border border-emerald-900/[0.07] bg-white/85 p-4 shadow-sm backdrop-blur-md transition-colors dark:border-emerald-700/20 dark:bg-[#0c241c]/85">
        <h3 className="mb-3 text-[13.5px] font-bold text-slate-800 dark:text-slate-100">
          Quick Access
        </h3>
        <div className="space-y-1">
          {quickAccessItems.map((item, idx) => {
            const Icon = item.icon;
            return (
              <button
                key={idx}
                onClick={item.action}
                className="group flex w-full items-center justify-between rounded-xl px-2.5 py-2.5 text-left transition-colors hover:bg-emerald-50/70 dark:hover:bg-white/5"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <Icon className="h-4 w-4 flex-shrink-0 text-emerald-600/80 dark:text-emerald-400" />
                  <span className="truncate text-[13px] font-medium text-slate-700 group-hover:text-emerald-900 dark:text-slate-300 dark:group-hover:text-emerald-200">
                    {item.title}
                  </span>
                </div>
                <ChevronRight className="h-3.5 w-3.5 flex-shrink-0 text-slate-400 opacity-60 transition-transform group-hover:translate-x-0.5 group-hover:opacity-100 dark:text-slate-500" />
              </button>
            );
          })}
        </div>
      </div>

      {/* Latest Updates Card */}
      <div className="rounded-2xl border border-emerald-900/[0.07] bg-white/85 p-4 shadow-sm backdrop-blur-md transition-colors dark:border-emerald-700/20 dark:bg-[#0c241c]/85">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-[13.5px] font-bold text-slate-800 dark:text-slate-100">
              Latest Updates
            </h3>
          </div>
          <button
            onClick={() =>
              sendMessage(
                'List all recent legal and statutory updates in Indian patent rules and AYUSH guidelines.'
              )
            }
            className="text-[11.5px] font-semibold text-emerald-700 transition-colors hover:underline dark:text-emerald-400"
          >
            View All
          </button>
        </div>

        <button
          onClick={() =>
            sendMessage(
              'What changes were introduced in the Patent Rules, 2024 and how do they impact traditional knowledge and pharmaceutical patents?'
            )
          }
          className="group flex w-full items-start gap-3 rounded-xl border border-emerald-900/[0.06] bg-slate-50/60 p-3 text-left transition-all hover:border-emerald-500/30 hover:bg-emerald-50/50 dark:border-emerald-700/20 dark:bg-[#102d23]/50 dark:hover:bg-[#102d23]"
        >
          <div className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg bg-emerald-100 text-emerald-700 dark:bg-emerald-500/20 dark:text-emerald-300">
            <Calendar className="h-4 w-4" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="truncate text-[13px] font-semibold text-slate-800 group-hover:text-emerald-800 dark:text-slate-200 dark:group-hover:text-emerald-300">
              Patent Rules, 2024
            </p>
            <p className="mt-0.5 text-[11px] text-slate-500 dark:text-slate-400">
              Updated on 12 Aug 2024
            </p>
          </div>
        </button>
      </div>
    </aside>
  );
};
