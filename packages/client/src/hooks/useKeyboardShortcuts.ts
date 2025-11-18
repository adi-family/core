import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

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

// Global shortcuts that work everywhere
export function useGlobalShortcuts() {
  const navigate = useNavigate()

  useKeyboardShortcuts([
    {
      key: 's',
      ctrlOrCmd: true,
      action: () => navigate('/ship'),
      description: 'Go to Ship Mode'
    },
    {
      key: 'r',
      ctrlOrCmd: true,
      action: () => navigate('/review'),
      description: 'Go to Review Mode'
    },
    {
      key: 'b',
      ctrlOrCmd: true,
      action: () => navigate('/build'),
      description: 'Go to Build Mode'
    },
    {
      key: 'h',
      ctrlOrCmd: true,
      action: () => navigate('/'),
      description: 'Go to Command Center'
    },
    {
      key: 'i',
      ctrlOrCmd: true,
      action: () => navigate('/insights'),
      description: 'Go to Insights'
    },
  ])
}
