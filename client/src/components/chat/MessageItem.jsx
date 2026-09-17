import React from 'react';
import { useChat } from '../../context/ChatContext';
import { ThinkingTrace } from './ThinkingTrace';
import { FormattedAnswer } from './FormattedAnswer';
import { LeafMark } from '../layout/LeafMark';
import { Leaf, BookMarked, UserRound, ChevronRight } from 'lucide-react';

// isLatest: only the newest message's options can be tapped. Older ones have
// already been answered, and the reply is the next message in the thread.
export const MessageItem = ({ message, isLatest = false }) => {
  const { setInspectingSource, openEscalation, sendMessage, isLoading } = useChat();
  const isUser = message.sender === 'user';

  if (isUser) {
    return (
      <div className="animate-in fade-in flex w-full justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-md bg-emerald-700 px-4 py-2.5 text-[14px] leading-relaxed text-white shadow-sm dark:bg-emerald-600">
          {message.content}
        </div>
      </div>
    );
  }

  const citations = Array.isArray(message.citations) ? message.citations : [];
  const thinkingTrace = Array.isArray(message.thinking_trace) ? message.thinking_trace : [];
  const confidenceScore = message.confidence_score !== undefined ? Number(message.confidence_score) : 0;
  // A follow-up question carries no confidence because nothing was answered yet.
  // It must not fall into the "score 0 means refused" check below.
  const isClarifying = message.confidence_level === 'clarifying';
  // A chat reply ("does it work well?") gives no legal information, so it is
  // neither supported nor refused.
  const isChatReply = message.confidence_level === 'conversation';
  const isAbstained =
    !isClarifying && !isChatReply && (message.confidence_level === 'abstained' || confidenceScore === 0);
  const options = Array.isArray(message.clarification?.options) ? message.clarification.options : [];
  const canChoose = isLatest && !isLoading && options.length > 0;

  // Plain words instead of a percentage. "79%" invites a judge to ask what the
  // denominator is; "well supported" says what it means for the reader.
  const confidenceLabel = confidenceScore >= 0.75 ? 'Well supported' : 'Partly supported';

  const isConversational =
    isChatReply ||
    (!isClarifying &&
      (message.synthesis_path?.startsWith('conversational_') || (citations.length === 0 && !isAbstained)));

  return (
    <div className="animate-in fade-in flex w-full items-start gap-3">
      <span className="mt-1 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/10 dark:bg-emerald-500/10 dark:text-emerald-300 dark:ring-emerald-400/15">
        <LeafMark className="h-4 w-4" />
      </span>

      <div className="min-w-0 flex-1">
        {/* Status line */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          {isClarifying ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-sky-50 px-2.5 py-1 text-[11.5px] font-medium text-sky-800 dark:bg-sky-500/10 dark:text-sky-300">
              <span className="h-1.5 w-1.5 rounded-full bg-sky-500" />
              One question first
            </span>
          ) : isConversational ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              AYUSH Assistant
            </span>
          ) : isAbstained ? (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-amber-50 px-2.5 py-1 text-[11.5px] font-medium text-amber-700 dark:bg-amber-500/10 dark:text-amber-300">
              Not enough evidence to answer
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11.5px] font-medium text-emerald-800 dark:bg-emerald-500/10 dark:text-emerald-300">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
              {confidenceLabel}
            </span>
          )}
        </div>

        <ThinkingTrace trace={thinkingTrace} />

        <FormattedAnswer
          content={message.content}
          animate={Boolean(message.isNew)}
          onComplete={() => {
            message.isNew = false;
          }}
        />

        {/* Options for the follow-up question. Tapping one sends its label as the reply. */}
        {canChoose && (
          <div className="mt-3.5 flex flex-wrap gap-1.5">
            {options.map((option) => {
              const isFallback = option.value === 'not_sure' || option.value === 'none';
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => sendMessage(option.label)}
                  className={`rounded-full border px-3 py-1.5 text-left text-[13px] transition-colors ${
                    isFallback
                      ? 'border-transparent text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-white/[0.05]'
                      : 'border-emerald-900/[0.12] bg-white/70 text-slate-800 hover:border-emerald-600/40 hover:bg-emerald-50 dark:border-white/[0.1] dark:bg-white/[0.03] dark:text-slate-200 dark:hover:border-emerald-400/30 dark:hover:bg-emerald-500/10'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        )}

        {/* Biodiversity note */}
        {message.abs_summary && (
          <div className="mt-4 rounded-xl border border-emerald-900/[0.07] bg-white/50 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <p className="mb-1 flex items-center gap-2 text-[12.5px] font-medium text-slate-800 dark:text-slate-200">
              <Leaf className="h-3.5 w-3.5 text-emerald-600/70 dark:text-emerald-400/70" strokeWidth={1.75} />
              Using Indian plants
            </p>
            <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              {message.abs_summary.guidance_summary}
            </p>
          </div>
        )}

        {/* Prior art note */}
        {message.tkdl_summary && (
          <div className="mt-2.5 rounded-xl border border-emerald-900/[0.07] bg-white/50 p-3.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
            <p className="mb-1 flex items-center gap-2 text-[12.5px] font-medium text-slate-800 dark:text-slate-200">
              <BookMarked className="h-3.5 w-3.5 text-emerald-600/70 dark:text-emerald-400/70" strokeWidth={1.75} />
              Already recorded in classical texts
            </p>
            <p className="text-[12.5px] leading-relaxed text-slate-500 dark:text-slate-400">
              {message.tkdl_summary.statutory_note}
            </p>
          </div>
        )}

        {/* Sources */}
        {citations.length > 0 && (
          <div className="mt-4">
            <p className="mb-2 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
              Based on
            </p>
            <div className="space-y-1">
              {citations.map((cit, idx) => (
                <button
                  key={idx}
                  onClick={() => setInspectingSource(cit)}
                  className="group flex w-full items-center gap-3 rounded-lg border border-transparent px-2.5 py-2 text-left transition-colors hover:border-emerald-900/[0.07] hover:bg-white/60 dark:hover:border-white/[0.07] dark:hover:bg-white/[0.03]"
                >
                  <span className="font-mono text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
                    {cit.section_reference || '§'}
                  </span>
                  <span className="min-w-0 flex-1 truncate text-[12.5px] text-slate-500 dark:text-slate-400">
                    {cit.source_title}
                  </span>
                  <ChevronRight
                    className="h-3.5 w-3.5 flex-shrink-0 text-slate-300 opacity-0 transition-opacity group-hover:opacity-100 dark:text-slate-600"
                    strokeWidth={1.75}
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Escalation. Nothing to review in a follow-up question or a chat reply. */}
        {!isClarifying && !isChatReply && (
          <button
            onClick={() => openEscalation(message)}
            className="mt-4 inline-flex items-center gap-2 text-[12.5px] font-medium text-emerald-700 transition-colors hover:text-emerald-900 dark:text-emerald-400 dark:hover:text-emerald-300"
          >
            <UserRound className="h-3.5 w-3.5" strokeWidth={1.75} />
            Ask a human expert to review this
          </button>
        )}
      </div>
    </div>
  );
};
