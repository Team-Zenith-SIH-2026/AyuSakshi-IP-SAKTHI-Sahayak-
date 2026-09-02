import React, { useState } from 'react';
import { ChevronDown, ChevronRight, Cpu, CheckCircle2 } from 'lucide-react';

export const ThinkingTrace = ({ trace = [], durationSeconds = 1.2 }) => {
  const [isOpen, setIsOpen] = useState(false);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="mb-3 rounded-xl border border-slate-200 dark:border-darkbg-border bg-slate-50/80 dark:bg-[#0a1419]/90 text-xs overflow-hidden transition-all">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between px-3 py-2 text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-slate-200 transition-colors"
      >
        <div className="flex items-center space-x-2">
          <div className="w-4 h-4 rounded-full bg-emerald-500/20 text-emerald-500 flex items-center justify-center">
            <Cpu className="w-2.5 h-2.5" />
          </div>
          <span className="font-semibold text-[11px] text-slate-700 dark:text-slate-300">
            Researched for {durationSeconds}s across statutory regimes
          </span>
          <span className="px-1.5 py-0.2 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-bold">
            {trace.length} steps
          </span>
        </div>
        {isOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
      </button>

      {isOpen && (
        <div className="px-3 pb-2.5 pt-1 space-y-1.5 border-t border-slate-200/60 dark:border-darkbg-border/60">
          {trace.map((item, idx) => (
            <div key={idx} className="flex items-start space-x-2 text-[11px]">
              <CheckCircle2 className="w-3 h-3 text-emerald-500 flex-shrink-0 mt-0.5" />
              <div>
                <span className="font-bold text-slate-800 dark:text-slate-200 mr-1.5">{item.step}:</span>
                <span className="text-slate-600 dark:text-slate-400 leading-relaxed">{item.detail}</span>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
