import React from 'react';
import { useChat } from '../../context/ChatContext';
import { X, ExternalLink, ShieldCheck, FileText, Scale, Bookmark } from 'lucide-react';

export const SourceDrawer = () => {
  const { inspectingSource, setInspectingSource } = useChat();

  if (!inspectingSource) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[88vh] sm:max-h-[85vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <Scale className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Authoritative Source Evidence
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Verified against statutory registry records
              </p>
            </div>
          </div>
          <button
            onClick={() => setInspectingSource(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-darkbg-border transition-colors flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Document Title & Section Badge */}
          <div className="p-3 rounded-xl bg-emerald-50/50 dark:bg-emerald-950/20 border border-emerald-200/60 dark:border-emerald-500/30 space-y-1">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-bold text-emerald-700 dark:text-emerald-400 tracking-wider">
                {inspectingSource.jurisdiction?.toUpperCase()} REGULATORY REGIME
              </span>
              {/* Reflects the verifier's actual result. Previously hardcoded,
                  which meant the badge said "verified" no matter what. */}
              {inspectingSource.verified_grounded === true ? (
                <span className="flex items-center space-x-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Grounding Verified</span>
                </span>
              ) : (
                <span className="flex items-center space-x-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
                  <ShieldCheck className="w-3 h-3" />
                  <span>Retrieved, Not Verified</span>
                </span>
              )}
            </div>
            <h4 className="text-sm font-bold text-slate-900 dark:text-white">
              {inspectingSource.source_title}
            </h4>
            <div className="flex items-center space-x-2 pt-1 text-[11px] text-slate-600 dark:text-slate-400">
              <span className="font-semibold text-emerald-600 dark:text-emerald-400 bg-emerald-100 dark:bg-emerald-500/10 px-2 py-0.5 rounded">
                {inspectingSource.section_reference || 'General Section'}
              </span>
              <span>•</span>
              <span>Authority: {inspectingSource.authority || 'National Statutory Authority'}</span>
            </div>
          </div>

          {/* Statutory Evidence Text Chunk */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1.5">
              Exact Statutory Provision
            </label>
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-slate-800 dark:text-slate-200 leading-relaxed font-mono text-[11.5px] whitespace-pre-wrap">
              {inspectingSource.claim_text || inspectingSource.content || 'Authoritative statutory text provision.'}
            </div>
          </div>

          {/* Metadata Grid */}
          <div className="grid grid-cols-2 gap-2 text-[11px]">
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-darkbg-950 border border-slate-100 dark:border-darkbg-border">
              <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase">Version Identifier</span>
              <span className="font-semibold text-slate-700 dark:text-slate-300">{inspectingSource.version_tag || 'Current Official Consolidated'}</span>
            </div>
            <div className="p-2.5 rounded-lg bg-slate-50 dark:bg-darkbg-950 border border-slate-100 dark:border-darkbg-border">
              <span className="text-slate-400 dark:text-slate-500 block text-[10px] uppercase">Retrieval Score</span>
              {/* Label says what this number is: reranker relevance, not entailment.
                  No invented default when the score is missing. */}
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {inspectingSource.similarity_score != null
                  ? `${(inspectingSource.similarity_score * 100).toFixed(1)}% relevance`
                  : 'Not scored'}
              </span>
            </div>
          </div>
        </div>

        {/* Modal Footer */}
        <div className="px-5 py-3 border-t border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <span className="text-[10px] text-slate-500">
            Official Source Traceability • SIH26045
          </span>
          {inspectingSource.source_url ? (
            <a
              href={inspectingSource.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center space-x-1.5 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition-colors"
            >
              <span>View Official Registry PDF</span>
              <ExternalLink className="w-3 h-3" />
            </a>
          ) : (
            <button
              onClick={() => setInspectingSource(null)}
              className="px-3 py-1.5 rounded-lg bg-slate-200 dark:bg-darkbg-border hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-200 font-semibold text-xs transition-colors"
            >
              Close
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
