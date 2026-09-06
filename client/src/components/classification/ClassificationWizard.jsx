import React, { useState, useEffect, useCallback } from 'react';
import { useChat } from '../../context/ChatContext';
import { formulationAPI } from '../../services/api';
import {
  FlaskConical,
  X,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  Scale,
  Dna,
  ArrowRight,
  ArrowLeft,
  RotateCcw,
  ListChecks,
  Info,
} from 'lucide-react';

/**
 * Rule-based formulation classification wizard.
 *
 * The user answers a short sequence of questions and lands in exactly one of six
 * regulatory categories. The decision is made by a deterministic decision tree on
 * the server, not by a language model, and the full decision path is shown so the
 * reasoning can be audited step by step.
 */
export const ClassificationWizard = () => {
  const { activeModal, setActiveModal, sendMessage } = useChat();

  const [answers, setAnswers] = useState([]);
  const [question, setQuestion] = useState(null);
  const [result, setResult] = useState(null);
  const [path, setPath] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const step = useCallback(async (nextAnswers) => {
    setLoading(true);
    setError(null);
    try {
      const res = await formulationAPI.wizardStep({ answers: nextAnswers });
      const r = res.data?.result;
      if (!r) throw new Error('Empty response from classification engine.');

      setPath(r.decision_path || []);
      if (r.complete) {
        setResult(r);
        setQuestion(null);
      } else {
        setQuestion(r.next_question);
        setResult(null);
      }
    } catch (err) {
      setError(
        err.response?.data?.error ||
          'The classification engine is unavailable. Please try again shortly.'
      );
    } finally {
      setLoading(false);
    }
  }, []);

  // Load the first question when the modal opens
  useEffect(() => {
    if (activeModal === 'classify' && !question && !result && !error) {
      setAnswers([]);
      step([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeModal]);

  if (activeModal !== 'classify') return null;

  const choose = (value) => {
    const next = [...answers, { node: question.id, value }];
    setAnswers(next);
    step(next);
  };

  const goBack = () => {
    const next = answers.slice(0, -1);
    setAnswers(next);
    step(next);
  };

  const restart = () => {
    setAnswers([]);
    setResult(null);
    setQuestion(null);
    setError(null);
    step([]);
  };

  const close = () => {
    setActiveModal(null);
    setAnswers([]);
    setResult(null);
    setQuestion(null);
    setError(null);
  };

  const askInChat = () => {
    if (!result) return;
    const trail = result.decision_path
      .map((s) => `${s.question} ${s.answer_label}`)
      .join(' ');
    sendMessage(
      `My product has been classified as: ${result.category}. ` +
        `The classification came from these answers: ${trail} ` +
        `What are my intellectual property options and what compliance obligations apply?`
    );
    close();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-black/60 backdrop-blur-sm animate-in fade-in">
      <div
        className="w-full max-w-2xl rounded-2xl bg-white dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border shadow-2xl overflow-hidden flex flex-col max-h-[92vh] sm:max-h-[90vh] animate-in zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-4 sm:px-5 py-3 sm:py-4 border-b border-slate-100 dark:border-darkbg-border flex items-center justify-between bg-slate-50/50 dark:bg-darkbg-950/50">
          <div className="flex items-center space-x-2.5 min-w-0">
            <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center flex-shrink-0">
              <FlaskConical className="w-4 h-4" />
            </div>
            <div className="min-w-0">
              <h3 className="text-sm font-bold text-slate-900 dark:text-white truncate">
                Formulation Classification
              </h3>
              <p className="text-[10.5px] sm:text-[11px] text-slate-500 truncate">
                Rule-based decision tree. Deterministic and auditable, not a model guess.
              </p>
            </div>
          </div>
          <button
            onClick={close}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 dark:hover:text-white flex-shrink-0"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Progress trail */}
        {path.length > 0 && (
          <div className="px-4 sm:px-5 py-2 border-b border-slate-100 dark:border-darkbg-border bg-white dark:bg-darkbg-card">
            <div className="flex flex-wrap gap-1.5">
              {path.map((s, i) => (
                <span
                  key={i}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-semibold"
                >
                  <CheckCircle2 className="w-2.5 h-2.5 mr-1" />
                  {s.answer_label.length > 38 ? `${s.answer_label.slice(0, 38)}...` : s.answer_label}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="p-3.5 sm:p-5 overflow-y-auto space-y-4 text-xs">
          {error && (
            <div className="p-3 rounded-xl bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-500/30 flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-[11.5px] text-red-700 dark:text-red-400">{error}</p>
                <button
                  onClick={restart}
                  className="mt-1.5 text-[11px] font-semibold text-red-700 dark:text-red-400 underline"
                >
                  Start over
                </button>
              </div>
            </div>
          )}

          {loading && !error && (
            <p className="text-slate-500 text-[11.5px] py-6 text-center">Evaluating decision rules...</p>
          )}

          {/* Question */}
          {!loading && question && !error && (
            <div className="space-y-3">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  Question {path.length + 1}
                </span>
                <h4 className="text-sm font-bold text-slate-900 dark:text-white mt-0.5 leading-snug">
                  {question.question}
                </h4>
              </div>

              {question.help && (
                <div className="flex items-start space-x-2 p-2.5 rounded-lg bg-slate-50 dark:bg-darkbg-950 border border-slate-100 dark:border-darkbg-border">
                  <Info className="w-3.5 h-3.5 text-slate-400 flex-shrink-0 mt-0.5" />
                  <p className="text-[11px] text-slate-600 dark:text-slate-400 leading-relaxed">
                    {question.help}
                  </p>
                </div>
              )}

              <div className="space-y-2">
                {question.options.map((opt) => (
                  <button
                    key={opt.value}
                    onClick={() => choose(opt.value)}
                    className="w-full text-left p-3 rounded-xl bg-white dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border hover:border-emerald-500 hover:bg-emerald-50/40 dark:hover:bg-emerald-950/20 transition-colors flex items-center justify-between group"
                  >
                    <span className="text-[12px] text-slate-800 dark:text-slate-200 pr-3">
                      {opt.label}
                    </span>
                    <ArrowRight className="w-3.5 h-3.5 text-slate-300 group-hover:text-emerald-500 flex-shrink-0" />
                  </button>
                ))}
              </div>

              {path.length > 0 && (
                <button
                  onClick={goBack}
                  className="flex items-center space-x-1.5 text-[11px] font-semibold text-slate-500 hover:text-slate-800 dark:hover:text-slate-200 pt-1"
                >
                  <ArrowLeft className="w-3 h-3" />
                  <span>Back</span>
                </button>
              )}
            </div>
          )}

          {/* Result */}
          {!loading && result && !error && (
            <div className="space-y-3.5 animate-in fade-in">
              <div className="p-3.5 rounded-xl bg-emerald-50/60 dark:bg-emerald-950/20 border border-emerald-500/30">
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
                  Regulatory Category
                </span>
                <h4 className="text-base font-extrabold text-slate-900 dark:text-white leading-tight">
                  {result.category}
                </h4>
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300 mt-1.5 leading-relaxed">
                  {result.summary}
                </p>
                <p className="text-[10px] text-emerald-700 dark:text-emerald-400 mt-2 font-semibold">
                  Determined by {result.questions_answered} rule
                  {result.questions_answered === 1 ? '' : 's'}, no model inference
                </p>
              </div>

              {result.caveats?.length > 0 &&
                result.caveats.map((c, i) => (
                  <div
                    key={i}
                    className="flex items-start space-x-2 p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/20 border border-amber-300/60 dark:border-amber-500/30"
                  >
                    <AlertCircle className="w-3.5 h-3.5 text-amber-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[11px] text-amber-800 dark:text-amber-300">{c}</p>
                  </div>
                ))}

              <Section icon={ListChecks} title="Regulatory pathway">
                <ul className="space-y-1">
                  {result.regulatory_pathway.map((r, i) => (
                    <li key={i} className="text-[11.5px] text-slate-700 dark:text-slate-300 flex">
                      <span className="text-emerald-500 mr-1.5">-</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </Section>

              <Section icon={Scale} title="Intellectual property posture">
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300">
                  <span className="font-semibold">Patentability. </span>
                  {result.ip_posture.patentability}
                </p>
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300 mt-1">
                  <span className="font-semibold">Trademark. </span>
                  {result.ip_posture.trademark}
                </p>
                <p className="text-[11.5px] text-emerald-700 dark:text-emerald-400 mt-1.5 font-semibold">
                  {result.ip_posture.primary_route}
                </p>
              </Section>

              <Section icon={Dna} title="Access and benefit sharing">
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300">{result.abs_posture}</p>
              </Section>

              <Section icon={ShieldCheck} title="Defensive route">
                <p className="text-[11.5px] text-slate-700 dark:text-slate-300">{result.defensive_route}</p>
              </Section>

              {/* Audit trail: the reason this is defensible to a regulator */}
              <details className="rounded-xl bg-slate-50 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border">
                <summary className="px-3 py-2.5 cursor-pointer text-[11px] font-bold uppercase tracking-wide text-slate-500 hover:text-slate-800 dark:hover:text-slate-200">
                  Decision path ({result.decision_path.length} steps)
                </summary>
                <div className="px-3 pb-3 space-y-2.5">
                  {result.decision_path.map((s, i) => (
                    <div key={i} className="border-l-2 border-emerald-500/40 pl-2.5">
                      <p className="text-[11px] text-slate-500 dark:text-slate-400">{s.question}</p>
                      <p className="text-[11.5px] font-semibold text-slate-800 dark:text-slate-200">
                        {s.answer_label}
                      </p>
                      {s.rule_applied && (
                        <p className="text-[10.5px] text-emerald-700 dark:text-emerald-400 mt-0.5 italic">
                          {s.rule_applied}
                        </p>
                      )}
                    </div>
                  ))}
                </div>
              </details>

              <p className="text-[10px] text-slate-400 leading-relaxed">{result.disclaimer}</p>

              <div className="flex items-center space-x-2 pt-1">
                <button
                  onClick={askInChat}
                  className="flex-1 py-2.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs flex items-center justify-center space-x-1.5 transition-colors"
                >
                  <span>Get cited guidance in chat</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={restart}
                  className="py-2.5 px-3 rounded-lg bg-slate-100 dark:bg-darkbg-950 border border-slate-200 dark:border-darkbg-border text-slate-700 dark:text-slate-300 font-semibold text-xs flex items-center space-x-1.5"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restart</span>
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

const Section = ({ icon: Icon, title, children }) => (
  <div>
    <div className="flex items-center space-x-1.5 mb-1">
      <Icon className="w-3.5 h-3.5 text-emerald-500" />
      <span className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{title}</span>
    </div>
    <div className="pl-5">{children}</div>
  </div>
);
