import React, { useState } from 'react';
import { useChat } from '../../context/ChatContext';
import { Send, Mic, MicOff, Sparkles, CornerDownLeft } from 'lucide-react';

export const QuickActionBar = () => {
  const { sendMessage, isLoading } = useChat();
  const [input, setInput] = useState('');
  const [isListening, setIsListening] = useState(false);

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

  // Mock Voice STT Toggle
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
        setTimeout(() => {
          setInput('Can I patent an Ayurvedic polyherbal formulation based on classical texts?');
          setIsListening(false);
        }, 1200);
      }
    } else {
      setIsListening(false);
    }
  };

  return (
    <div className="p-2.5 sm:p-3 md:p-4 border-t border-slate-200 dark:border-darkbg-border bg-white/85 dark:bg-darkbg-950/85 backdrop-blur-md w-full">
      <div className="max-w-4xl mx-auto w-full">
        <form
          onSubmit={handleSubmit}
          className="relative rounded-2xl bg-slate-100/90 dark:bg-darkbg-card border border-slate-200 dark:border-darkbg-border focus-within:border-emerald-500/60 focus-within:ring-2 focus-within:ring-emerald-500/20 transition-all shadow-md p-2 flex flex-col justify-between w-full"
        >
          {/* Textarea Input */}
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about Ayurvedic IP, Section 3(p), ABS Form A/III, or Regulatory Licensing..."
            rows={2}
            className="w-full bg-transparent px-2.5 sm:px-3 py-1.5 text-xs sm:text-sm text-slate-800 dark:text-slate-100 placeholder-slate-400 focus:outline-none resize-none"
          />

          {/* Bottom Bar inside Input Box */}
          <div className="flex items-center justify-between pt-2 px-1 sm:px-2 border-t border-slate-200/40 dark:border-darkbg-border/40 gap-2">
            {/* Model & Source Status Tag */}
            <div className="flex items-center space-x-1.5 text-[10px] sm:text-[11px] text-slate-500 dark:text-slate-400 min-w-0">
              <span className="flex items-center space-x-1 font-medium text-emerald-700 dark:text-emerald-400 flex-shrink-0">
                <Sparkles className="w-3 h-3 text-emerald-500 flex-shrink-0" />
                <span>Hybrid RAG</span>
              </span>
              <span className="hidden sm:inline text-slate-300 dark:text-slate-700">•</span>
              <span className="hidden sm:inline truncate">pgvector + Cross-Encoder</span>
            </div>

            {/* Action Buttons: Voice Mic + Send */}
            <div className="flex items-center space-x-1.5 sm:space-x-2 flex-shrink-0">
              <button
                type="button"
                onClick={toggleVoice}
                title={isListening ? 'Listening...' : 'Voice Input (STT)'}
                className={`p-1.5 sm:p-2 rounded-xl text-xs font-semibold transition-all ${
                  isListening
                    ? 'bg-rose-500 text-white animate-pulse'
                    : 'text-slate-500 hover:text-slate-700 dark:hover:text-slate-200 hover:bg-slate-200/60 dark:hover:bg-darkbg-border'
                }`}
              >
                {isListening ? <MicOff className="w-4 h-4" /> : <Mic className="w-4 h-4" />}
              </button>

              <button
                type="submit"
                disabled={!input.trim() || isLoading}
                className={`p-1.5 sm:p-2 rounded-xl transition-all ${
                  input.trim() && !isLoading
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-md shadow-emerald-600/30 active:scale-95'
                    : 'bg-slate-200 dark:bg-darkbg-border text-slate-400 cursor-not-allowed'
                }`}
              >
                <Send className="w-4 h-4" />
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
};
