import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { MessageItem } from './MessageItem';
import {
  Sparkles,
  FlaskConical,
  Scale,
  Dna,
  ShieldCheck,
  ChevronRight,
  HelpCircle,
  BookOpen,
} from 'lucide-react';

export const ChatArea = () => {
  const { messages, isLoading, sendMessage, setActiveModal } = useChat();
  const { jurisdiction, isIndia } = useJurisdiction();
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const starterQuestions = isIndia
    ? [
        {
          title: 'Section 3(p) Patentability Check',
          desc: 'Can I patent an Ayurvedic herbal formulation if its components are listed in Charaka Samhita?',
          icon: Scale,
        },
        {
          title: 'ABS Compliance & NBA Form III',
          desc: 'What are the benefit-sharing obligations under Biological Diversity Act 2023 for Ayurvedic startups?',
          icon: Dna,
        },
        {
          title: 'Classical vs P or P Drug Licensing',
          desc: 'What is the regulatory difference between a Classical Ayurvedic Drug and Patent/Proprietary medicine?',
          icon: FlaskConical,
        },
        {
          title: 'FSSAI Ayurveda Aahara Guidelines',
          desc: 'How to register a health supplement under Food Safety and Standards (Ayurveda Aahara) Regulations 2022?',
          icon: ShieldCheck,
        },
      ]
    : [
        {
          title: 'WIPO GRATK Treaty (2024)',
          desc: 'What mandatory disclosure requirements exist for patent applications based on traditional knowledge?',
          icon: Scale,
        },
        {
          title: 'Nagoya Protocol International ABS',
          desc: 'How do international buyers comply with Prior Informed Consent (PIC) when importing Indian botanical extracts?',
          icon: Dna,
        },
        {
          title: 'PCT & Madrid Trademark Filing',
          desc: 'How to protect an Ayurvedic brand and novel herbal process across multiple export markets?',
          icon: BookOpen,
        },
      ];

  return (
    <div className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 space-y-4 w-full">
      <div className="max-w-4xl mx-auto w-full">
        {messages.length === 0 ? (
          /* Welcome Splash & Suggested Inquiry Cards */
          <div className="py-4 sm:py-8 space-y-4 sm:space-y-6 animate-in fade-in max-w-full">
            {/* Splash Header */}
            <div className="text-center space-y-2 max-w-xl mx-auto px-2">
              <div className="inline-flex items-center space-x-2 px-3 py-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 text-xs font-semibold">
                <Sparkles className="w-3.5 h-3.5" />
                <span>SIH26045 • {jurisdiction.toUpperCase()} REGIME ACTIVE</span>
              </div>
              <h2 className="text-xl sm:text-2xl md:text-3xl font-extrabold text-slate-900 dark:text-white tracking-tight">
                AyuSakshi Regulatory Intelligence
              </h2>
              <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                Multilingual, source-grounded assistant for Intellectual Property, ABS compliance, and regulatory classification in Ayurveda.
              </p>
            </div>

            {/* Quick Starter Cards Grid: 1 col on mobile, 2 cols on tablet/desktop */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-2 w-full">
              {starterQuestions.map((q, idx) => {
                const Icon = q.icon;
                return (
                  <button
                    key={idx}
                    onClick={() => sendMessage(q.desc)}
                    className="flex items-start space-x-3 p-3.5 sm:p-4 rounded-xl sm:rounded-2xl glass-card hover:border-emerald-500/50 hover:shadow-lg dark:hover:shadow-emerald-950/30 transition-all text-left group w-full min-w-0"
                  >
                    <div className="p-2 sm:p-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 group-hover:scale-105 transition-transform flex-shrink-0 mt-0.5">
                      <Icon className="w-4 h-4 sm:w-5 sm:h-5" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h4 className="text-xs sm:text-sm font-bold text-slate-900 dark:text-white mb-1 group-hover:text-emerald-500 transition-colors break-words">
                        {q.title}
                      </h4>
                      <p className="text-[11.5px] sm:text-xs text-slate-500 dark:text-slate-400 leading-relaxed break-words">
                        {q.desc}
                      </p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-slate-400 opacity-0 group-hover:opacity-100 transition-opacity flex-shrink-0 self-center hidden sm:block" />
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          /* Conversation Message Stream */
          <div className="space-y-4 w-full">
            {messages.map((msg, index) => (
              <MessageItem key={msg.id || index} message={msg} />
            ))}

            {/* Loading / Thinking Skeleton */}
            {isLoading && (
              <div className="flex items-start space-x-2.5 max-w-full sm:max-w-[85%] animate-pulse">
                <div className="w-8 h-8 rounded-xl bg-emerald-600/20 text-emerald-500 flex items-center justify-center flex-shrink-0 mt-1">
                  <Sparkles className="w-4 h-4 animate-spin" />
                </div>
                <div className="flex-1 p-3.5 sm:p-4 rounded-2xl glass-card border border-slate-200 dark:border-darkbg-border space-y-2">
                  <div className="h-3 w-40 sm:w-48 bg-slate-200 dark:bg-darkbg-border rounded"></div>
                  <div className="h-2.5 w-full bg-slate-100 dark:bg-darkbg-border/60 rounded"></div>
                  <div className="h-2.5 w-3/4 bg-slate-100 dark:bg-darkbg-border/60 rounded"></div>
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
