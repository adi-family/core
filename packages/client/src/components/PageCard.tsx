import { type ReactNode } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@adi-simple/ui/card'
import { designTokens } from '@/theme/tokens'

interface PageCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
  variant?: 'default' | 'glass' | 'dark'
}

/**
 * Reusable page card wrapper with consistent styling
 * Supports multiple variants for different page contexts
 */
export function PageCard({
  title,
  description,
  children,
  className,
  headerClassName,
  contentClassName,
  variant = 'default',
}: PageCardProps) {
  const getCardClassName = () => {
    if (className) return className

    const baseClasses = `${designTokens.animations.hover} ${designTokens.animations.fadeIn}`

    switch (variant) {
      case 'glass':
        return `${baseClasses} bg-white/10 backdrop-blur-xl border border-white/20 shadow-2xl hover:shadow-blue-500/20 rounded-2xl`
      case 'dark':
        return `${baseClasses} ${designTokens.glass.dark} ${designTokens.borders.glass} ${designTokens.shadows.cardDark} rounded-2xl`
      default:
        // Default: Dark glassmorphism for dark background
        return `${baseClasses} bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:shadow-blue-500/10 hover:border-slate-600/60 rounded-2xl`
    }
  }

  const getHeaderClassName = () => {
    if (headerClassName) return headerClassName

    switch (variant) {
      case 'glass':
        return `bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`
      case 'dark':
        return `bg-gradient-to-r ${designTokens.gradients.header} text-white border-b ${designTokens.borders.glass} rounded-t-2xl`
      default:
        return `bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`
    }
  }

  return (
    <Card className={getCardClassName()}>
      <CardHeader className={getHeaderClassName()}>
        <CardTitle className={`${designTokens.text.cardTitle} text-white`}>{title}</CardTitle>
        {description && (
          <CardDescription className={`${designTokens.text.cardDescription} text-gray-200`}>
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={`${contentClassName ?? designTokens.spacing.cardPadding} text-gray-100`}>
        {children}
      </CardContent>
    </Card>
  )
}
