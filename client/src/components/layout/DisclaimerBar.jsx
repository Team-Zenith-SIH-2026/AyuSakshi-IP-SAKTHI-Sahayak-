import React from 'react';
import { Info } from 'lucide-react';

/**
 * Standing regulatory disclaimer.
 *
 * The problem statement requires an "Information, not legal advice" disclaimer
 * that is always visible. It previously appeared only underneath each assistant
 * message, so it was absent on an empty conversation and scrolled out of view
 * during a long one.
 *
 * Deliberately not dismissible: there is no close control and no persisted
 * hidden state. A user must not be able to remove it.
 */
export const DisclaimerBar = () => (
  <div
    role="note"
    aria-label="Legal disclaimer"
    className="flex-shrink-0 w-full border-t border-amber-300/50 dark:border-amber-500/25 bg-amber-50 dark:bg-amber-950/30 px-3 sm:px-4 py-1.5"
  >
    <div className="flex items-center justify-center space-x-1.5 text-center">
      <Info className="w-3 h-3 text-amber-600 dark:text-amber-500 flex-shrink-0" />
      <p className="text-[10.5px] sm:text-[11px] leading-tight text-amber-800 dark:text-amber-300/90">
        <span className="font-semibold">Information, not legal advice.</span>{' '}
        <span className="hidden sm:inline">
          AyuSakshi provides source-grounded regulatory information for Ayurvedic products. Verify every
          citation against the official text and consult a qualified IP practitioner before acting.
        </span>
        <span className="sm:hidden">Verify citations and consult a practitioner before acting.</span>
      </p>
    </div>
  </div>
);
