import { type ReactNode } from 'react'
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@adi-simple/ui/card'

interface PageCardProps {
  title: string
  description?: string
  children: ReactNode
  className?: string
  headerClassName?: string
  contentClassName?: string
}

/**
 * Reusable page card wrapper with consistent styling
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
    <Card
      className={
        className ??
        'border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200'
      }
    >
      <CardHeader
        className={
          headerClassName ?? 'bg-gradient-to-r from-accent-teal to-accent-cyan text-white'
        }
      >
        <CardTitle className="text-2xl uppercase tracking-wide">{title}</CardTitle>
        {description && <CardDescription className="text-gray-300">{description}</CardDescription>}
      </CardHeader>
      <CardContent className={contentClassName ?? 'p-6'}>{children}</CardContent>
    </Card>
  )
}
