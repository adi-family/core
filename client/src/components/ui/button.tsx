import * as React from "react"
import { cn } from "@/lib/utils"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
  size?: 'default' | 'sm' | 'lg'
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', ...props }, ref) => {
    return (
      <button
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 uppercase tracking-wide text-xs active:scale-95",
          {
            'bg-gradient-to-b from-gray-900 to-black text-white hover:from-gray-800 hover:to-gray-900 shadow-sm hover:shadow-md focus-visible:ring-gray-900': variant === 'default',
            'bg-gradient-to-b from-red-500 to-red-600 text-white hover:from-red-600 hover:to-red-700 shadow-sm hover:shadow-md focus-visible:ring-red-600': variant === 'destructive',
            'border border-gray-300 bg-white/90 backdrop-blur-sm hover:bg-gray-50 hover:border-gray-400 shadow-sm hover:shadow focus-visible:ring-gray-400': variant === 'outline',
            'bg-gradient-to-b from-gray-100 to-gray-200 text-gray-900 hover:from-gray-200 hover:to-gray-300 shadow-sm hover:shadow focus-visible:ring-gray-400': variant === 'secondary',
            'hover:bg-gray-100/80 hover:text-gray-900 backdrop-blur-sm focus-visible:ring-gray-400': variant === 'ghost',
            'text-gray-900 underline-offset-4 hover:underline focus-visible:ring-gray-400': variant === 'link',
          },
          {
            'h-10 px-6 py-2': size === 'default',
            'h-8 px-4 text-xs': size === 'sm',
            'h-12 px-8': size === 'lg',
          },
          className
        )}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button }
