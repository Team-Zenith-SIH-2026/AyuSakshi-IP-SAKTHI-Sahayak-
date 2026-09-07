import React from 'react';

/**
 * Brand mark: a stylised tulsi leaf pair.
 *
 * Replaces the pulsing sparkle that previously stood in as a logo. A sparkle
 * says "generic AI product"; a leaf says what this actually is.
 */
export const LeafMark = ({ className = 'w-6 h-6' }) => (
  <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    {/* stem */}
    <path
      d="M16 29 C 16 23, 16 18, 16 12"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      opacity="0.55"
    />
    {/* right leaf */}
    <path
      d="M16 15 C 20 6, 27 3, 30 4 C 30 12, 25 17, 16 15 Z"
      fill="currentColor"
      opacity="0.95"
    />
    {/* left leaf */}
    <path
      d="M16 19 C 12 11, 5 9, 2 10 C 2 18, 8 22, 16 19 Z"
      fill="currentColor"
      opacity="0.6"
    />
  </svg>
);
