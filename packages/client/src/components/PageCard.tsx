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
}

/**
 * Reusable page card wrapper with consistent Linear-inspired styling
 */
export function PageCard({
  title,
  description,
  children,
  className,
  headerClassName,
  contentClassName,
}: PageCardProps) {
  return (
    <Card className={className ?? `${designTokens.colors.bg.secondary} ${designTokens.borders.default} rounded-lg`}>
      <CardHeader className={headerClassName ?? `${designTokens.spacing.cardHeader} ${designTokens.borders.bottom}`}>
        <CardTitle className={designTokens.text.h2}>{title}</CardTitle>
        {description && (
          <CardDescription className={`${designTokens.text.bodySecondary} mt-1`}>
            {description}
          </CardDescription>
        )}
      </CardHeader>
      <CardContent className={contentClassName ?? designTokens.spacing.cardPadding}>
        {children}
      </CardContent>
    </Card>
  )
}
