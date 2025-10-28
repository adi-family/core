/**
 * Unified design system tokens for ADI client
 * Provides consistent colors, animations, and styling across all pages
 */

export const designTokens = {
  // Color gradients matching landing page aesthetic
  gradients: {
    primary: 'from-emerald-500 to-blue-600',
    secondary: 'from-purple-500 to-pink-600',
    accent: 'from-teal-500 to-cyan-600',
    dark: 'from-slate-950 via-black to-slate-900',
    header: 'from-slate-800 via-slate-900 to-black',
    cardHeader: 'from-accent-teal to-accent-cyan',
  },

  // Glassmorphism effects
  glass: {
    light: 'bg-white/90 backdrop-blur-md',
    medium: 'bg-white/80 backdrop-blur-lg',
    dark: 'bg-slate-900/90 backdrop-blur-xl',
    darkMedium: 'bg-slate-800/85 backdrop-blur-lg',
  },

  // Shadow styles for depth
  shadows: {
    card: 'shadow-lg hover:shadow-xl',
    cardDark: 'shadow-2xl shadow-black/20',
    button: 'shadow-sm hover:shadow-md',
    glow: 'shadow-lg shadow-blue-500/20 hover:shadow-blue-500/30',
  },

  // Border styles
  borders: {
    subtle: 'border border-gray-200/60',
    glass: 'border border-white/10',
    glow: 'border border-blue-500/20 hover:border-blue-400/40',
  },

  // Animation classes
  animations: {
    fadeIn: 'animate-fadeIn',
    hover: 'transition-all duration-300',
    hoverLift: 'hover:-translate-y-0.5 transition-transform duration-200',
    scaleOnHover: 'hover:scale-[1.02] transition-transform duration-200',
  },

  // Typography
  text: {
    pageTitle: 'text-3xl font-bold tracking-wide',
    cardTitle: 'text-2xl font-bold tracking-wide uppercase',
    cardDescription: 'text-sm text-gray-300',
    label: 'text-xs font-semibold uppercase tracking-wider',
  },

  // Spacing
  spacing: {
    pageContainer: 'container mx-auto p-6 max-w-7xl',
    cardPadding: 'p-6',
    cardHeader: 'px-6 py-4',
  },
} as const
