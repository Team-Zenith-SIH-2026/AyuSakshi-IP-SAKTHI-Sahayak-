import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { SituationBuilder } from './SituationBuilder';
import { ArrowUp, Mic, MicOff, SlidersHorizontal, X } from 'lucide-react';

export const QuickActionBar = () => {
  const { sendMessage, isLoading, messages } = useChat();
  const { isIndia } = useJurisdiction();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  // The welcome screen shows the situation picker already; once a conversation
  // has started it is opened from here.
  const [showBuilder, setShowBuilder] = useState(false);
  const builderAvailable = isIndia && messages.length > 0;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim());
    setInput('');
  };

  const handleKeyDown = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit();
    }
  };

  const toggleVoice = () => {
    if (!isListening) {
      setIsListening(true);
      if ('webkitSpeechRecognition' in window || 'SpeechRecognition' in window) {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        const recognition = new SpeechRecognition();
        recognition.lang = 'en-IN';
        recognition.onresult = (event) => {
          const transcript = event.results[0][0].transcript;
          setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
          setIsListening(false);
        };
        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognition.start();
      } else {
        setIsListening(false);
      }
    } else {
      setIsListening(false);
    }
  };

  const canSend = input.trim() && !isLoading;

  return (
    <div className="w-full px-4 pb-4 sm:px-6 sm:pb-5">
      <div className="mx-auto w-full max-w-3xl">
        {builderAvailable && showBuilder && (
          <div className="mb-2.5 max-h-[55vh] overflow-y-auto rounded-2xl border border-emerald-900/[0.09] bg-white/95 p-3.5 shadow-sm backdrop-blur-xl dark:border-white/[0.09] dark:bg-slate-900/95">
            <div className="mb-2.5 flex items-center justify-between px-0.5">
              <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Describe your situation</p>
              <button
                type="button"
                onClick={() => setShowBuilder(false)}
                aria-label="Close"
                className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </div>
            <SituationBuilder compact onSent={() => setShowBuilder(false)} />
          </div>
        )}
        <form
          onSubmit={handleSubmit}
          className="relative flex items-end gap-2 rounded-[20px] border border-emerald-900/[0.09] bg-white/85 py-2 pl-4 pr-2 shadow-sm shadow-emerald-950/[0.03] backdrop-blur-xl transition-colors focus-within:border-emerald-600/30 dark:border-white/[0.09] dark:bg-white/[0.04] dark:shadow-none dark:focus-within:border-emerald-400/25"
        >
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about your product, a licence, or a section of the law..."
            rows={1}
            className="max-h-40 min-h-[2.25rem] w-full flex-1 resize-none self-center bg-transparent py-1.5 text-[14.5px] leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
          />

          <div className="flex flex-shrink-0 items-center gap-1 pb-0.5">
            {builderAvailable && (
              <button
                type="button"
                onClick={() => setShowBuilder((open) => !open)}
                title="Describe your situation instead of typing"
                aria-label="Describe your situation"
                aria-expanded={showBuilder}
                className={`rounded-full p-2 transition-colors ${
                  showBuilder
                    ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-300'
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" strokeWidth={1.75} />
              </button>
            )}
            <button
              type="button"
              onClick={toggleVoice}
              title={isListening ? 'Listening' : 'Speak your question'}
              className={`rounded-full p-2 transition-colors ${
                isListening
                  ? 'bg-rose-500 text-white'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" strokeWidth={1.75} /> : <Mic className="h-4 w-4" strokeWidth={1.75} />}
            </button>

            <button
              type="submit"
              disabled={!canSend}
              aria-label="Send"
              className={`rounded-full p-2 transition-all ${
                canSend
                  ? 'bg-emerald-700 text-white hover:bg-emerald-800 active:scale-95 dark:bg-emerald-600 dark:hover:bg-emerald-500'
                  : 'bg-slate-100 text-slate-300 dark:bg-white/[0.06] dark:text-slate-600'
              }`}
            >
              <ArrowUp className="h-4 w-4" strokeWidth={2} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
