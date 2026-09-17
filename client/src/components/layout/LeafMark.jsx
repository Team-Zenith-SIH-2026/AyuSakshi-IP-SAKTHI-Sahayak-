import React from 'react';

/**
 * Brand mark: Stylized Ayurveda Lotus Emblem (matching Reference 1 & 2).
 */
export const LeafMark = ({ className = 'w-6 h-6' }) => (
  <svg
    viewBox="0 0 36 36"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Center core petal */}
    <path
      d="M18 5 C15 12 15 22 18 29 C21 22 21 12 18 5 Z"
      fill="currentColor"
    />
    {/* Inner left petal */}
    <path
      d="M18 29 C14 26 9 17 11 10 C14 15 17 22 18 29 Z"
      fill="currentColor"
      opacity="0.9"
    />
    {/* Inner right petal */}
    <path
      d="M18 29 C22 26 27 17 25 10 C22 15 19 22 18 29 Z"
      fill="currentColor"
      opacity="0.9"
    />
    {/* Outer left wing petal */}
    <path
      d="M18 29 C11 28 4 23 4 15 C8 17 14 23 18 29 Z"
      fill="currentColor"
      opacity="0.75"
    />
    {/* Outer right wing petal */}
    <path
      d="M18 29 C25 28 32 23 32 15 C28 17 22 23 18 29 Z"
      fill="currentColor"
      opacity="0.75"
    />
    {/* Base cradle */}
    <path
      d="M8 26 C12 30 24 30 28 26 C23 29 13 29 8 26 Z"
      fill="currentColor"
      opacity="0.85"
    />
  </svg>
);

