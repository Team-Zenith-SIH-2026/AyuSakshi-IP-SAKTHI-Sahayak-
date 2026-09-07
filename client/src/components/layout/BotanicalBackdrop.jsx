import React from 'react';

/**
 * Ambient botanical backdrop.
 *
 * Soft leaf forms drawn as inline SVG rather than raster images: they stay crisp
 * at any size, weigh nothing, need no network, and can pick up theme colours.
 * Everything sits behind the app at low opacity and is aria-hidden, so it reads
 * as atmosphere rather than content.
 */

const Frond = ({ className = '', flip = false }) => (
  <svg
    viewBox="0 0 400 400"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    style={flip ? { transform: 'scaleX(-1)' } : undefined}
    aria-hidden="true"
  >
    <defs>
      <linearGradient id={`leafFill${flip ? 'B' : 'A'}`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stopColor="currentColor" stopOpacity="0.85" />
        <stop offset="100%" stopColor="currentColor" stopOpacity="0.25" />
      </linearGradient>
    </defs>

    {/* main stem */}
    <path
      d="M40 370 C 120 300, 190 220, 250 120 C 275 78, 292 42, 300 20"
      stroke="currentColor"
      strokeOpacity="0.35"
      strokeWidth="2.5"
      strokeLinecap="round"
    />

    {/* leaves along the stem, alternating */}
    <g fill={`url(#leafFill${flip ? 'B' : 'A'})`}>
      <path d="M250 120 C 292 96, 330 104, 344 128 C 312 152, 272 148, 250 120 Z" />
      <path d="M250 120 C 232 76, 246 38, 272 22 C 288 56, 280 96, 250 120 Z" />

      <path d="M205 190 C 250 172, 286 184, 297 210 C 262 230, 224 220, 205 190 Z" />
      <path d="M205 190 C 190 144, 206 108, 233 94 C 246 130, 234 168, 205 190 Z" />

      <path d="M152 258 C 198 244, 233 258, 242 285 C 206 302, 169 289, 152 258 Z" />
      <path d="M152 258 C 141 211, 160 177, 188 165 C 198 202, 182 238, 152 258 Z" />

      <path d="M96 322 C 142 311, 176 327, 183 354 C 146 369, 111 354, 96 322 Z" />
      <path d="M96 322 C 88 274, 109 242, 138 232 C 146 269, 127 304, 96 322 Z" />
    </g>
  </svg>
);

const Sprig = ({ className = '' }) => (
  <svg viewBox="0 0 240 240" fill="none" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path
      d="M120 230 C 120 170, 120 110, 120 20"
      stroke="currentColor"
      strokeOpacity="0.3"
      strokeWidth="2"
      strokeLinecap="round"
    />
    <g fill="currentColor" fillOpacity="0.4">
      <path d="M120 60 C 150 44, 178 52, 188 72 C 162 90, 134 84, 120 60 Z" />
      <path d="M120 60 C 90 44, 62 52, 52 72 C 78 90, 106 84, 120 60 Z" />
      <path d="M120 110 C 152 94, 182 103, 192 124 C 164 142, 135 135, 120 110 Z" />
      <path d="M120 110 C 88 94, 58 103, 48 124 C 76 142, 105 135, 120 110 Z" />
      <path d="M120 160 C 148 146, 174 154, 183 172 C 158 188, 133 182, 120 160 Z" />
      <path d="M120 160 C 92 146, 66 154, 57 172 C 82 188, 107 182, 120 160 Z" />
    </g>
  </svg>
);

export const BotanicalBackdrop = () => (
  <div className="pointer-events-none fixed inset-0 -z-10 overflow-hidden" aria-hidden="true">
    {/* Warm wash behind everything */}
    <div className="absolute inset-0 bg-gradient-to-br from-[#f6faf7] via-white to-[#eef6f1] dark:from-[#07100e] dark:via-[#060d10] dark:to-[#08151a]" />

    {/* Soft colour blooms */}
    <div className="absolute -top-40 -right-32 h-[34rem] w-[34rem] rounded-full bg-emerald-200/25 blur-3xl dark:bg-emerald-900/20" />
    <div className="absolute -bottom-48 -left-40 h-[32rem] w-[32rem] rounded-full bg-teal-200/20 blur-3xl dark:bg-teal-900/15" />
    <div className="absolute top-1/3 left-1/2 h-96 w-96 -translate-x-1/2 rounded-full bg-lime-100/20 blur-3xl dark:bg-emerald-950/25" />

    {/* Botanical forms */}
    <Frond className="absolute -right-16 -top-10 h-[30rem] w-[30rem] text-emerald-600/[0.07] dark:text-emerald-400/[0.06]" />
    <Frond
      flip
      className="absolute -left-24 -bottom-10 h-[26rem] w-[26rem] text-teal-700/[0.06] dark:text-teal-400/[0.05]"
    />
    <Sprig className="absolute right-1/4 bottom-8 hidden h-56 w-56 text-emerald-700/[0.05] dark:text-emerald-300/[0.04] lg:block" />
  </div>
);
