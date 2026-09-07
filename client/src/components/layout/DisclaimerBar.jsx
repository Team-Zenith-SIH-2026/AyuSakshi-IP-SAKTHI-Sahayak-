import React from 'react';

/**
 * Standing legal disclaimer.
 *
 * Required to be visible at all times, so it is not dismissible: there is no
 * close control and no persisted hidden state. It is styled quietly on purpose.
 * An amber warning bar competing with the answer trains people to stop reading
 * it; a calm line of text that never moves gets read once and stays trusted.
 */
export const DisclaimerBar = () => (
  <div
    role="note"
    aria-label="Legal disclaimer"
    className="w-full flex-shrink-0 border-t border-emerald-900/[0.06] bg-white/50 px-4 py-2 backdrop-blur-sm dark:border-white/[0.06] dark:bg-white/[0.02]"
  >
    <p className="mx-auto max-w-3xl text-center text-[11.5px] leading-relaxed text-slate-400 dark:text-slate-500">
      <span className="font-medium text-slate-500 dark:text-slate-400">Information, not legal advice.</span>{' '}
      <span className="hidden sm:inline">
        Check each citation against the official text and speak to a qualified practitioner before acting.
      </span>
    </p>
  </div>
);
