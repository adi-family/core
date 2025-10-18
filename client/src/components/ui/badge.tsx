import * as React from "react"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'orange' | 'purple' | 'green' | 'gray'
  icon?: LucideIcon
}

const Badge = React.forwardRef<HTMLSpanElement, BadgeProps>(
  ({ className, variant = 'default', icon: Icon, children, ...props }, ref) => {
    return (
      <span
        ref={ref}
        className={cn(
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium uppercase tracking-wide border shadow-sm backdrop-blur-sm transition-all duration-200",
          {
            'bg-gray-100/80 text-gray-700 border-gray-300 hover:bg-gray-200/80': variant === 'default' || variant === 'gray',
            'bg-green-50/80 text-green-700 border-green-300 hover:bg-green-100/80': variant === 'success' || variant === 'green',
            'bg-yellow-50/80 text-yellow-700 border-yellow-300 hover:bg-yellow-100/80': variant === 'warning',
            'bg-red-50/80 text-red-700 border-red-300 hover:bg-red-100/80': variant === 'danger',
            'bg-blue-50/80 text-blue-700 border-blue-300 hover:bg-blue-100/80': variant === 'info' || variant === 'blue',
            'bg-orange-50/80 text-orange-700 border-orange-300 hover:bg-orange-100/80': variant === 'orange',
            'bg-purple-50/80 text-purple-700 border-purple-300 hover:bg-purple-100/80': variant === 'purple',
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
