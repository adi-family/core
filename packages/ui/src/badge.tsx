import * as React from "react"
import { cn } from "./lib/utils"
import type { LucideIcon } from "lucide-react"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'orange' | 'purple' | 'green' | 'gray' | 'white' | 'light' | 'medium' | 'dark'
  icon?: LucideIcon | React.ComponentType<{ className?: string }>
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', icon: Icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center justify-center gap-1.5 px-2.5 py-1 text-[0.625rem] leading-none font-semibold uppercase tracking-wider rounded-sm transition-all duration-150",
          {
            // Grayscale variants - all colors mapped to neutral shades
            'bg-neutral-200 text-neutral-800 hover:bg-neutral-300': variant === 'default' || variant === 'gray' || variant === 'light',
            'bg-white text-neutral-900 hover:bg-neutral-100': variant === 'success' || variant === 'green' || variant === 'white',
            'bg-neutral-400 text-neutral-900 hover:bg-neutral-500': variant === 'warning' || variant === 'medium',
            'bg-neutral-700 text-white hover:bg-neutral-800': variant === 'danger' || variant === 'dark',
            'bg-neutral-500 text-white hover:bg-neutral-600': variant === 'info' || variant === 'blue' || variant === 'orange' || variant === 'purple',
          },
          className
        )}
        {...props}
      >
        {Icon && <Icon className="h-3 w-3" />}
        {children}
      </span>
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
