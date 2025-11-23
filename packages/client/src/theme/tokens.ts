/**
 * Power-user design system tokens for ADI client
 * Command & control - optimized for builders who ship
 * Grayscale theme - black, white, and shades of gray
 */

export const designTokens = {
  // Grayscale color palette
  colors: {
    // Backgrounds
    bg: {
      primary: 'bg-[#0a0a0a]',      // Base background - deep black
      secondary: 'bg-[#141414]',    // Cards, surfaces
      tertiary: 'bg-[#1a1a1a]',     // Hover states
      elevated: 'bg-[#1f1f1f]',     // Modals, popovers
      glass: 'bg-[#141414]/60',     // Glassmorphism effect
    },
    // Borders
    border: {
      default: 'border-[#2a2a2a]',  // Standard 1px hairline
      subtle: 'border-[#1f1f1f]',   // Ultra-subtle dividers
      focus: 'border-[#4a4a4a]',    // Focus/active state
      ship: 'border-[#4a4a4a]',     // Ship/deploy border
      build: 'border-[#4a4a4a]',    // Build/active border
      review: 'border-[#4a4a4a]',   // Review border
    },
    // Text
    text: {
      primary: 'text-white',        // Primary content
      secondary: 'text-neutral-400',   // Secondary content
      tertiary: 'text-neutral-500',    // Disabled, hints
      accent: 'text-neutral-300',      // Links, CTAs
      ship: 'text-neutral-300',        // Ship action
      build: 'text-neutral-300',       // Build action
      review: 'text-neutral-300',      // Review action
    },
    // Mode colors - grayscale variants
    mode: {
      ship: {
        bg: 'bg-white',
        text: 'text-white',
        border: 'border-white',
        hover: 'hover:bg-neutral-200',
      },
      build: {
        bg: 'bg-neutral-400',
        text: 'text-neutral-400',
        border: 'border-neutral-400',
        hover: 'hover:bg-neutral-500',
      },
      review: {
        bg: 'bg-neutral-600',
        text: 'text-neutral-600',
        border: 'border-neutral-600',
        hover: 'hover:bg-neutral-700',
      },
    },
    // Accents - grayscale
    accent: {
      primary: 'bg-neutral-600',       // Primary action color
      hover: 'bg-neutral-500',         // Primary hover
      text: 'text-neutral-300',        // Accent text
    },
    // Status colors - grayscale variants
    status: {
      ready: 'bg-white',            // Ready to ship
      active: 'bg-neutral-400',        // Building now
      waiting: 'bg-neutral-500',       // Needs review
      blocked: 'bg-neutral-700',       // Critical issue
      success: 'bg-white',
      warning: 'bg-neutral-400',
      error: 'bg-neutral-700',
      info: 'bg-neutral-500',
      pending: 'bg-neutral-500',
    },
    // Impact levels - grayscale
    impact: {
      high: {
        bg: 'bg-white',
        text: 'text-white',
        border: 'border-white',
      },
      medium: {
        bg: 'bg-neutral-400',
        text: 'text-neutral-400',
        border: 'border-neutral-400',
      },
      low: {
        bg: 'bg-neutral-600',
        text: 'text-neutral-600',
        border: 'border-neutral-600',
      },
    },
  },

  // Typography - Power user hierarchy
  text: {
    // Command/Mode titles
    command: 'text-3xl font-bold text-white tracking-tight',
    mode: 'text-2xl font-bold text-white',

    // Page headers
    h1: 'text-2xl font-semibold text-white',
    h2: 'text-lg font-semibold text-white',
    h3: 'text-base font-medium text-white',

    // Body text
    body: 'text-[13px] text-neutral-300',
    bodySecondary: 'text-[13px] text-neutral-400',

    // Labels and captions
    label: 'text-[13px] font-medium text-neutral-400',
    caption: 'text-[11px] text-neutral-500',

    // Code/mono
    mono: 'font-mono text-[12px] text-neutral-300',

    // Metrics - large, bold numbers
    metric: 'text-3xl font-bold tabular-nums',
    metricLabel: 'text-xs text-neutral-400 uppercase tracking-wide',

    // Action buttons
    action: 'text-sm font-medium uppercase tracking-wide',
  },

  // Border styles - consistent hairlines
  borders: {
    default: 'border border-[#2a2a2a]',
    top: 'border-t border-[#2a2a2a]',
    bottom: 'border-b border-[#2a2a2a]',
    left: 'border-l border-[#2a2a2a]',
    right: 'border-r border-[#2a2a2a]',
    none: 'border-0',
  },

  // Interaction states - smooth, powerful
  interactions: {
    hover: 'hover:bg-[#1f1f1f] transition-all duration-200 ease-out',
    active: 'active:bg-[#252525] active:scale-[0.98]',
    focus: 'focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:ring-offset-2 focus:ring-offset-[#0a0a0a]',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    hoverScale: 'hover:scale-[1.02] transition-transform duration-200',
    cardHover: 'hover:border-[#3a3a3a] hover:shadow-lg transition-all duration-200',
  },

  // Action buttons - grayscale CTAs
  buttons: {
    ship: 'bg-white hover:bg-neutral-200 text-black font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-[0.98]',
    build: 'bg-neutral-400 hover:bg-neutral-500 text-black font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-[0.98]',
    review: 'bg-neutral-600 hover:bg-neutral-700 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-[0.98]',
    primary: 'bg-neutral-600 hover:bg-neutral-500 text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-[0.98]',
    secondary: 'bg-[#1a1a1a] hover:bg-[#252525] text-neutral-300 font-medium px-6 py-3 rounded-lg border border-[#2a2a2a] transition-all duration-200 hover:border-[#3a3a3a] active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-[#1a1a1a] text-neutral-400 font-medium px-4 py-2 rounded-lg transition-colors duration-150',
  },

  // Spacing - compact, information-dense
  spacing: {
    pageContainer: 'mx-auto px-6 max-w-7xl',
    cardPadding: 'p-4',
    cardHeader: 'px-4 py-3',
    section: 'space-y-4',
    listItem: 'gap-2',
  },

  // Icons - always 16px (h-4 w-4), except page headers (20px)
  icons: {
    standard: 'h-4 w-4',
    header: 'h-5 w-5',
    color: 'text-neutral-400',
  },

  // Keyboard shortcuts - visible affordance
  kbd: 'text-[11px] text-neutral-500 font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#2a2a2a]',

  // Status indicators - tiny dots
  statusDot: 'w-1.5 h-1.5 rounded-full',

  // Animations - smooth, professional
  animations: {
    fadeIn: 'animate-in fade-in duration-300',
    slideUp: 'animate-in slide-in-from-bottom-4 duration-300 ease-out',
    slideDown: 'animate-in slide-in-from-top-4 duration-300 ease-out',
    scaleIn: 'animate-in zoom-in-95 duration-200 ease-out',
    pulse: 'animate-pulse',
    spin: 'animate-spin',
  },

  // Cards - glassmorphism effect
  cards: {
    default: 'bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-xl',
    glass: 'bg-[#141414]/60 backdrop-blur-xl border border-[#2a2a2a]/50 rounded-lg shadow-2xl',
    elevated: 'bg-[#1a1a1a] border border-[#2a2a2a] rounded-lg shadow-2xl',
    interactive: 'bg-[#141414] border border-[#2a2a2a] rounded-lg shadow-xl hover:border-[#3a3a3a] hover:shadow-2xl transition-all duration-200 cursor-pointer',
  },
} as const
