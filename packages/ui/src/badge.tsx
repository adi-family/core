import * as React from "react"
import { cn } from "./lib/utils"
import type { LucideIcon } from "lucide-react"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'orange' | 'purple' | 'green' | 'gray'
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
            'bg-gray-200 text-gray-800 hover:bg-gray-300': variant === 'default' || variant === 'gray',
            'bg-green-500 text-white hover:bg-green-600': variant === 'success' || variant === 'green',
            'bg-yellow-500 text-white hover:bg-yellow-600': variant === 'warning',
            'bg-red-500 text-white hover:bg-red-600': variant === 'danger',
            'bg-blue-500 text-white hover:bg-blue-600': variant === 'info' || variant === 'blue',
            'bg-orange-500 text-white hover:bg-orange-600': variant === 'orange',
            'bg-purple-500 text-white hover:bg-purple-600': variant === 'purple',
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
