import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { formulationAPI } from '../../services/api';
import {
  FlaskConical,
  X,
  Sparkles,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Scale,
  Dna,
  ArrowRight,
} from 'lucide-react';

export const ClassificationWizard = () => {
  const { activeModal, setActiveModal, sendMessage } = useChat();
  const [inputText, setInputText] = useState('');
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  if (activeModal !== 'classify') return null;

  const handleClassify = async (e) => {
    e.preventDefault();
    if (!inputText.trim()) return;

    setLoading(true);
    try {
      const res = await formulationAPI.classify({ text: inputText.trim() });
      if (res.data?.classification) {
        setResult(res.data.classification);
      }
    } catch (err) {
      console.error('[Classifier Wizard Error]', err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleAskInChat = () => {
    if (result) {
      sendMessage(`I want to explore the IP and regulatory roadmap for my ${result.category}: ${inputText}`);
      setActiveModal(null);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div>
              <h3 className="text-sm font-bold text-slate-900 dark:text-white">
                Ayurvedic Formulation Classifier
              </h3>
              <p className="text-[11px] text-slate-500">
                Determines regulatory category & IP posture across the 6 SIH26045 classes
              </p>
            </div>
          </div>
          <button
            onClick={() => setActiveModal(null)}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Content */}
        <div className="p-5 overflow-y-auto space-y-4 text-xs">
          {/* Preset Quick Tests */}
          <div>
            <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1.5">
              Quick Test Examples
            </label>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setInputText('Classical Triphala Churna prepared per Charaka Samhita Chikitsasthana recipes')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-[11px] text-slate-700 dark:text-slate-300 hover:border-emerald-500/50"
              >
                1. Classical Triphala
              </button>
              <button
                type="button"
                onClick={() => setInputText('Proprietary herbal anti-stress syrup combining Ashwagandha, Brahmi, and Shankhpushpi in a novel 4:2:1 ratio')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-[11px] text-slate-700 dark:text-slate-300 hover:border-emerald-500/50"
              >
                2. Proprietary Blend (P or P)
              </button>
              <button
                type="button"
                onClick={() => setInputText('Standardized purified fraction with 4 analytical markers extracted from Withania somnifera')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-[11px] text-slate-700 dark:text-slate-300 hover:border-emerald-500/50"
              >
                3. Phytopharmaceutical
              </button>
              <button
                type="button"
                onClick={() => setInputText('Ayurveda Aahara food health snack prepared with classical herbs conforming to FSSAI 2022')}
                className="px-2.5 py-1 rounded-lg bg-slate-100 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-[11px] text-slate-700 dark:text-slate-300 hover:border-emerald-500/50"
              >
                4. Ayurveda-Aahar
              </button>
            </div>
          </div>

          {/* Form */}
          <form onSubmit={handleClassify} className="space-y-3">
            <div>
              <label className="block text-[11px] font-bold uppercase text-slate-400 dark:text-slate-500 mb-1">
                Describe Formulation Ingredients, Processing & Intended Use
              </label>
              <textarea
                rows={3}
                required
                value={inputText}
                onChange={(e) => setInputText(e.target.value)}
                placeholder="e.g. A polyherbal formulation containing Ashwagandha and Turmeric standardized extract for joint mobility..."
                className="w-full rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border p-3 text-xs text-slate-800 dark:text-slate-100 focus:ring-1 focus:ring-emerald-500 focus:outline-none resize-none"
              />
            </div>

            <button
              type="submit"
              disabled={loading || !inputText.trim()}
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs shadow-md shadow-emerald-600/20 transition-all flex items-center justify-center space-x-2"
            >
              {loading ? (
                <span>Classifying against AYUSH Regulations...</span>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Run Regulatory Classification</span>
                </>
              )}
            </button>
          </form>

          {/* Classification Result Card */}
          {result && (
            <div className="mt-4 p-4 rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-emerald-500/30 space-y-3 animate-in fade-in">
              <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-darkbg-border">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
                    Identified Regulatory Category
                  </span>
                  <h4 className="text-sm font-extrabold text-slate-900 dark:text-white">
                    {result.category}
                  </h4>
                </div>
                <span className="px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-bold text-xs">
                  {(result.confidence * 100).toFixed(0)}% Confidence
                </span>
              </div>

              <p className="text-slate-600 dark:text-slate-300 leading-relaxed text-[11.5px]">
                {result.reasoning}
              </p>

              {/* IP Posture Breakdown */}
              {result.ip_posture && (
                <div className="space-y-1.5 pt-1">
                  <span className="text-[10px] font-bold uppercase text-slate-400">IP & Patentability Posture</span>
                  {result.ip_posture.patentability && (
                    <div className="flex items-start space-x-2 text-[11px] text-slate-700 dark:text-slate-300">
                      <Scale className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0 mt-0.5" />
                      <span>{result.ip_posture.patentability}</span>
                    </div>
                  )}
                  {result.ip_posture.trademark && (
                    <div className="flex items-start space-x-2 text-[11px] text-slate-700 dark:text-slate-300">
                      <ShieldCheck className="w-3.5 h-3.5 text-teal-500 flex-shrink-0 mt-0.5" />
                      <span>{result.ip_posture.trademark}</span>
                    </div>
                  )}
                </div>
              )}

              {/* Regulatory Pathway */}
              <div className="pt-2 border-t border-slate-200/60 dark:border-darkbg-border/60">
                <span className="text-[10px] font-bold uppercase text-slate-400 block mb-1">Licensing Pathway</span>
                <p className="text-slate-700 dark:text-slate-300 text-[11px]">{result.regulatory_pathway}</p>
              </div>

              <button
                type="button"
                onClick={handleAskInChat}
                className="w-full mt-2 py-2 px-3 rounded-lg bg-emerald-600/10 hover:bg-emerald-600/20 text-emerald-700 dark:text-emerald-400 font-semibold text-xs border border-emerald-500/30 flex items-center justify-center space-x-1.5 transition-colors"
              >
                <span>Continue In-Depth Chat Analysis</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
