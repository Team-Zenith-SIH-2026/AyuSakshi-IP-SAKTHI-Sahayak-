import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

/**
 * How the answer was reached, collapsed by default.
 *
 * This is the audit trail, and it matters, but it is not what the reader came
 * for. Shown as one quiet line they can open, rather than a panel competing
 * with the answer above it.
 */
export const ThinkingTrace = ({ trace = [] }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="mb-3">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="inline-flex items-center gap-1.5 text-[12px] text-slate-400 transition-colors hover:text-slate-600 dark:text-slate-500 dark:hover:text-slate-300"
      >
        <span>How this was checked</span>
        <ChevronDown
          className={`h-3.5 w-3.5 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          strokeWidth={1.75}
        />
      </button>

      {isOpen && (
        <ol className="animate-in fade-in mt-2.5 space-y-2 border-l border-emerald-900/[0.08] pl-4 dark:border-white/[0.08]">
          {trace.map((item, idx) => (
            <li key={idx} className="text-[12px] leading-relaxed">
              <span className="font-medium text-slate-600 dark:text-slate-300">{item.step}</span>
              <span className="mt-0.5 block text-slate-400 dark:text-slate-500">{item.detail}</span>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
};
