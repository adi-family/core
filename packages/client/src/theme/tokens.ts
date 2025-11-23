/**
 * Power-user design system tokens for ADI client
 * Command & control - optimized for builders who ship
 */

export const designTokens = {
  // Power user color palette
  colors: {
    // Backgrounds
    bg: {
      primary: 'bg-[#0a0a0a]',      // Base background - deeper black
      secondary: 'bg-[#141414]',    // Cards, surfaces - refined dark
      tertiary: 'bg-[#1a1a1a]',     // Hover states
      elevated: 'bg-[#1f1f1f]',     // Modals, popovers
      glass: 'bg-[#141414]/60',     // Glassmorphism effect
    },
    // Borders
    border: {
      default: 'border-[#2a2a2a]',  // Standard 1px hairline
      subtle: 'border-[#1f1f1f]',   // Ultra-subtle dividers
      focus: 'border-[#5e6ad2]',    // Focus/active state
      ship: 'border-[#10b981]',     // Ship/deploy border
      build: 'border-[#f59e0b]',    // Build/active border
      review: 'border-[#6366f1]',   // Review border
    },
    // Text
    text: {
      primary: 'text-white',        // Primary content
      secondary: 'text-gray-400',   // Secondary content
      tertiary: 'text-gray-500',    // Disabled, hints
      accent: 'text-[#5e6ad2]',     // Links, CTAs
      ship: 'text-[#10b981]',       // Ship action
      build: 'text-[#f59e0b]',      // Build action
      review: 'text-[#6366f1]',     // Review action
    },
    // Mode colors - action-oriented
    mode: {
      ship: {
        bg: 'bg-[#10b981]',
        text: 'text-[#10b981]',
        border: 'border-[#10b981]',
        hover: 'hover:bg-[#059669]',
      },
      build: {
        bg: 'bg-[#f59e0b]',
        text: 'text-[#f59e0b]',
        border: 'border-[#f59e0b]',
        hover: 'hover:bg-[#d97706]',
      },
      review: {
        bg: 'bg-[#6366f1]',
        text: 'text-[#6366f1]',
        border: 'border-[#6366f1]',
        hover: 'hover:bg-[#4f46e5]',
      },
    },
    // Accents
    accent: {
      primary: 'bg-[#5e6ad2]',      // Primary action color
      hover: 'bg-[#6b75db]',        // Primary hover
      text: 'text-[#5e6ad2]',       // Accent text
    },
    // Status colors - clear, decisive
    status: {
      ready: 'bg-[#10b981]',        // Ready to ship
      active: 'bg-[#f59e0b]',       // Building now
      waiting: 'bg-[#6b7280]',      // Needs review
      blocked: 'bg-[#ef4444]',      // Critical issue
      success: 'bg-green-500',
      warning: 'bg-yellow-500',
      error: 'bg-red-500',
      info: 'bg-neutral-500',
      pending: 'bg-gray-500',
    },
    // Impact levels
    impact: {
      high: {
        bg: 'bg-[#8b5cf6]',
        text: 'text-[#8b5cf6]',
        border: 'border-[#8b5cf6]',
      },
      medium: {
        bg: 'bg-[#64748b]',
        text: 'text-[#64748b]',
        border: 'border-[#64748b]',
      },
      low: {
        bg: 'bg-[#6b7280]',
        text: 'text-[#6b7280]',
        border: 'border-[#6b7280]',
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
    body: 'text-[13px] text-gray-300',
    bodySecondary: 'text-[13px] text-gray-400',

    // Labels and captions
    label: 'text-[13px] font-medium text-gray-400',
    caption: 'text-[11px] text-gray-500',

    // Code/mono
    mono: 'font-mono text-[12px] text-gray-300',

    // Metrics - large, bold numbers
    metric: 'text-3xl font-bold tabular-nums',
    metricLabel: 'text-xs text-gray-400 uppercase tracking-wide',

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
    focus: 'focus:outline-none focus:ring-2 focus:ring-[#5e6ad2] focus:ring-offset-2 focus:ring-offset-[#0a0a0a]',
    disabled: 'disabled:opacity-50 disabled:cursor-not-allowed',
    hoverScale: 'hover:scale-[1.02] transition-transform duration-200',
    cardHover: 'hover:border-[#3a3a3a] hover:shadow-lg transition-all duration-200',
  },

  // Action buttons - powerful, clear CTAs
  buttons: {
    ship: 'bg-[#10b981] hover:bg-[#059669] text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-green-500/20 active:scale-[0.98]',
    build: 'bg-[#f59e0b] hover:bg-[#d97706] text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-amber-500/20 active:scale-[0.98]',
    review: 'bg-[#6366f1] hover:bg-[#4f46e5] text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg hover:shadow-indigo-500/20 active:scale-[0.98]',
    primary: 'bg-[#5e6ad2] hover:bg-[#4f5bb8] text-white font-medium px-6 py-3 rounded-lg transition-all duration-200 hover:shadow-lg active:scale-[0.98]',
    secondary: 'bg-[#1a1a1a] hover:bg-[#252525] text-gray-300 font-medium px-6 py-3 rounded-lg border border-[#2a2a2a] transition-all duration-200 hover:border-[#3a3a3a] active:scale-[0.98]',
    ghost: 'bg-transparent hover:bg-[#1a1a1a] text-gray-400 font-medium px-4 py-2 rounded-lg transition-colors duration-150',
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
    color: 'text-gray-400',
  },

  // Keyboard shortcuts - visible affordance
  kbd: 'text-[11px] text-gray-500 font-mono bg-[#1a1a1a] px-1.5 py-0.5 rounded border border-[#2a2a2a]',

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
