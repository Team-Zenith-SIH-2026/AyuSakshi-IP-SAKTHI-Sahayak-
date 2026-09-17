import React from 'react';

/**
 * Nature Inspired Ambient Backdrop (Ref 3 Light / Ref 4 Dark).
 *
 * Implements:
 * - Layer 1 Background: Calm Nature-inspired gradient (#F8FAF6 / #E6F4EA / #A7D7C5 in light;
 *   #0F2D24 / #1E5B4B / #3DBB8F in dark).
 * - Soft flowing waves across the lower section.
 * - Elegant botanical leaf branch on the right side.
 * - Sits strictly behind the UI (-z-10, pointer-events-none), non-intrusive, no horizontal scroll.
 */

const NatureWaveLight = () => (
  <svg
    viewBox="0 0 1440 600"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="none"
    className="absolute bottom-0 left-0 h-[460px] w-full pointer-events-none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="waveGradLight1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#f5faf2" stopOpacity="0.8" />
        <stop offset="40%" stopColor="#e2f3e8" stopOpacity="0.75" />
        <stop offset="100%" stopColor="#bfe6d5" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="waveGradLight2" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#edf7ef" stopOpacity="0.5" />
        <stop offset="50%" stopColor="#d3edd9" stopOpacity="0.6" />
        <stop offset="100%" stopColor="#a7d7c5" stopOpacity="0.7" />
      </linearGradient>
      <linearGradient id="waveGradLight3" x1="20%" y1="0%" x2="80%" y2="100%">
        <stop offset="0%" stopColor="#f8fbf7" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#c5ebd8" stopOpacity="0.5" />
      </linearGradient>
    </defs>

    {/* Back soft wave */}
    <path
      d="M0,320 C320,240 620,400 980,310 C1200,250 1340,280 1440,300 L1440,600 L0,600 Z"
      fill="url(#waveGradLight1)"
    />

    {/* Mid wave */}
    <path
      d="M0,380 C280,340 560,430 880,360 C1160,300 1320,380 1440,360 L1440,600 L0,600 Z"
      fill="url(#waveGradLight2)"
    />

    {/* Front ribbon wave */}
    <path
      d="M0,450 C360,370 720,470 1080,410 C1260,380 1380,410 1440,400 L1440,600 L0,600 Z"
      fill="url(#waveGradLight3)"
    />
  </svg>
);

const NatureWaveDark = () => (
  <svg
    viewBox="0 0 1440 600"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    preserveAspectRatio="none"
    className="absolute bottom-0 left-0 h-[460px] w-full pointer-events-none"
    aria-hidden="true"
  >
    <defs>
      <linearGradient id="waveGradDark1" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#0a231c" stopOpacity="0.9" />
        <stop offset="50%" stopColor="#133e33" stopOpacity="0.8" />
        <stop offset="100%" stopColor="#1e5b4b" stopOpacity="0.75" />
      </linearGradient>
      <linearGradient id="waveGradDark2" x1="0%" y1="30%" x2="100%" y2="80%">
        <stop offset="0%" stopColor="#10362c" stopOpacity="0.6" />
        <stop offset="60%" stopColor="#195444" stopOpacity="0.65" />
        <stop offset="100%" stopColor="#2a7a63" stopOpacity="0.6" />
      </linearGradient>
      <linearGradient id="waveLuminousDark" x1="0%" y1="50%" x2="100%" y2="50%">
        <stop offset="0%" stopColor="#124336" stopOpacity="0.4" />
        <stop offset="50%" stopColor="#28836a" stopOpacity="0.5" />
        <stop offset="100%" stopColor="#3dbb8f" stopOpacity="0.35" />
      </linearGradient>
    </defs>

    {/* Deep back wave */}
    <path
      d="M0,310 C340,230 640,390 1000,300 C1220,240 1360,270 1440,290 L1440,600 L0,600 Z"
      fill="url(#waveGradDark1)"
    />

    {/* Middle flowing wave */}
    <path
      d="M0,370 C300,320 600,420 920,350 C1180,290 1340,370 1440,350 L1440,600 L0,600 Z"
      fill="url(#waveGradDark2)"
    />

    {/* Glowing ribbon wave */}
    <path
      d="M0,440 C380,360 740,460 1100,400 C1280,370 1390,395 1440,390 L1440,600 L0,600 Z"
      fill="url(#waveLuminousDark)"
    />
  </svg>
);

const BotanicalBranchRight = ({ isDark = false }) => (
  <svg
    viewBox="0 0 450 700"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className="h-full w-full pointer-events-none"
    aria-hidden="true"
  >
    <defs>
      {/* Light mode leaf gradients */}
      <linearGradient id="leafLightA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#55b88f" stopOpacity="0.5" />
        <stop offset="60%" stopColor="#7acda7" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#a9dfc7" stopOpacity="0.2" />
      </linearGradient>
      <linearGradient id="leafLightB" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#3ca87c" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#6dc69e" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#9fe2c0" stopOpacity="0.25" />
      </linearGradient>

      {/* Dark mode leaf gradients */}
      <linearGradient id="leafDarkA" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stopColor="#45c99b" stopOpacity="0.55" />
        <stop offset="50%" stopColor="#2fa57d" stopOpacity="0.35" />
        <stop offset="100%" stopColor="#1a6e52" stopOpacity="0.15" />
      </linearGradient>
      <linearGradient id="leafDarkB" x1="100%" y1="0%" x2="0%" y2="100%">
        <stop offset="0%" stopColor="#5ce0b0" stopOpacity="0.6" />
        <stop offset="50%" stopColor="#38b78a" stopOpacity="0.4" />
        <stop offset="100%" stopColor="#1f7a5b" stopOpacity="0.2" />
      </linearGradient>
    </defs>

    {/* Main Stem */}
    <path
      d="M340,700 C330,550 300,380 250,220 C230,150 200,90 170,20"
      stroke={isDark ? '#3dbb8f' : '#3ca87c'}
      strokeWidth="4"
      strokeOpacity={isDark ? '0.55' : '0.45'}
      strokeLinecap="round"
    />

    {/* Topmost Leaf */}
    <g>
      <path
        d="M170,20 C180,-10 210,-15 225,10 C240,35 220,80 170,85 C160,50 165,30 170,20 Z"
        fill={isDark ? 'url(#leafDarkA)' : 'url(#leafLightA)'}
      />
      <path
        d="M170,20 C190,25 210,40 220,60"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="1.5"
        strokeOpacity="0.4"
      />
    </g>

    {/* Leaf 2 - Right Upper */}
    <g>
      <path
        d="M210,105 C270,70 340,95 365,150 C320,185 250,175 210,140 Z"
        fill={isDark ? 'url(#leafDarkB)' : 'url(#leafLightB)'}
      />
      <path
        d="M210,140 C260,140 310,145 360,150"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2"
        strokeOpacity="0.35"
      />
    </g>

    {/* Leaf 3 - Left Upper */}
    <g>
      <path
        d="M215,160 C150,110 80,125 50,180 C95,225 170,210 215,175 Z"
        fill={isDark ? 'url(#leafDarkA)' : 'url(#leafLightA)'}
      />
      <path
        d="M215,175 C160,180 110,185 60,180"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2"
        strokeOpacity="0.35"
      />
    </g>

    {/* Leaf 4 - Right Mid Large */}
    <g>
      <path
        d="M250,260 C335,210 420,245 445,320 C380,365 295,345 250,285 Z"
        fill={isDark ? 'url(#leafDarkB)' : 'url(#leafLightB)'}
      />
      <path
        d="M250,285 C310,290 380,300 440,315"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2.5"
        strokeOpacity="0.4"
      />
    </g>

    {/* Leaf 5 - Left Mid */}
    <g>
      <path
        d="M260,330 C175,270 95,295 65,365 C125,415 215,395 260,350 Z"
        fill={isDark ? 'url(#leafDarkA)' : 'url(#leafLightA)'}
      />
      <path
        d="M260,350 C195,360 135,365 75,360"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2"
        strokeOpacity="0.35"
      />
    </g>

    {/* Leaf 6 - Right Lower Large */}
    <g>
      <path
        d="M290,440 C385,390 455,430 460,510 C395,550 315,525 290,465 Z"
        fill={isDark ? 'url(#leafDarkB)' : 'url(#leafLightB)'}
      />
      <path
        d="M290,465 C345,475 400,485 455,505"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2.5"
        strokeOpacity="0.4"
      />
    </g>

    {/* Leaf 7 - Left Lower */}
    <g>
      <path
        d="M305,510 C210,460 130,490 105,565 C175,610 260,580 305,530 Z"
        fill={isDark ? 'url(#leafDarkA)' : 'url(#leafLightA)'}
      />
      <path
        d="M305,530 C235,545 175,555 115,560"
        stroke={isDark ? '#6ee7b7' : '#2d7a5b'}
        strokeWidth="2"
        strokeOpacity="0.35"
      />
    </g>
  </svg>
);

export const BotanicalBackdrop = () => (
  <div
    className="pointer-events-none fixed inset-0 -z-10 select-none overflow-hidden"
    aria-hidden="true"
  >
    {/* Base Gradient Canvas */}
    <div className="absolute inset-0 bg-gradient-to-b from-[#F8FAF6] via-[#F1F8F4] to-[#E6F4EA] transition-colors duration-300 dark:from-[#091D17] dark:via-[#0F2D24] dark:to-[#143D32]" />

    {/* Ambient radial glows */}
    <div className="absolute -top-32 right-1/4 h-[32rem] w-[32rem] rounded-full bg-emerald-200/25 blur-3xl transition-opacity duration-300 dark:bg-[#1E5B4B]/20" />
    <div className="absolute bottom-10 -left-20 h-[36rem] w-[36rem] rounded-full bg-teal-100/30 blur-3xl transition-opacity duration-300 dark:bg-[#0F3B2E]/25" />

    {/* Flowing Wave Layers (Light vs Dark) */}
    <div className="dark:hidden">
      <NatureWaveLight />
    </div>
    <div className="hidden dark:block">
      <NatureWaveDark />
    </div>

    {/* Botanical Leaf Fronds on Right Side (Reference 3 & Reference 4) */}
    <div className="absolute -right-6 bottom-0 top-12 hidden w-80 opacity-90 sm:w-96 md:block lg:w-[420px] xl:w-[480px]">
      <div className="h-full w-full dark:hidden">
        <BotanicalBranchRight isDark={false} />
      </div>
      <div className="hidden h-full w-full dark:block">
        <BotanicalBranchRight isDark={true} />
      </div>
    </div>
  </div>
);
