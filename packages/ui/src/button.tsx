import * as React from "react"
import { cn } from "./lib/utils"
import { Tooltip } from "./tooltip"
import type { ButtonVariant, ButtonSize } from "./button-variants"

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  tooltip?: string
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = 'default', size = 'default', loading, disabled, tooltip, children, ...props }, ref) => {
    const button = (
      <button
        disabled={disabled || loading}
        style={{
          ...(disabled && !loading && { opacity: 0.5 }),
        }}
        className={cn(
          "inline-flex items-center justify-center font-medium transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 uppercase tracking-wide text-xs relative rounded-lg",
          !disabled && !loading && "cursor-pointer active:scale-95 hover:translate-y-[-1px]",
          disabled && "cursor-not-allowed",
          {
            'bg-gradient-to-b from-gray-900 to-black text-white shadow-sm focus-visible:ring-gray-900': variant === 'default',
            'bg-gradient-to-b from-red-500 to-red-600 text-white shadow-sm focus-visible:ring-red-600': variant === 'destructive',
            'bg-gradient-to-b from-green-500 to-green-600 text-white shadow-sm focus-visible:ring-green-600': variant === 'success',
            'border border-slate-600/50 bg-slate-700/40 backdrop-blur-sm shadow-sm focus-visible:ring-gray-400 text-gray-100': variant === 'outline',
            'bg-gradient-to-b from-gray-100 to-gray-200 text-gray-900 shadow-sm focus-visible:ring-gray-400': variant === 'secondary',
            'backdrop-blur-sm focus-visible:ring-gray-400': variant === 'ghost',
            'text-gray-900 underline-offset-4 focus-visible:ring-gray-400': variant === 'link',
          },
          !disabled && !loading && {
            'hover:from-gray-800 hover:to-gray-900 hover:shadow-md': variant === 'default',
            'hover:from-red-600 hover:to-red-700 hover:shadow-md': variant === 'destructive',
            'hover:from-green-600 hover:to-green-700 hover:shadow-md': variant === 'success',
            'hover:bg-slate-700/60 hover:border-slate-500 hover:shadow': variant === 'outline',
            'hover:from-gray-200 hover:to-gray-300 hover:shadow': variant === 'secondary',
            'hover:bg-gray-100/80 hover:text-gray-900': variant === 'ghost',
            'hover:underline': variant === 'link',
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
      >
        {loading && (
          <>
            <style>{`
              @keyframes mltShdSpin {
                0% {
                  box-shadow: 0 -0.83em 0 -0.25em,
                  0 -0.83em 0 -0.27em, 0 -0.83em 0 -0.29em,
                  0 -0.83em 0 -0.31em, 0 -0.83em 0 -0.327em;
                }
                5%, 95% {
                  box-shadow: 0 -0.83em 0 -0.25em,
                  0 -0.83em 0 -0.27em, 0 -0.83em 0 -0.29em,
                  0 -0.83em 0 -0.31em, 0 -0.83em 0 -0.327em;
                }
                10%, 59% {
                  box-shadow: 0 -0.83em 0 -0.25em,
                  -0.087em -0.825em 0 -0.27em, -0.173em -0.812em 0 -0.29em,
                  -0.256em -0.789em 0 -0.31em, -0.297em -0.775em 0 -0.327em;
                }
                20% {
                  box-shadow: 0 -0.83em 0 -0.25em, -0.338em -0.758em 0 -0.27em,
                   -0.555em -0.617em 0 -0.29em, -0.671em -0.488em 0 -0.31em,
                   -0.749em -0.34em 0 -0.327em;
                }
                38% {
                  box-shadow: 0 -0.83em 0 -0.25em, -0.377em -0.74em 0 -0.27em,
                   -0.645em -0.522em 0 -0.29em, -0.775em -0.297em 0 -0.31em,
                   -0.82em -0.09em 0 -0.327em;
                }
                100% {
                  box-shadow: 0 -0.83em 0 -0.25em, 0 -0.83em 0 -0.27em,
                  0 -0.83em 0 -0.29em, 0 -0.83em 0 -0.31em, 0 -0.83em 0 -0.327em;
                }
              }
              @keyframes round {
                0% { transform: rotate(0deg) }
                100% { transform: rotate(360deg) }
              }
              .button-loader {
                color: currentColor;
                font-size: 10px;
                width: 1em;
                height: 1em;
                border-radius: 50%;
                position: absolute;
                text-indent: -9999em;
                animation: mltShdSpin 1.7s infinite ease, round 1.7s infinite ease;
              }
            `}</style>
            <span className="button-loader" />
          </>
        )}
        <span className={cn("inline-flex items-center gap-2", loading ? "text-transparent" : "")}>{children}</span>
      </button>
    )

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button
  }
)
Button.displayName = "Button"

export { Button }
export { Tooltip } from "./tooltip"
export type { ButtonVariant, ButtonSize } from "./button-variants"
export { buttonVariants, buttonSizes } from "./button-variants"
