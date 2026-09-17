import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { useJurisdiction } from '../../context/JurisdictionContext';
import { useLanguage } from '../../context/LanguageContext';
import { SituationBuilder } from './SituationBuilder';
import { Send, Mic, MicOff, Paperclip, SlidersHorizontal, X } from 'lucide-react';

export const QuickActionBar = ({ className = '' }) => {
  const { sendMessage, isLoading, setActiveModal, messages } = useChat();
  const { isIndia } = useJurisdiction();
  const { language, currentLanguage, t } = useLanguage();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);
  // The landing screen shows the situation picker already; once a conversation
  // has started it is opened from here.
  const [showBuilder, setShowBuilder] = useState(false);
  const builderAvailable = isIndia && messages.length > 0;

  const handleSubmit = (e) => {
    e?.preventDefault();
    if (!input.trim() || isLoading) return;
    sendMessage(input.trim(), language);
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
        recognition.lang = currentLanguage?.bcp47 || 'en-IN';
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
    <div className={`w-full ${className}`}>
      {builderAvailable && showBuilder && (
        <div className="mb-2.5 max-h-[55vh] overflow-y-auto rounded-2xl border border-emerald-900/[0.12] bg-white/95 p-3.5 shadow-md backdrop-blur-md dark:border-emerald-700/30 dark:bg-[#0c241c]/95">
          <div className="mb-2.5 flex items-center justify-between px-0.5">
            <p className="text-[13px] font-medium text-slate-700 dark:text-slate-200">Describe your situation</p>
            <button
              type="button"
              onClick={() => setShowBuilder(false)}
              aria-label="Close"
              className="rounded-full p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-white/5 dark:hover:text-slate-300"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <SituationBuilder compact onSent={() => setShowBuilder(false)} />
        </div>
      )}
      <form
        onSubmit={handleSubmit}
        className="relative flex flex-col rounded-2xl border border-emerald-900/[0.12] bg-white/95 p-3 shadow-md shadow-emerald-950/[0.04] backdrop-blur-md transition-colors focus-within:border-emerald-600/40 dark:border-emerald-700/30 dark:bg-[#0c241c]/95 dark:shadow-black/20 dark:focus-within:border-emerald-400/40"
      >
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={isIndia ? (t('chat.placeholder_india') || t('chat.placeholder')) : (t('chat.placeholder_intl') || t('chat.placeholder'))}
          rows={2}
          className="w-full resize-none bg-transparent px-1 py-1 text-[14.5px] leading-relaxed text-slate-800 placeholder-slate-400 focus:outline-none dark:text-slate-100 dark:placeholder-slate-500"
        />

        {/* Bottom controls row */}
        <div className="mt-2 flex items-center justify-between pt-1">
          {/* Left tools: Paperclip & Mic */}
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setActiveModal('classify')}
              title="Attach product details for classification"
              className="rounded-full p-2 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200"
            >
              <Paperclip className="h-4 w-4" />
            </button>

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
                    : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
                }`}
              >
                <SlidersHorizontal className="h-4 w-4" />
              </button>
            )}

            <button
              type="button"
              onClick={toggleVoice}
              title={isListening ? 'Listening... Speak now' : 'Speak your question'}
              className={`rounded-full p-2 transition-colors ${
                isListening
                  ? 'bg-rose-500 text-white animate-pulse'
                  : 'text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-400 dark:hover:bg-white/5 dark:hover:text-slate-200'
              }`}
            >
              {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            </button>
          </div>

          {/* Right tool: Send Button */}
          <button
            type="submit"
            disabled={!canSend}
            aria-label="Send"
            className={`flex h-9 w-9 items-center justify-center rounded-full transition-all ${
              canSend
                ? 'bg-[#10b981] text-white hover:bg-[#059669] active:scale-95 shadow-sm'
                : 'bg-emerald-600/30 text-white/50 cursor-not-allowed dark:bg-emerald-800/30'
            }`}
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </div>
  );
};
