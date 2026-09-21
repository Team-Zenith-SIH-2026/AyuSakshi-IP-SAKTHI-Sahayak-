import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useLanguage } from '../../context/LanguageContext';
import { MessageItem } from './MessageItem';
import { QuickActionBar } from './QuickActionBar';
import { SituationBuilder } from './SituationBuilder';
import { LeafMark } from '../layout/LeafMark';
import {
  FlaskConical,
  Shield,
  Leaf,
  Database,
  Globe,
} from 'lucide-react';

export const ChatArea = () => {
  const { messages, isLoading, sendMessage, setActiveModal } = useChat();
  const { setInternational, isIndia } = useJurisdiction();
  const { t } = useLanguage();
  const scrollRef = useRef(null);
  const containerRef = useRef(null);

  useEffect(() => {
    if (messages && messages.length > 0) {
      scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
    } else {
      if (containerRef.current) {
        containerRef.current.scrollTop = 0;
      }
    }
  }, [messages, isLoading]);

  const tryAskingPills = isIndia
    ? [
        { label: t('pills.patentability'), query: t('pills.patentability') },
        { label: t('pills.abs'), query: t('pills.abs') },
        { label: t('pills.trademark'), query: t('pills.trademark') },
        { label: t('pills.advertisement'), query: t('pills.advertisement') },
      ]
    : [
        { label: t('pills.intl_gratk'), query: t('pills.intl_gratk') },
        { label: t('pills.intl_trips_plants'), query: t('pills.intl_trips_plants') },
        { label: t('pills.intl_nagoya'), query: t('pills.intl_nagoya') },
        { label: t('pills.intl_trips_gi'), query: t('pills.intl_trips_gi') },
      ];

  const serviceCards = [
    {
      title: t('services.classify.title'),
      desc: t('services.classify.desc'),
      icon: FlaskConical,
      color: 'green',
      action: () => setActiveModal('classify'),
      bgLight: 'bg-[#eef8f2] border-emerald-300/60',
      bgDark: 'dark:bg-[#102d24] dark:border-emerald-600/30',
      iconBgLight: 'bg-emerald-100 text-emerald-700',
      iconBgDark: 'dark:bg-emerald-500/20 dark:text-emerald-300',
    },
    {
      title: t('services.ipr.title'),
      desc: t('services.ipr.desc'),
      icon: Shield,
      color: 'purple',
      // Asked as one broad sweep over four regimes at once, this found no single
      // provision to cite and was refused. Narrowed to what the statutes we hold
      // can actually answer.
      action: () =>
        sendMessage(
          'Which protections can I use for my Ayurvedic product: a patent, a trademark, or a geographical indication?'
        ),
      bgLight: 'bg-[#f7f2fc] border-purple-200/80',
      bgDark: 'dark:bg-[#201633] dark:border-purple-700/30',
      iconBgLight: 'bg-purple-100 text-purple-700',
      iconBgDark: 'dark:bg-purple-500/20 dark:text-purple-300',
    },
    {
      title: t('services.abs.title'),
      desc: t('services.abs.desc'),
      icon: Leaf,
      color: 'amber',
      action: () => setActiveModal('abs'),
      bgLight: 'bg-[#fef8ef] border-amber-200/80',
      bgDark: 'dark:bg-[#2c1e11] dark:border-amber-700/30',
      iconBgLight: 'bg-amber-100 text-amber-700',
      iconBgDark: 'dark:bg-amber-500/20 dark:text-amber-300',
    },
    {
      title: t('services.tkdl.title'),
      desc: t('services.tkdl.desc'),
      icon: Database,
      color: 'blue',
      action: () => setActiveModal('tkdl'),
      bgLight: 'bg-[#f0f7fd] border-sky-200/80',
      bgDark: 'dark:bg-[#0e2333] dark:border-sky-700/30',
      iconBgLight: 'bg-sky-100 text-sky-700',
      iconBgDark: 'dark:bg-sky-500/20 dark:text-sky-300',
    },
    {
      title: t('services.intl.title'),
      desc: t('services.intl.desc'),
      icon: Globe,
      color: 'pink',
      // The regime switch above has not re-rendered yet, so this message has to
      // carry the new regime itself; without that it was answered from the
      // Indian corpus. The question is one the international corpus can cite.
      action: () => {
        setInternational();
        sendMessage(
          'Is prior informed consent required to access genetic resources under the Nagoya Protocol?',
          null,
          { jurisdiction: 'international', newConversation: true }
        );
      },
      bgLight: 'bg-[#fdf2f5] border-rose-200/80',
      bgDark: 'dark:bg-[#2f1322] dark:border-rose-700/30',
      iconBgLight: 'bg-rose-100 text-rose-700',
      iconBgDark: 'dark:bg-rose-500/20 dark:text-rose-300',
    },
  ];

  return (
    <div ref={containerRef} className="w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
      <div className="mx-auto w-full max-w-4xl">
        {messages.length === 0 ? (
          /* =======================================================
             LANDING STATE (messages.length === 0)
             Hero -> Chat input -> Try asking pills -> Explore Key Services
             ======================================================= */
          <div className="animate-in fade-in flex flex-col items-center duration-300 text-center sm:text-left">
            {/* Hero Section */}
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 pt-4 sm:pt-10 pb-6 w-full">
              <div className="flex h-16 w-16 sm:h-20 sm:w-20 flex-shrink-0 items-center justify-center rounded-2xl bg-emerald-50 text-emerald-700 ring-1 ring-emerald-600/15 shadow-sm dark:bg-emerald-500/15 dark:text-emerald-300 dark:ring-emerald-400/20">
                <LeafMark className="h-10 w-10 sm:h-12 sm:w-12" />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-center sm:justify-start gap-2 mb-1.5">
                  <span className={`inline-flex items-center gap-1.5 px-3 py-0.5 rounded-full text-[11.5px] font-semibold tracking-wide shadow-xs ${
                    isIndia
                      ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-300/60 dark:border-emerald-700/40'
                      : 'bg-sky-100 text-sky-800 dark:bg-sky-950/70 dark:text-sky-300 border border-sky-300/60 dark:border-sky-700/40'
                  }`}>
                    {isIndia ? '🇮🇳 ' + (t('chat.regime_india') || 'Indian Law Regime') : '🌐 ' + (t('chat.regime_intl') || 'International Law Regime')}
                  </span>
                </div>
                <p className="text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300">
                  {t('chat.welcome')}
                </p>
                <h1 className="mt-0.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0d3f32] dark:text-[#3dbb8f]">
                  {t('app.title')}
                </h1>
                <p className="mt-2 text-[13.5px] sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
                  {isIndia
                    ? (t('chat.hero_desc_india') || t('chat.hero_desc'))
                    : (t('chat.hero_desc_intl') || t('chat.hero_desc'))}
                </p>
              </div>
            </div>

            {/* Centered Landing Chat Input */}
            <div className="w-full my-4">
              <QuickActionBar />
            </div>

            {/* "Try asking:" Section */}
            <div className="w-full my-4 flex flex-wrap items-center gap-2">
              <span className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400 mr-1">
                {t('chat.quickPillsTitle')}
              </span>
              {tryAskingPills.map((pill, idx) => (
                <button
                  key={idx}
                  onClick={() => sendMessage(pill.query)}
                  className="rounded-full border border-emerald-900/[0.08] bg-white/85 px-3.5 py-1.5 text-[12.5px] font-medium text-slate-700 shadow-sm backdrop-blur-sm transition-all hover:border-emerald-600/40 hover:bg-emerald-50 hover:text-emerald-900 dark:border-emerald-700/30 dark:bg-[#0c241c]/80 dark:text-slate-200 dark:hover:border-emerald-500/40 dark:hover:bg-emerald-950/40 dark:hover:text-emerald-200"
                >
                  {pill.label}
                </button>
              ))}
            </div>

            {/* For someone who does not know how to put the question. India only:
                the situations it maps to are Indian law. */}
            {isIndia && (
              <div className="w-full my-4 space-y-3 text-left">
                <div className="px-1">
                  <p className="text-[12.5px] font-semibold text-slate-500 dark:text-slate-400">
                    {t('situation.title')}
                  </p>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                    {t('situation.subtitle')}
                  </p>
                </div>
                <SituationBuilder />
              </div>
            )}

            {/* "Explore Key Services" Section */}
            <div className="w-full mt-6 text-left">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3.5">
                {t('services.title')}
              </h2>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
                {serviceCards.map((service, idx) => {
                  const Icon = service.icon;
                  return (
                    <button
                      key={idx}
                      onClick={service.action}
                      className={`group flex flex-col justify-between rounded-2xl border p-3.5 text-left transition-all hover:shadow-md hover:-translate-y-0.5 ${service.bgLight} ${service.bgDark}`}
                    >
                      <div className="flex items-center gap-2.5 mb-2.5">
                        <div
                          className={`flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-105 ${service.iconBgLight} ${service.iconBgDark}`}
                        >
                          <Icon className="h-4 w-4" />
                        </div>
                      </div>
                      <div>
                        <h3 className="text-[13px] font-bold text-slate-900 dark:text-white leading-snug">
                          {service.title}
                        </h3>
                        <p className="mt-1 text-[11px] leading-relaxed text-slate-500 dark:text-slate-400">
                          {service.desc}
                        </p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        ) : (
          /* =======================================================
             CHAT STATE (messages.length > 0)
             Landing feature cards disappear completely (Rule 14).
             Chat area expands and displays full conversation.
             ======================================================= */
          <div className="w-full space-y-5">
            <div className="flex items-center justify-between pb-2 mb-1 border-b border-slate-200/60 dark:border-emerald-900/30 text-xs">
              <span className="flex items-center gap-1.5 font-medium">
                {isIndia ? (
                  <>
                    <span className="text-sm">🇮🇳</span>
                    <span className="text-emerald-700 dark:text-emerald-400 font-semibold">{t('chat.regime_india') || 'Indian Law Regime'}</span>
                    <span className="hidden sm:inline text-slate-400 dark:text-slate-500">• {t('chat.regime_india_sub')}</span>
                  </>
                ) : (
                  <>
                    <Globe className="h-3.5 w-3.5 text-sky-600 dark:text-sky-400" />
                    <span className="text-sky-700 dark:text-sky-400 font-semibold">{t('chat.regime_intl') || 'International Law Regime'}</span>
                    <span className="hidden sm:inline text-slate-400 dark:text-slate-500">• {t('chat.regime_intl_sub')}</span>
                  </>
                )}
              </span>
            </div>

            {messages.map((msg, index) => (
              <MessageItem key={msg.id || index} message={msg} isLatest={index === messages.length - 1} />
            ))}

            {isLoading && (
              <div className="flex items-start gap-3">
                <span className="mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300">
                  <LeafMark className="h-4 w-4" />
                </span>
                <div className="flex-1 space-y-2.5 pt-1.5">
                  <div className="h-2.5 w-32 animate-pulse rounded-full bg-slate-200/80 dark:bg-white/[0.07]" />
                  <div className="h-2.5 w-full animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.04]" />
                  <div className="h-2.5 w-4/5 animate-pulse rounded-full bg-slate-100 dark:bg-white/[0.04]" />
                </div>
              </div>
            )}
          </div>
        )}
        <div ref={scrollRef} />
      </div>
    </div>
  );
};
