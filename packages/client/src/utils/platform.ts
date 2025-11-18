/**
 * Platform detection and keyboard shortcut utilities
 */

export function isMac(): boolean {
  return typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform)
}

export function getModifierKey(): string {
  return isMac() ? '⌘' : 'Ctrl'
}

export function formatShortcut(key: string, options?: { ctrl?: boolean; shift?: boolean; alt?: boolean }): string {
  const parts: string[] = []

  if (options?.ctrl) {
    parts.push(getModifierKey())
  }
  if (options?.shift) {
    parts.push('⇧')
  }
  if (options?.alt) {
    parts.push(isMac() ? '⌥' : 'Alt')
  }

  parts.push(key.toUpperCase())

  return parts.join(' ')
}
