import { type ReactNode } from 'react'
import { designTokens } from '@/theme/tokens'

interface AnimatedPageContainerProps {
  children: ReactNode
  className?: string
}

/**
 * Animated page container wrapper
 * Provides consistent page animations and spacing across all pages
 */
export function AnimatedPageContainer({ children, className }: AnimatedPageContainerProps) {
  return (
    <div className={`px-6 py-6 ${designTokens.animations.fadeIn} ${className || ''}`}>
      {/* Animated background gradient orbs */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none -z-10">
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/5 rounded-full blur-3xl animate-pulse" />
        <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/5 rounded-full blur-3xl animate-pulse" style={{ animationDelay: '1s' }} />
      </div>

      {children}
    </div>
  )
}
