import React from 'react';
import { useChat } from '../../context/ChatContext';
import { ThinkingTrace } from './ThinkingTrace';
import {
  Sparkles,
  User,
  ShieldAlert,
  ShieldCheck,
  BookOpen,
  UserCheck,
  ExternalLink,
  Scale,
  Dna,
  BookMarked,
  Info,
} from 'lucide-react';

export const MessageItem = ({ message }) => {
  const { setInspectingSource, openEscalation } = useChat();
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 animate-in fade-in">
        <div className="flex items-start space-x-2 max-w-[80%]">
          <div className="bg-emerald-600 dark:bg-emerald-600 text-white px-4 py-3 rounded-2xl rounded-tr-sm shadow-md shadow-emerald-600/10 text-xs sm:text-sm leading-relaxed">
            {message.content}
          </div>
          <div className="w-7 h-7 rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400 flex items-center justify-center flex-shrink-0 mt-0.5">
            <User className="w-4 h-4" />
          </div>
        </div>
      </div>
    );
  }

  // Assistant Message Card
  const citations = Array.isArray(message.citations) ? message.citations : [];
  const thinkingTrace = Array.isArray(message.thinking_trace) ? message.thinking_trace : [];
  const confidenceScore = message.confidence_score !== undefined ? Number(message.confidence_score) : 0.85;
  const isAbstained = message.confidence_level === 'abstained' || confidenceScore === 0;

  return (
    <div className="flex justify-start mb-6 animate-in fade-in">
      <div className="flex items-start space-x-2.5 max-w-[95%] sm:max-w-[88%] w-full">
        {/* Assistant Avatar */}
        <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-emerald-600 to-teal-500 p-0.5 shadow-md shadow-emerald-500/20 flex items-center justify-center flex-shrink-0 mt-1">
          <div className="w-full h-full bg-slate-900 rounded-[10px] flex items-center justify-center">
            <Sparkles className="w-4 h-4 text-emerald-400" />
          </div>
        </div>

        {/* Message Container Card */}
        <div className="flex-1 rounded-2xl glass-card p-4 sm:p-5 text-xs sm:text-sm text-slate-800 dark:text-slate-200 border border-slate-200 dark:border-darkbg-border shadow-xl">
          {/* Header Row with Model status & Confidence indicator */}
          <div className="flex items-center justify-between pb-3 mb-3 border-b border-slate-100 dark:border-darkbg-border text-xs">
            <div className="flex items-center space-x-2">
              <span className="font-bold text-slate-900 dark:text-white">AyuSakshi AI</span>
              <span className="text-[10px] px-2 py-0.5 rounded-full font-bold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                Source Grounded
              </span>
            </div>

            {/* Confidence Pill Indicator */}
            <div className="flex items-center space-x-1.5">
              {isAbstained ? (
                <span className="flex items-center space-x-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                  <ShieldAlert className="w-3 h-3" />
                  <span>Safe Abstention</span>
                </span>
              ) : (
                <span
                  className={`flex items-center space-x-1 text-[11px] font-bold px-2.5 py-0.5 rounded-md border ${
                    confidenceScore >= 0.75
                      ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/20'
                      : 'bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20'
                  }`}
                >
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>Confidence: {(confidenceScore * 100).toFixed(0)}%</span>
                </span>
              )}
            </div>
          </div>

          {/* Collapsible Thinking & Search Process */}
          <ThinkingTrace trace={thinkingTrace} />

          {/* Structured Answer Body */}
          <div className="prose dark:prose-invert max-w-none text-xs sm:text-sm leading-relaxed whitespace-pre-line space-y-2">
            {message.content}
          </div>

          {/* ABS Guidance Badge (if detected in message) */}
          {message.abs_summary && (
            <div className="mt-4 p-3 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-200/60 dark:border-teal-500/30 text-xs">
              <div className="flex items-center space-x-2 font-bold text-teal-800 dark:text-teal-300 mb-1">
                <Dna className="w-4 h-4 text-teal-500" />
                <span>Biological Diversity Act & ABS Summary</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11.5px]">
                {message.abs_summary.guidance_summary || 'Access and Benefit Sharing obligations under Biological Diversity Act 2002 apply.'}
              </p>
            </div>
          )}

          {/* TKDL Prior Art Reference (if detected) */}
          {message.tkdl_summary && (
            <div className="mt-3 p-3 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-200/60 dark:border-cyan-500/30 text-xs">
              <div className="flex items-center space-x-2 font-bold text-cyan-800 dark:text-cyan-300 mb-1">
                <BookMarked className="w-4 h-4 text-cyan-500" />
                <span>TKDL Classical Texts Prior-Art Overlap</span>
              </div>
              <p className="text-slate-600 dark:text-slate-400 leading-relaxed text-[11.5px]">
                {message.tkdl_summary.statutory_note}
              </p>
            </div>
          )}

          {/* Verified Source Citation Chips */}
          {citations.length > 0 && (
            <div className="mt-4 pt-3 border-t border-slate-100 dark:border-darkbg-border">
              <div className="text-[10px] font-bold uppercase tracking-wider text-slate-400 dark:text-slate-500 mb-2 flex items-center space-x-1.5">
                <BookOpen className="w-3.5 h-3.5 text-emerald-500" />
                <span>Statutory Source Citations ({citations.length})</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {citations.map((cit, idx) => (
                  <button
                    key={idx}
                    onClick={() => setInspectingSource(cit)}
                    className="flex items-center space-x-1.5 px-2.5 py-1.5 rounded-lg bg-slate-100 dark:bg-darkbg-950 hover:bg-emerald-50 dark:hover:bg-emerald-950/30 border border-slate-200 dark:border-darkbg-border hover:border-emerald-500/50 text-slate-700 dark:text-slate-300 transition-all text-[11px] group"
                  >
                    <span className="w-4 h-4 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold flex items-center justify-center text-[10px]">
                      {idx + 1}
                    </span>
                    <span className="font-semibold text-slate-900 dark:text-white truncate max-w-[200px]">
                      {cit.source_title}
                    </span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-mono text-[10px]">
                      {cit.section_reference || '§'}
                    </span>
                    <ExternalLink className="w-2.5 h-2.5 text-slate-400 group-hover:text-emerald-400" />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Action Row: Human Facilitator Escalation & Disclaimer */}
          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-darkbg-border flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-400 flex items-center space-x-1">
              <Info className="w-3 h-3 text-slate-400" />
              <span>Source-grounded information, not legal advice.</span>
            </span>

            <button
              onClick={() => openEscalation(message)}
              className="flex items-center space-x-1.5 px-3 py-1 rounded-lg text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-500/10 hover:bg-emerald-100 dark:hover:bg-emerald-500/20 border border-emerald-200 dark:border-emerald-500/30 font-medium transition-colors"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Request Human IP Facilitator Review</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
