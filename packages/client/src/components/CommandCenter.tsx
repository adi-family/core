import { useEffect, useState, useRef, useMemo, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Command } from 'lucide-react'
import { designTokens } from '@/theme/tokens'
import { HOTKEYS, formatHotkey } from '@/consts/hotkeys'
import { ALL_COMMANDS, type CommandItem, type CommandContext } from '@/consts/commands'

interface CommandCenterProps {
  isSidebarCollapsed: boolean
  toggleSidebar: () => void
}

export function CommandCenter({ isSidebarCollapsed, toggleSidebar }: CommandCenterProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)
  const navigate = useNavigate()

  // Command context for actions
  const commandContext: CommandContext = useMemo(() => ({
    navigate,
    toggleSidebar,
    isSidebarCollapsed,
  }), [navigate, toggleSidebar, isSidebarCollapsed])

  // Filter commands based on query
  const filteredCommands = useMemo(() => {
    if (!query.trim()) return ALL_COMMANDS

    const lowerQuery = query.toLowerCase()
    return ALL_COMMANDS.filter(cmd => {
      const labelMatch = cmd.label.toLowerCase().includes(lowerQuery)
      const descMatch = cmd.description?.toLowerCase().includes(lowerQuery)
      const keywordMatch = cmd.keywords?.some(k => k.toLowerCase().includes(lowerQuery))
      return labelMatch || descMatch || keywordMatch
    })
  }, [query])

  // Reset selection when filtered results change
  useEffect(() => {
    setSelectedIndex(0)
  }, [filteredCommands.length])

  // Execute command
  const executeCommand = useCallback((command: CommandItem) => {
    command.action(commandContext)
    setIsOpen(false)
    setQuery('')
  }, [commandContext])

  // Keyboard handler for opening/closing
  useEffect(() => {
    const hotkey = HOTKEYS.CommandCenter
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierMatch = hotkey.ctrlOrCmd ? (e.ctrlKey || e.metaKey) : true

      if (e.key.toLowerCase() === hotkey.key && modifierMatch) {
        e.preventDefault()
        setIsOpen(prev => !prev)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      inputRef.current?.focus()
      setQuery('')
      setSelectedIndex(0)
    }
  }, [isOpen])

  // Navigation keyboard handler
  useEffect(() => {
    if (!isOpen) return

    const handleKeyDown = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev < filteredCommands.length - 1 ? prev + 1 : 0
          )
          break
        case 'ArrowUp':
          e.preventDefault()
          setSelectedIndex(prev =>
            prev > 0 ? prev - 1 : filteredCommands.length - 1
          )
          break
        case 'Enter':
          e.preventDefault()
          if (filteredCommands[selectedIndex]) {
            executeCommand(filteredCommands[selectedIndex])
          }
          break
        case 'Escape':
          e.preventDefault()
          setIsOpen(false)
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, selectedIndex, filteredCommands, executeCommand])

  // Scroll selected item into view
  useEffect(() => {
    if (!listRef.current) return
    const selectedEl = listRef.current.children[selectedIndex] as HTMLElement
    selectedEl?.scrollIntoView({ block: 'nearest' })
  }, [selectedIndex])

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 animate-in fade-in duration-150"
        onClick={() => setIsOpen(false)}
      />

      {/* Modal */}
      <div className="fixed inset-0 z-50 flex items-start justify-center pt-[15vh] px-4 pointer-events-none">
        <div
          className={`${designTokens.cards.elevated} w-full max-w-lg pointer-events-auto animate-in slide-in-from-top-4 duration-200 overflow-hidden`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search Input */}
          <div className={`flex items-center gap-3 px-4 ${designTokens.borders.bottom}`}>
            <Search className={`${designTokens.icons.standard} ${designTokens.colors.text.secondary}`} />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Type a command..."
              className={`flex-1 bg-transparent py-4 text-[15px] ${designTokens.colors.text.primary} placeholder:${designTokens.colors.text.secondary} outline-none`}
            />
            <kbd className={`${designTokens.kbd} text-[11px]`}>
              {formatHotkey(HOTKEYS.CommandCenter)}
            </kbd>
          </div>

          {/* Command List */}
          <div ref={listRef} className="max-h-80 overflow-y-auto py-2">
            {filteredCommands.length === 0 ? (
              <div className={`px-4 py-8 text-center ${designTokens.colors.text.secondary}`}>
                No commands found
              </div>
            ) : (
              filteredCommands.map((command, index) => {
                const Icon = command.icon
                const isSelected = index === selectedIndex
                return (
                  <button
                    key={command.id}
                    onClick={() => executeCommand(command)}
                    onMouseEnter={() => setSelectedIndex(index)}
                    className={`w-full flex items-center gap-3 px-4 py-3 text-left transition-colors ${
                      isSelected
                        ? designTokens.colors.bg.tertiary
                        : 'hover:' + designTokens.colors.bg.secondary
                    }`}
                  >
                    <Icon className={`${designTokens.icons.standard} ${
                      isSelected ? designTokens.colors.text.accent : designTokens.colors.text.secondary
                    }`} />
                    <div className="flex-1 min-w-0">
                      <div className={`${designTokens.text.body} ${
                        isSelected ? designTokens.colors.text.primary : ''
                      }`}>
                        {command.label}
                      </div>
                      {command.description && (
                        <div className={designTokens.text.caption}>
                          {command.description}
                        </div>
                      )}
                    </div>
                  </button>
                )
              })
            )}
          </div>

          {/* Footer */}
          <div className={`${designTokens.borders.top} ${designTokens.colors.bg.secondary} px-4 py-2 flex items-center justify-between`}>
            <div className={`flex items-center gap-4 ${designTokens.text.caption}`}>
              <span className="flex items-center gap-1">
                <kbd className={designTokens.kbd}>↑↓</kbd> navigate
              </span>
              <span className="flex items-center gap-1">
                <kbd className={designTokens.kbd}>↵</kbd> select
              </span>
              <span className="flex items-center gap-1">
                <kbd className={designTokens.kbd}>esc</kbd> close
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Command className={`h-3 w-3 ${designTokens.colors.text.secondary}`} />
              <span className={designTokens.text.caption}>Command Center</span>
            </div>
          </div>
        </div>
      </div>
    </>
  )
}
