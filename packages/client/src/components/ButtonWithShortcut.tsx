import type { ReactNode, ButtonHTMLAttributes } from 'react'
import { designTokens } from '@/theme/tokens'

interface ButtonWithShortcutProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  shortcut?: string
  variant?: 'ship' | 'build' | 'review' | 'primary' | 'secondary' | 'ghost'
}

/**
 * Reusable button component with built-in keyboard shortcut display
 *
 * Example usage:
 * <ButtonWithShortcut
 *   variant="ship"
 *   shortcut={formatShortcut('S', { ctrl: true })}
 * >
 *   Ship Now
 * </ButtonWithShortcut>
 */
export function ButtonWithShortcut({
  children,
  shortcut,
  variant = 'primary',
  className = '',
  ...props
}: ButtonWithShortcutProps) {
  const variantClass = designTokens.buttons[variant]

  return (
    <button
      className={`${variantClass} ${className} flex items-center justify-center gap-3 group relative`}
      {...props}
    >
      <span>{children}</span>
      {shortcut && (
        <kbd className={`${designTokens.kbd} opacity-60 group-hover:opacity-100 transition-opacity`}>
          {shortcut}
        </kbd>
      )}
    </button>
  )
}
