import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Dna, X, ShieldCheck, FileCheck, Info, ArrowRight } from 'lucide-react';

export const ABSNavigator = () => {
  const { activeModal, setActiveModal, sendMessage } = useChat();
  const [entityType, setEntityType] = useState('indian_commercial');
  const [activityType, setActivityType] = useState('commercial_utilization');
  const [hasIndianBioResource, setHasIndianBioResource] = useState(true);

  if (activeModal !== 'abs') return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-teal-500/10 text-teal-500 flex items-center justify-center flex-shrink-0">
              <Dna className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                ABS Compliance Navigator (NBA & SBB)
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Biological Diversity Act 2002/2023 & Nagoya Protocol Guidance
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
          {/* Controls */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">
                Entity Status
              </label>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border p-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="indian_commercial">Indian MSME / Startup (Commercial Entity)</option>
                <option value="foreign_entity">Foreign Entity / NRI / Multinational Co.</option>
                <option value="registered_vaidya">Registered AYUSH Practitioner / Local Grower</option>
              </select>
            </div>

            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">
                Intended Activity
              </label>
              <select
                value={activityType}
                onChange={(e) => setActivityType(e.target.value)}
                className="w-full rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border p-2 text-xs text-slate-800 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-teal-500"
              >
                <option value="commercial_utilization">Commercial Manufacturing & Utilization</option>
                <option value="filing_ip">Filing Patent / Intellectual Property Rights</option>
                <option value="research_export">Academic Research & Export of Samples</option>
              </select>
            </div>
          </div>

          {/* Compliance Matrix Result */}
          <div className="p-4 rounded-xl bg-teal-50/50 dark:bg-teal-950/20 border border-teal-500/30 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-teal-900 dark:text-teal-300">
                Statutory Assessment Summary
              </span>
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold">
                {entityType === 'registered_vaidya' ? 'EXEMPTION APPLICABLE' : 'MANDATORY COMPLIANCE'}
              </span>
            </div>

            {/* Matrix Logic */}
            {entityType === 'registered_vaidya' ? (
              <div className="space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  ✅ <strong>2023 Amendment Exemption:</strong> Under the Biological Diversity (Amendment) Act 2023, registered AYUSH practitioners (Vaidyas and Hakims) and local growers who cultivate medicinal plants are exempt from paying Access and Benefit Sharing (ABS) fees.
                </p>
                <p>
                  • Must maintain local source records to prove non-commercial biopiracy origin.
                </p>
              </div>
            ) : activityType === 'filing_ip' ? (
              <div className="space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  ⚠️ <strong>Section 6(1) Mandatory NBA Approval:</strong> You must obtain prior approval from the National Biodiversity Authority (NBA) before the grant of any patent or intellectual property right inside or outside India based on Indian biological resources.
                </p>
                <div className="flex items-center space-x-2 font-semibold text-teal-800 dark:text-teal-300">
                  <FileCheck className="w-4 h-4 text-teal-500" />
                  <span>Required Form: NBA Form III (Application for IP approval under BDA)</span>
                </div>
              </div>
            ) : entityType === 'foreign_entity' ? (
              <div className="space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  ⚠️ <strong>Section 3(1) NBA Clearance:</strong> Non-Indian entities, NRIs, and foreign-controlled firms require mandatory prior approval from NBA via <strong>Form I</strong> before obtaining any biological resource in India.
                </p>
              </div>
            ) : (
              <div className="space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
                <p>
                  📋 <strong>Section 7 Prior Intimation:</strong> Indian commercial manufacturers must file <strong>Form A</strong> with their respective State Biodiversity Board (SBB).
                </p>
                <p>
                  • Benefit sharing levy: 0.1% to 0.5% of annual ex-factory gross sales or mutually agreed percentage.
                </p>
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={() => {
              sendMessage(`What are the step-by-step ABS requirements for my entity (${entityType}) when ${activityType}?`);
              setActiveModal(null);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>Ask AyuSakshi in Conversation</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
