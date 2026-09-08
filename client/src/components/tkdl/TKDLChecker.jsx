import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { BookMarked, X, Search, BookOpen, AlertTriangle, ArrowRight } from 'lucide-react';

export const TKDLChecker = () => {
  const { activeModal, setActiveModal, sendMessage } = useChat();
  const [queryHerb, setQueryHerb] = useState('');

  if (activeModal !== 'tkdl') return null;

  const sampleHerbs = [
    { name: 'Triphala (त्रिफला)', texts: 'Charaka Samhita Chikitsasthana 1:2, API Vol I', status: 'Documented classical formulation with widespread public prior art.' },
    { name: 'Ashwagandha (Withania somnifera)', texts: 'Charaka Samhita Sutrasthana 4, Bhavaprakasha', status: 'Extensively cataloged in TKDL with over 200 codified formulation entries.' },
    { name: 'Turmeric (Curcuma longa)', texts: 'Charaka Samhita Sutrasthana 2, API Part I Vol I', status: 'Landmark USPTO patent cancellation case (No. 5,401,504 revoked in 1997 due to CSIR prior art).' },
    { name: 'Neem (Azadirachta indica)', texts: 'Sushruta Samhita Sutrasthana 46, API Part I', status: 'Landmark EPO patent revocation (EP 0436257 B1 revoked in 2000 based on Indian traditional knowledge).' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-cyan-500/10 text-cyan-500 flex items-center justify-center flex-shrink-0">
              <BookMarked className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                TKDL & Classical Texts Prior-Art Pointer
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Identify defensive prior-art references across Charaka, Sushruta & API
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white flex-shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {/* Statutory Alert */}
          <div className="p-3.5 rounded-xl bg-cyan-50/50 dark:bg-cyan-950/20 border border-cyan-500/30 flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-cyan-500 flex-shrink-0 mt-0.5" />
            <p className="text-slate-700 dark:text-slate-300 leading-relaxed text-[11.5px]">
              <strong>Section 3(p) Patents Act 1970</strong> bars patenting of traditional knowledge. TKDL access agreements exist with USPTO, EPO, JPO, and WIPO allowing patent examiners to cite classical Indian treatises as defensive prior art against misappropriation.
            </p>
          </div>

          {/* Live prior-art lookup.
              queryHerb previously had no input bound to it, so the panel could
              only ever show the four fixed cards below. */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500">
              Check a herb or formulation
            </label>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const herb = queryHerb.trim();
                if (!herb) return;
                sendMessage(
                  `Is ${herb} documented as traditional knowledge in classical Ayurvedic texts, ` +
                  `and how does that affect whether a formulation based on it can be patented in India?`
                );
                setQueryHerb('');
                setActiveModal(null);
              }}
              className="flex items-center space-x-2"
            >
              <input
                type="text"
                value={queryHerb}
                onChange={(e) => setQueryHerb(e.target.value)}
                placeholder="e.g. Ashwagandha, Triphala, Guduchi"
                className="flex-1 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border p-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
              <button
                type="submit"
                disabled={!queryHerb.trim()}
                className="p-2 rounded-xl bg-cyan-600 hover:bg-cyan-500 disabled:opacity-40 disabled:hover:bg-cyan-600 text-white transition-all flex-shrink-0"
                aria-label="Check prior art"
              >
                <Search className="w-4 h-4" />
              </button>
            </form>
            <p className="text-[10.5px] text-slate-500 leading-relaxed">
              The answer is retrieved from the statutory corpus with citations, not from this panel.
            </p>
          </div>

          {/* Cataloged Reference Cards */}
          <div className="space-y-2">
            <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500">
              Landmark revocation precedents
            </label>
            {sampleHerbs.map((h, idx) => (
              <div
                key={idx}
                className="p-3 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border space-y-1"
              >
                <div className="flex items-center justify-between">
                  <h4 className="font-bold text-slate-900 dark:text-white text-xs">{h.name}</h4>
                  <span className="text-[10px] px-2 py-0.5 rounded bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 font-semibold">
                    Codified Prior Art
                  </span>
                </div>
                <div className="flex items-center space-x-1.5 text-[11px] text-slate-500">
                  <BookOpen className="w-3 h-3 text-cyan-500" />
                  <span>Classical Source: {h.texts}</span>
                </div>
                <p className="text-slate-600 dark:text-slate-400 text-[11px] leading-relaxed pt-1">
                  {h.status}
                </p>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              sendMessage('How does TKDL prevent patenting of traditional Ayurvedic formulations internationally?');
              setActiveModal(null);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-cyan-600 hover:bg-cyan-500 text-white font-bold text-xs shadow-md shadow-cyan-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>Ask AyuSakshi in Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
