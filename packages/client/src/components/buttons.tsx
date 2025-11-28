import * as React from 'react'
import { cn } from '@adi-simple/ui/lib/utils'
import { Tooltip } from '@adi-simple/ui/tooltip'
import type { LucideIcon } from 'lucide-react'

// =============================================================================
// BUTTON VARIANTS & SIZES
// =============================================================================

export type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'destructive' | 'success' | 'link'
export type ButtonSize = 'sm' | 'default' | 'lg'

const buttonVariants: Record<ButtonVariant, string> = {
  primary: 'bg-neutral-600 hover:bg-neutral-500 text-white shadow-sm',
  secondary: 'bg-neutral-800 hover:bg-neutral-700 text-neutral-200 border border-neutral-700',
  outline: 'border border-neutral-600/50 bg-neutral-700/40 hover:bg-neutral-700/60 hover:border-neutral-500 text-neutral-100',
  ghost: 'hover:bg-neutral-800 text-neutral-400 hover:text-neutral-200',
  destructive: 'bg-neutral-700 hover:bg-neutral-600 text-neutral-200 border border-neutral-600',
  success: 'bg-neutral-600 hover:bg-neutral-500 text-white',
  link: 'text-neutral-400 hover:text-neutral-200 underline-offset-4 hover:underline',
}

const buttonSizes: Record<ButtonSize, string> = {
  sm: 'h-8 px-3 text-xs',
  default: 'h-10 px-4 text-sm',
  lg: 'h-12 px-6 text-base',
}

// =============================================================================
// BUTTON - Main action button component
// =============================================================================

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant
  size?: ButtonSize
  loading?: boolean
  tooltip?: string
  icon?: LucideIcon
  iconPosition?: 'left' | 'right'
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({
    className,
    variant = 'primary',
    size = 'default',
    loading,
    disabled,
    tooltip,
    icon: Icon,
    iconPosition = 'left',
    children,
    ...props
  }, ref) => {
    const isDisabled = disabled || loading

    const button = (
      <button
        ref={ref}
        disabled={isDisabled}
        className={cn(
          // Base styles
          'inline-flex items-center justify-center gap-2 font-medium rounded-lg transition-all duration-200',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500 focus-visible:ring-offset-2 focus-visible:ring-offset-neutral-900',
          'uppercase tracking-wide',
          // Variant styles
          buttonVariants[variant],
          // Size styles
          buttonSizes[size],
          // Interactive states
          !isDisabled && 'cursor-pointer active:scale-95',
          isDisabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        {loading && (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        )}
        {Icon && iconPosition === 'left' && !loading && <Icon className="h-4 w-4" />}
        {children}
        {Icon && iconPosition === 'right' && !loading && <Icon className="h-4 w-4" />}
      </button>
    )

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button
  }
)
Button.displayName = 'Button'

// =============================================================================
// ICON BUTTON - For icon-only actions (sidebar toggle, delete, etc.)
// =============================================================================

export interface IconButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  variant?: 'default' | 'ghost' | 'destructive'
  size?: 'sm' | 'default' | 'lg'
  tooltip?: string
}

const iconButtonVariants = {
  default: 'text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800',
  ghost: 'text-neutral-500 hover:text-neutral-300',
  destructive: 'text-neutral-500 hover:text-neutral-300',
}

const iconButtonSizes = {
  sm: 'p-1.5',
  default: 'p-2',
  lg: 'p-3',
}

export const IconButton = React.forwardRef<HTMLButtonElement, IconButtonProps>(
  ({ icon: Icon, variant = 'default', size = 'default', tooltip, className, disabled, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        disabled={disabled}
        className={cn(
          'inline-flex items-center justify-center rounded-lg transition-colors duration-150',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-neutral-500',
          iconButtonVariants[variant],
          iconButtonSizes[size],
          disabled && 'opacity-50 cursor-not-allowed',
          className
        )}
        {...props}
      >
        <Icon className="h-4 w-4" />
      </button>
    )

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button
  }
)
IconButton.displayName = 'IconButton'

// =============================================================================
// CARD SELECT BUTTON - For large card selection (integrations, types)
// =============================================================================

export interface CardSelectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  title: string
  description: string
  selected?: boolean
  badge?: string
}

export const CardSelectButton = React.forwardRef<HTMLButtonElement, CardSelectButtonProps>(
  ({ icon: Icon, title, description, selected, badge, disabled, className, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        disabled={disabled}
        className={cn(
          'group relative overflow-hidden rounded-xl border-2 p-6 text-left transition-all duration-200',
          selected
            ? 'border-neutral-500 bg-neutral-500/20 shadow-lg shadow-neutral-500/20'
            : disabled
            ? 'border-neutral-700/50 bg-neutral-800/30 opacity-60 cursor-not-allowed'
            : 'border-neutral-700/50 bg-neutral-800/50 hover:border-neutral-500/50 hover:bg-neutral-700/50 hover:shadow-md cursor-pointer',
          className
        )}
        {...props}
      >
        <div className="flex items-start gap-4">
          {/* Icon */}
          <div className={cn(
            'flex-shrink-0 w-12 h-12 rounded-lg flex items-center justify-center transition-colors',
            selected
              ? 'bg-neutral-500/30 text-neutral-400'
              : disabled
              ? 'bg-neutral-700/50 text-neutral-500'
              : 'bg-neutral-700/50 text-neutral-400 group-hover:bg-neutral-500/20 group-hover:text-neutral-400'
          )}>
            <Icon className="w-6 h-6" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className={cn(
                'text-lg font-medium uppercase tracking-wide transition-colors',
                selected
                  ? 'text-neutral-300'
                  : disabled
                  ? 'text-neutral-500'
                  : 'text-neutral-200 group-hover:text-neutral-100'
              )}>
                {title}
              </div>
              {badge && (
                <span className="text-xs font-medium px-2 py-1 bg-neutral-600/20 text-neutral-400 rounded uppercase tracking-wide border border-neutral-600/30">
                  {badge}
                </span>
              )}
            </div>
            <div className={cn(
              'text-xs',
              disabled ? 'text-neutral-500' : 'text-neutral-400'
            )}>
              {description}
            </div>
          </div>
        </div>
      </button>
    )
  }
)
CardSelectButton.displayName = 'CardSelectButton'

// =============================================================================
// LARGE CARD SELECT BUTTON - For integration selection (GitLab, Jira, etc.)
// =============================================================================

export interface LargeCardSelectButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  title: string
  description: string
  actionText?: string
  badge?: string
}

export const LargeCardSelectButton = React.forwardRef<HTMLButtonElement, LargeCardSelectButtonProps>(
  ({ icon: Icon, title, description, actionText = 'Configure', badge, disabled, className, ...props }, ref) => {
    if (disabled) {
      return (
        <button
          ref={ref}
          type="button"
          disabled
          className={cn(
            'relative overflow-hidden rounded-xl border-2 border-neutral-700/50 bg-neutral-800/50 p-8 opacity-50 cursor-not-allowed',
            className
          )}
          {...props}
        >
          <div className="relative flex flex-col items-center space-y-6">
            <div className="w-20 h-20 rounded-2xl bg-neutral-700/30 flex items-center justify-center">
              <Icon className="w-12 h-12 text-neutral-500" />
            </div>
            <div className="space-y-3 text-center">
              <div className="flex items-center justify-center gap-2">
                <h4 className="text-2xl font-bold text-neutral-500">{title}</h4>
                {badge && (
                  <span className="text-xs font-semibold px-2.5 py-1 bg-neutral-500/20 text-neutral-400 rounded-full uppercase tracking-wide">
                    {badge}
                  </span>
                )}
              </div>
              <p className="text-sm text-neutral-500 leading-relaxed">{description}</p>
            </div>
            <div className="text-xs text-neutral-500 uppercase tracking-wider font-medium">
              Coming Soon
            </div>
          </div>
        </button>
      )
    }

    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'group relative overflow-hidden rounded-xl border-2 border-neutral-500/30 bg-neutral-800/90 p-8 transition-all duration-300 hover:border-neutral-500 hover:shadow-2xl hover:shadow-neutral-500/20 cursor-pointer',
          className
        )}
        {...props}
      >
        <div className="absolute inset-0 bg-neutral-500/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

        <div className="relative flex flex-col items-center space-y-6">
          <div className="w-20 h-20 rounded-2xl bg-neutral-500/10 flex items-center justify-center group-hover:bg-neutral-500/20 transition-colors duration-300">
            <Icon className="w-12 h-12 text-neutral-500" />
          </div>

          <div className="space-y-3 text-center">
            <h4 className="text-2xl font-bold text-neutral-400 group-hover:text-neutral-300 transition-colors">
              {title}
            </h4>
            <p className="text-sm text-neutral-300 leading-relaxed">{description}</p>
          </div>

          <div className="flex items-center gap-2 text-xs text-neutral-400/80 group-hover:text-neutral-300 transition-colors">
            <span className="uppercase tracking-wider font-medium">{actionText}</span>
            <svg className="w-4 h-4 group-hover:translate-x-1 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 5l7 7m0 0l-7 7m7-7H3" />
            </svg>
          </div>
        </div>
      </button>
    )
  }
)
LargeCardSelectButton.displayName = 'LargeCardSelectButton'

// =============================================================================
// TEXT LINK BUTTON - For inline link-styled actions
// =============================================================================

export interface TextLinkButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  size?: 'xs' | 'sm' | 'default'
}

const textLinkSizes = {
  xs: 'text-xs',
  sm: 'text-sm',
  default: 'text-base',
}

export const TextLinkButton = React.forwardRef<HTMLButtonElement, TextLinkButtonProps>(
  ({ size = 'xs', className, children, ...props }, ref) => {
    return (
      <button
        ref={ref}
        type="button"
        className={cn(
          'text-neutral-400 hover:text-neutral-300 hover:underline transition-colors',
          textLinkSizes[size],
          className
        )}
        {...props}
      >
        {children}
      </button>
    )
  }
)
TextLinkButton.displayName = 'TextLinkButton'

// =============================================================================
// SIDEBAR TOGGLE BUTTON - Specific for sidebar collapse/expand
// =============================================================================

export interface SidebarToggleButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  icon: LucideIcon
  isCollapsed?: boolean
  tooltip?: string
  label?: string
}

export const SidebarToggleButton = React.forwardRef<HTMLButtonElement, SidebarToggleButtonProps>(
  ({ icon: Icon, isCollapsed, tooltip, label, className, ...props }, ref) => {
    const button = (
      <button
        ref={ref}
        type="button"
        className={cn(
          'text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 rounded-lg transition-all duration-200 cursor-pointer',
          !isCollapsed && label ? 'flex items-center gap-2 w-[calc(100%+2rem)] -mx-4 px-4 py-2' : 'w-full p-2 flex justify-center',
          className
        )}
        {...props}
      >
        <Icon className={cn('h-4 w-4 transition-transform duration-200', isCollapsed && 'rotate-180')} />
        {!isCollapsed && label && <span className="text-sm">{label}</span>}
      </button>
    )

    return tooltip ? <Tooltip content={tooltip}>{button}</Tooltip> : button
  }
)
SidebarToggleButton.displayName = 'SidebarToggleButton'

// =============================================================================
// EXPORTS
// =============================================================================

export {
  buttonVariants,
  buttonSizes,
}
