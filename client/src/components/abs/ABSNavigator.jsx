import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Dna, X, Info, ArrowRight } from 'lucide-react';

/**
 * Each scenario carries a plain-language description and the question that is
 * put to the RAG pipeline. Neither names a provision: the statutory basis is
 * whatever retrieval can evidence and citation verification can confirm.
 */
const SCENARIOS = {
  'registered_vaidya': {
    label: 'Exemption likely',
    summary:
      'A registered AYUSH practitioner or a local grower cultivating medicinal plants. The 2023 amendment created exemptions for this group, and the scope of that exemption is what needs establishing.',
    question:
      'I am a registered AYUSH practitioner and local cultivator of medicinal plants. Which access and benefit sharing obligations apply to me, and which exemptions can I rely on after the 2023 amendment?',
  },
  'filing_ip': {
    label: 'Approval required',
    summary:
      'Applying for a patent or other intellectual property right based on an Indian biological resource. Approval from the National Biodiversity Authority is engaged here, and the timing of that approval relative to filing and grant matters.',
    question:
      'I am filing a patent based on an Indian biological resource. Do I need National Biodiversity Authority approval, and at what stage of the application must it be obtained?',
  },
  'foreign_entity': {
    label: 'Approval required',
    summary:
      'A foreign entity, non-resident, or foreign-controlled company seeking access to an Indian biological resource. Prior approval obligations apply to this category and differ from those for Indian entities.',
    question:
      'I am a foreign company seeking to obtain Indian biological resources for commercial use. What prior approval must I obtain and from which authority?',
  },
  'indian_commercial': {
    label: 'Prior intimation required',
    summary:
      'An Indian company or startup using an Indian biological resource commercially. Indian entities give prior intimation to the State Biodiversity Board rather than seeking central approval, and benefit sharing obligations follow.',
    question:
      'I am an Indian company using Indian biological resources commercially. Must I give prior intimation to the State Biodiversity Board, and what benefit sharing obligations apply?',
  },
};

export const ABSNavigator = () => {
  const { activeModal, setActiveModal, sendMessage } = useChat();
  const [entityType, setEntityType] = useState('indian_commercial');
  const [activityType, setActivityType] = useState('commercial_utilization');

  // Filing for IP is the controlling fact regardless of who is filing, so it
  // takes precedence over entity type; otherwise entity type decides.
  const scenarioKey =
    entityType === 'registered_vaidya'
      ? 'registered_vaidya'
      : activityType === 'filing_ip'
        ? 'filing_ip'
        : entityType === 'foreign_entity'
          ? 'foreign_entity'
          : 'indian_commercial';

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
              <span className="px-2 py-0.5 rounded bg-teal-500/20 text-teal-700 dark:text-teal-300 text-[10px] font-bold uppercase">
                {SCENARIOS[scenarioKey].label}
              </span>
            </div>

            {/* Scenario summary.
                This panel deliberately names no section numbers. It used to
                assert them directly in the markup, which meant the one part of
                the product that shows statutory authority without passing
                through retrieval and citation verification was the part nobody
                could audit. The provisions now come back from the live pipeline
                with verified citations attached. */}
            <div className="space-y-2 text-[11.5px] text-slate-700 dark:text-slate-300 leading-relaxed">
              <p>{SCENARIOS[scenarioKey].summary}</p>
              <div className="flex items-start space-x-2 pt-1 text-slate-500 dark:text-slate-400">
                <Info className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                <span className="text-[11px]">
                  Run the assessment to retrieve the governing provisions from the
                  statutory corpus, each with its verbatim text and source link.
                </span>
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => {
              sendMessage(SCENARIOS[scenarioKey].question);
              setActiveModal(null);
            }}
            className="w-full py-2.5 px-4 rounded-xl bg-teal-600 hover:bg-teal-500 text-white font-bold text-xs shadow-md shadow-teal-600/20 transition-all flex items-center justify-center space-x-2"
          >
            <span>Run Assessment with Cited Sources</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
