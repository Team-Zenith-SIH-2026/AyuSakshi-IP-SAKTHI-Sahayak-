import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useLanguage } from '../../context/LanguageContext';
import { ArrowUp } from 'lucide-react';

// For someone who does not know what to ask, or how the law words it. They tap
// who they are, what they use and what they want to do; the question is written
// for them. The keys are mapped to a situation by the AI service
// (BUILDER_GOALS and BUILDER_FACTS in ai-service/app/agents/intent_catalogue.py)
// and must stay in step with it.
const GROUPS = [
  {
    key: 'who',
    label: 'I am',
    options: [
      { key: 'india_business', label: 'A business in India', text: 'I run a business in India.' },
      { key: 'practitioner', label: 'A vaid or practitioner', text: 'I am a vaid or Ayurvedic practitioner.' },
      { key: 'grower', label: 'A farmer or grower', text: 'I am a farmer or grower of medicinal plants.' },
      { key: 'foreign', label: 'A foreign company or NRI', text: 'I am a foreign company or an NRI.' },
      { key: 'researcher', label: 'A researcher', text: 'I am a researcher.' },
    ],
  },
  {
    key: 'uses',
    label: 'I use',
    options: [
      { key: 'plants', label: 'Indian plants or herbs', text: 'I use Indian plants or herbs.' },
      { key: 'classical', label: 'A recipe from a classical text', text: 'My product follows a recipe from a classical Ayurvedic text.' },
      { key: 'own_mix', label: 'My own mix of herbs', text: 'My product is my own mix of herbs.' },
      { key: 'extract', label: 'A plant extract', text: 'My product is a standardised plant extract.' },
    ],
  },
  {
    key: 'goal',
    label: 'I want to',
    options: [
      { key: 'sell', label: 'Sell products made from plants', text: 'I want to sell products made from these plants.' },
      { key: 'medicine', label: 'Get a licence to make medicine', text: 'I want a licence to make and sell it as a medicine.' },
      { key: 'food', label: 'Sell it as a food or supplement', text: 'I want to sell it as a food or health supplement.' },
      { key: 'patent', label: 'Get a patent', text: 'I want to get a patent on it.' },
      { key: 'patent_permission', label: 'Know permissions before patenting', text: 'I want to know what permissions I need before patenting it.' },
      { key: 'extract_drug', label: 'Register an extract as a drug', text: 'I want to register my plant extract as a drug.' },
      { key: 'brand', label: 'Protect my brand name', text: 'I want to protect my brand name.' },
      { key: 'advertise', label: 'Advertise what it treats', text: 'I want to advertise it and say what it treats.' },
      { key: 'gi', label: 'Get a GI tag for my region', text: 'I want a GI tag for a product from my region.' },
      { key: 'research', label: 'Share research with foreigners', text: 'I want to share my research with a foreign organisation.' },
      { key: 'stop_patent', label: "Stop someone else's patent", text: 'I want to stop someone patenting our traditional knowledge.' },
    ],
  },
];

export const composeQuestion = (picked) => {
  const parts = GROUPS.map((g) => g.options.find((o) => o.key === picked[g.key])?.text).filter(Boolean);
  return parts.length ? `${parts.join(' ')} What rules apply to me?` : '';
};

export const SituationBuilder = ({ onSent, compact = false }) => {
  const { sendMessage, isLoading } = useChat();
  const { t, language } = useLanguage();
  const [picked, setPicked] = useState({});

  const toggle = (group, key) =>
    setPicked((prev) => ({ ...prev, [group]: prev[group] === key ? undefined : key }));

  const question = composeQuestion(picked);
  const canAsk = Boolean(picked.goal) && !isLoading;

  const ask = () => {
    if (!canAsk) return;
    const situation = Object.fromEntries(Object.entries(picked).filter(([, v]) => v));
    sendMessage(question, language, { situation });
    setPicked({});
    onSent?.();
  };

  return (
    <div className={compact ? 'space-y-3' : 'space-y-4'}>
      {GROUPS.map((group) => (
        <div key={group.key}>
          <p className="mb-1.5 px-0.5 text-[11px] font-medium uppercase tracking-wider text-slate-400 dark:text-slate-500">
            {group.key === 'who' ? t('situation.iam') : group.key === 'uses' ? t('situation.iuse') : t('situation.iwant')}
            {group.key === 'goal' ? '' : ` ${t('situation.optional')}`}
          </p>
          <div className="flex flex-wrap gap-1.5">
            {group.options.map((option) => {
              const active = picked[group.key] === option.key;
              return (
                <button
                  key={option.key}
                  type="button"
                  onClick={() => toggle(group.key, option.key)}
                  aria-pressed={active}
                  className={`rounded-full border px-3 py-1.5 text-[12.5px] transition-colors ${
                    active
                      ? 'border-emerald-700 bg-emerald-700 text-white dark:border-emerald-500 dark:bg-emerald-600'
                      : 'border-emerald-900/[0.1] bg-white/70 text-slate-700 hover:border-emerald-600/30 hover:bg-white dark:border-white/[0.09] dark:bg-white/[0.03] dark:text-slate-300 dark:hover:border-emerald-400/25'
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </div>
      ))}

      <div className="flex items-end gap-3 rounded-xl border border-emerald-900/[0.07] bg-white/60 px-3.5 py-2.5 dark:border-white/[0.07] dark:bg-white/[0.02]">
        <p className="min-w-0 flex-1 text-[13px] leading-relaxed text-slate-500 dark:text-slate-400">
          {question ? (
            <>
              <span className="text-slate-400 dark:text-slate-500">Your question: </span>
              <span className="text-slate-700 dark:text-slate-200">{question}</span>
            </>
          ) : (
            t('situation.choose_prompt')
          )}
        </p>
        <button
          type="button"
          onClick={ask}
          disabled={!canAsk}
          aria-label="Ask this question"
          className={`flex-shrink-0 rounded-full p-2 transition-all ${
            canAsk
              ? 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500'
              : 'bg-slate-100 text-slate-300 dark:bg-white/[0.06] dark:text-slate-600'
          }`}
        >
          <ArrowUp className="h-4 w-4" strokeWidth={2} />
        </button>
      </div>
    </div>
  );
};
