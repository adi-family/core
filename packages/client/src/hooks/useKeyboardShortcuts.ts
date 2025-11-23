import { useEffect } from 'react'

interface ShortcutConfig {
  key: string
  ctrlOrCmd?: boolean
  shift?: boolean
  action: () => void
  description: string
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      for (const shortcut of shortcuts) {
        const modifierMatch = shortcut.ctrlOrCmd
          ? (e.ctrlKey || e.metaKey)
          : true
        const shiftMatch = shortcut.shift ? e.shiftKey : !e.shiftKey

        if (
          e.key.toLowerCase() === shortcut.key.toLowerCase() &&
          modifierMatch &&
          shiftMatch
        ) {
          e.preventDefault()
          shortcut.action()
          return
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [shortcuts])
}
