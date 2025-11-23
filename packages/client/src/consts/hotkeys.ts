import { formatShortcut } from '@/utils/platform'

export interface HotkeyConfig {
  key: string
  ctrlOrCmd?: boolean
  shift?: boolean
  description: string
}

export interface HotkeyGroup {
  title: string
  shortcuts: HotkeyConfig[]
}

// Global hotkeys
export const HOTKEYS = {
  CommandCenter: { key: 'k', ctrlOrCmd: true, description: 'Open command center' },
  ToggleSidebar: { key: '[', ctrlOrCmd: true, shift: true, description: 'Toggle sidebar' },
  ShowShortcuts: { key: '?', description: 'Show keyboard shortcuts' },
  CloseModal: { key: 'Escape', description: 'Close modals/dialogs' },
} as const satisfies Record<string, HotkeyConfig>

// All hotkey groups for help display
export const HOTKEY_GROUPS: HotkeyGroup[] = [
  {
    title: 'Global',
    shortcuts: [
      HOTKEYS.CommandCenter,
      HOTKEYS.ToggleSidebar,
      HOTKEYS.ShowShortcuts,
      HOTKEYS.CloseModal,
    ],
  },
]

// Format hotkey for display
export function formatHotkey(hotkey: HotkeyConfig): string {
  if (hotkey.key === 'Escape') return 'Esc'
  if (hotkey.key === '?') return '?'

  return formatShortcut(hotkey.key, {
    ctrl: hotkey.ctrlOrCmd,
    shift: hotkey.shift,
  })
}
