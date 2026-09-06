import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { MessageItem } from './MessageItem';
import { LeafMark } from '../layout/LeafMark';
import { Sprout, Scale, Leaf, FileSearch, Globe2, ArrowUpRight } from 'lucide-react';

export const ChatArea = () => {
  const { messages, isLoading, sendMessage } = useChat();
  const { isIndia } = useJurisdiction();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Written as a person would actually ask them, not as feature names.
  const suggestions = isIndia
    ? [
        {
          icon: Scale,
          title: 'Can I patent this?',
          desc: 'Whether a formulation built on classical texts can be protected.',
          ask: 'Can a classical formulation from the Charaka Samhita be patented in India?',
        },
        {
          icon: Leaf,
          title: 'Do I need approval to use this plant?',
          desc: 'Permissions and benefit sharing when you use Indian plants.',
          ask: 'Do I need National Biodiversity Authority approval before filing a patent using an Indian medicinal plant?',
        },
        {
          icon: Sprout,
          title: 'Is my product a medicine or a food?',
          desc: 'Which licence you need, and what you may claim on the label.',
          ask: 'What is the difference between a patent or proprietary medicine and a new drug for licensing purposes?',
        },
        {
          icon: FileSearch,
          title: 'Has someone already claimed this?',
          desc: 'Where traditional recipes are recorded, and what that protects.',
          ask: 'How do I stop a foreign company patenting a formulation from our tradition?',
        },
      ]
    : [
        {
          icon: Globe2,
          title: 'What must I disclose abroad?',
          desc: 'New global rules on naming where your plants came from.',
          ask: 'What does the WIPO GRATK Treaty require me to disclose when filing abroad?',
        },
        {
          icon: Leaf,
          title: 'Rules on sharing benefits',
          desc: 'Consent and terms when genetic resources cross borders.',
          ask: 'Is prior informed consent required to access genetic resources under the Nagoya Protocol?',
        },
        {
          icon: Scale,
          title: 'Can plants be patented at all?',
          desc: 'What international agreements let countries exclude.',
          ask: 'Does TRIPS allow countries to exclude plants from patentability?',
        },
      ];

  return (
    <div className="w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-3xl">
        {messages.length === 0 ? (
          <div className="animate-in fade-in duration-500">
            {/* Greeting */}
            <div className="pb-9 pt-8 sm:pt-14">
              <span className="mb-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/15">
                <LeafMark className="h-6 w-6" />
              </span>
              <h1 className="text-[26px] font-normal leading-snug tracking-tight text-slate-900 dark:text-white sm:text-[32px]">
                Protect what you have made.
              </h1>
              <p className="mt-3 max-w-lg text-[14.5px] leading-relaxed text-slate-500 dark:text-slate-400">
                Ask about patents, trademarks, biodiversity approvals or product licensing for
                Ayurvedic products. Every answer points to the law it came from.
              </p>
            </div>

            {/* Suggestions */}
            <div className="space-y-2">
              <p className="px-1 pb-1 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
                Start with
              </p>
              {suggestions.map((s, idx) => {
                const Icon = s.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => sendMessage(s.ask)}
                    className="group flex w-full items-center gap-4 rounded-2xl border border-emerald-900/[0.07] bg-white/60 px-4 py-3.5 text-left backdrop-blur-sm transition-all hover:border-emerald-600/25 hover:bg-white/90 dark:border-white/[0.07] dark:bg-white/[0.02] dark:hover:border-emerald-400/20 dark:hover:bg-white/[0.05]"
                  >
                    <Icon
                      className="h-[18px] w-[18px] flex-shrink-0 text-emerald-600/70 dark:text-emerald-400/70"
                      strokeWidth={1.6}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[14px] font-medium text-slate-800 dark:text-slate-100">
                        {s.title}
                      </span>
                      <span className="mt-0.5 block truncate text-[12.5px] text-slate-400 dark:text-slate-500">
                        {s.desc}
                      </span>
                    </span>
                    <ArrowUpRight
                      className="h-4 w-4 flex-shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
                      strokeWidth={1.75}
                    />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="w-full space-y-5">
            {messages.map((msg, index) => (
              <MessageItem key={msg.id || index} message={msg} />
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <LeafMark className="h-4 w-4" />
                </span>
                <div className="flex-1 space-y-2.5 pt-1.5">
                  <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.07]" />
                  <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.04]" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.04]" />
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};
