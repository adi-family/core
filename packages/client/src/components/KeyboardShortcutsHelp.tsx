import { useEffect, useState } from 'react'
import { X, Keyboard } from 'lucide-react'
import { designTokens } from '@/theme/tokens'
import { formatShortcut } from '@/utils/platform'

interface ShortcutGroup {
  title: string
  shortcuts: {
    keys: string
    description: string
  }[]
}

export function KeyboardShortcutsHelp() {
  const [isOpen, setIsOpen] = useState(false)

  // Expose toggle function globally for the nav button
  useEffect(() => {
    ;(window as any).__toggleKeyboardShortcuts = () => setIsOpen(prev => !prev)
    return () => {
      delete (window as any).__toggleKeyboardShortcuts
    }
  }, [])

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Open/close with '?' key (Shift + /)
      if (e.key === '?' && !e.ctrlKey && !e.metaKey && !e.altKey) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
      // Close with Escape
      if (e.key === 'Escape' && isOpen) {
        e.preventDefault()
        setIsOpen(false)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  const shortcutGroups: ShortcutGroup[] = [
    {
      title: 'Navigation',
      shortcuts: [
        { keys: formatShortcut('H', { ctrl: true }), description: 'Command Center' },
        { keys: formatShortcut('S', { ctrl: true }), description: 'Ship Mode' },
        { keys: formatShortcut('R', { ctrl: true }), description: 'Review Mode' },
        { keys: formatShortcut('B', { ctrl: true }), description: 'Build Mode' },
        { keys: formatShortcut('I', { ctrl: true }), description: 'Insights' },
      ],
    },
    {
      title: 'Interface',
      shortcuts: [
        { keys: formatShortcut('[', { ctrl: true }), description: 'Toggle sidebar' },
        { keys: '?', description: 'Show keyboard shortcuts' },
        { keys: 'Esc', description: 'Close modals/dialogs' },
      ],
    },
  ]

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-200"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center p-6 pointer-events-none">
        <div
          className={`${designTokens.cards.elevated} w-full max-w-2xl pointer-events-auto animate-in zoom-in-95 duration-200`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className={`${designTokens.spacing.cardHeader} ${designTokens.borders.bottom} flex items-center justify-between`}>
            <div className="flex items-center gap-3">
              <Keyboard className={designTokens.icons.header} />
              <h2 className={designTokens.text.h2}>Keyboard Shortcuts</h2>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className={`${designTokens.colors.text.secondary} ${designTokens.interactions.hover} p-2 rounded-lg`}
            >
              <X className={designTokens.icons.standard} />
            </button>
          </div>

          {/* Content */}
          <div className="p-6 space-y-8">
            {shortcutGroups.map((group) => (
              <div key={group.title}>
                <h3 className={`${designTokens.text.h3} mb-4`}>{group.title}</h3>
                <div className="space-y-3">
                  {group.shortcuts.map((shortcut) => (
                    <div
                      key={shortcut.description}
                      className="flex items-center justify-between py-2"
                    >
                      <span className={designTokens.text.body}>{shortcut.description}</span>
                      <kbd className={`${designTokens.kbd} px-3 py-1.5 text-[12px]`}>
                        {shortcut.keys}
                      </kbd>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Footer */}
          <div className={`${designTokens.spacing.cardHeader} ${designTokens.borders.top} ${designTokens.colors.bg.secondary}`}>
            <p className={designTokens.text.caption}>
              Press <kbd className={designTokens.kbd}>?</kbd> anytime to toggle this help panel
            </p>
          </div>
        </div>
      </div>
    </>
  )
}
