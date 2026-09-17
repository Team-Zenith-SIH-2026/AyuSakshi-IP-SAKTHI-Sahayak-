import React, { useEffect, useRef } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
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
  const scrollRef = useRef(null);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  const tryAskingPills = [
    {
      label: 'Can I patent my Ayurvedic formulation?',
      query: 'Can I patent my Ayurvedic formulation under Indian Patent law? What are the Section 3(p) restrictions?',
    },
    {
      label: 'What is ABS?',
      query: 'What is Access and Benefit Sharing (ABS) under the Biological Diversity Act, and when is NBA approval required?',
    },
    {
      label: 'Check TK prior art',
      query: 'How does Traditional Knowledge Digital Library (TKDL) prior art impact Ayurvedic patent applications?',
    },
    {
      label: 'GI for herbal products',
      query: 'What is Geographical Indication (GI) protection for herbal and Ayurvedic products, and how is it obtained?',
    },
  ];

  const serviceCards = [
    {
      title: 'Product Classification',
      desc: 'Know your formulation type and IP path',
      icon: FlaskConical,
      color: 'green',
      action: () => setActiveModal('classify'),
      bgLight: 'bg-[#eef8f2] border-emerald-300/60',
      bgDark: 'dark:bg-[#102d24] dark:border-emerald-600/30',
      iconBgLight: 'bg-emerald-100 text-emerald-700',
      iconBgDark: 'dark:bg-emerald-500/20 dark:text-emerald-300',
    },
    {
      title: 'IPR Guidance',
      desc: 'Patents, Trademarks, GI, Copyright & more',
      icon: Shield,
      color: 'purple',
      action: () =>
        sendMessage(
          'What are the key IPR protections (patents, trademarks, GI, copyrights) available for Ayurvedic medicines and innovations?'
        ),
      bgLight: 'bg-[#f7f2fc] border-purple-200/80',
      bgDark: 'dark:bg-[#201633] dark:border-purple-700/30',
      iconBgLight: 'bg-purple-100 text-purple-700',
      iconBgDark: 'dark:bg-purple-500/20 dark:text-purple-300',
    },
    {
      title: 'ABS & Biodiversity',
      desc: 'Check compliance with bioresource laws',
      icon: Leaf,
      color: 'amber',
      action: () => setActiveModal('abs'),
      bgLight: 'bg-[#fef8ef] border-amber-200/80',
      bgDark: 'dark:bg-[#2c1e11] dark:border-amber-700/30',
      iconBgLight: 'bg-amber-100 text-amber-700',
      iconBgDark: 'dark:bg-amber-500/20 dark:text-amber-300',
    },
    {
      title: 'TK / Prior Art',
      desc: 'Avoid misappropriation and prior art risks',
      icon: Database,
      color: 'blue',
      action: () => setActiveModal('tkdl'),
      bgLight: 'bg-[#f0f7fd] border-sky-200/80',
      bgDark: 'dark:bg-[#0e2333] dark:border-sky-700/30',
      iconBgLight: 'bg-sky-100 text-sky-700',
      iconBgDark: 'dark:bg-sky-500/20 dark:text-sky-300',
    },
    {
      title: 'International',
      desc: 'Global IP and market access guidance',
      icon: Globe,
      color: 'pink',
      action: () => {
        setInternational();
        sendMessage(
          'What are the key international regulatory and IP requirements under WIPO, Nagoya Protocol, and TRIPS for Ayurvedic exports?'
        );
      },
      bgLight: 'bg-[#fdf2f5] border-rose-200/80',
      bgDark: 'dark:bg-[#2f1322] dark:border-rose-700/30',
      iconBgLight: 'bg-rose-100 text-rose-700',
      iconBgDark: 'dark:bg-rose-500/20 dark:text-rose-300',
    },
  ];

  return (
    <div className="w-full flex-1 overflow-y-auto px-4 py-6 sm:px-6 sm:py-8">
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
                <p className="text-sm sm:text-base font-semibold text-slate-600 dark:text-slate-300">
                  Welcome to
                </p>
                <h1 className="mt-0.5 text-2xl sm:text-3xl lg:text-4xl font-extrabold tracking-tight text-[#0d3f32] dark:text-[#3dbb8f]">
                  IP-SAKTI Sahayak
                </h1>
                <p className="mt-2 text-[13.5px] sm:text-[15px] leading-relaxed text-slate-600 dark:text-slate-300 max-w-2xl">
                  Your multilingual, RAG-based AI assistant for Intellectual Property and regulatory
                  guidance in Ayurveda.
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
                Try asking:
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
                    Or describe your situation
                  </p>
                  <p className="mt-1 text-[13px] text-slate-500 dark:text-slate-400">
                    Not sure what to ask? Tap what fits you and we will write the question.
                  </p>
                </div>
                <SituationBuilder />
              </div>
            )}

            {/* "Explore Key Services" Section */}
            <div className="w-full mt-6 text-left">
              <h2 className="text-base sm:text-lg font-bold text-slate-800 dark:text-slate-100 mb-3.5">
                Explore Key Services
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
