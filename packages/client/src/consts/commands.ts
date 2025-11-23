import {
  Command,
  Rocket,
  Search,
  Zap,
  BarChart3,
  ListTodo,
  Database,
  FolderOpen,
  Plus,
  Play,
  PanelLeftClose,
  PanelLeft,
  Keyboard,
  type LucideIcon,
} from 'lucide-react'

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon: LucideIcon
  keywords?: string[]
  action: (ctx: CommandContext) => void
}

export interface CommandContext {
  navigate: (path: string) => void
  toggleSidebar: () => void
  isSidebarCollapsed: boolean
}

export interface CommandGroup {
  title: string
  commands: CommandItem[]
}

// Navigation commands
const navigationCommands: CommandItem[] = [
  {
    id: 'go-command-center',
    label: 'Go to Command Center',
    icon: Command,
    keywords: ['home', 'dashboard'],
    action: (ctx) => ctx.navigate('/'),
  },
  {
    id: 'go-ship',
    label: 'Go to Ship Mode',
    icon: Rocket,
    keywords: ['deploy', 'release'],
    action: (ctx) => ctx.navigate('/ship'),
  },
  {
    id: 'go-review',
    label: 'Go to Review Mode',
    icon: Search,
    keywords: ['check', 'inspect'],
    action: (ctx) => ctx.navigate('/review'),
  },
  {
    id: 'go-build',
    label: 'Go to Build Mode',
    icon: Zap,
    keywords: ['develop', 'create'],
    action: (ctx) => ctx.navigate('/build'),
  },
  {
    id: 'go-insights',
    label: 'Go to Insights',
    icon: BarChart3,
    keywords: ['analytics', 'stats', 'metrics'],
    action: (ctx) => ctx.navigate('/insights'),
  },
  {
    id: 'go-tasks',
    label: 'Go to Tasks',
    icon: ListTodo,
    keywords: ['todos', 'list'],
    action: (ctx) => ctx.navigate('/tasks'),
  },
  {
    id: 'go-task-sources',
    label: 'Go to Task Sources',
    icon: Database,
    keywords: ['sources', 'integrations'],
    action: (ctx) => ctx.navigate('/task-sources'),
  },
  {
    id: 'go-file-spaces',
    label: 'Go to File Spaces',
    icon: FolderOpen,
    keywords: ['files', 'folders'],
    action: (ctx) => ctx.navigate('/file-spaces'),
  },
  {
    id: 'go-pipelines',
    label: 'Go to Pipelines',
    icon: Play,
    keywords: ['executions', 'runs'],
    action: (ctx) => ctx.navigate('/pipeline-executions'),
  },
]

// Action commands
const actionCommands: CommandItem[] = [
  {
    id: 'new-task',
    label: 'Create New Task',
    icon: Plus,
    keywords: ['add', 'todo'],
    action: (ctx) => ctx.navigate('/tasks?action=new'),
  },
  {
    id: 'toggle-sidebar',
    label: 'Toggle Sidebar',
    description: 'Show or hide the sidebar',
    icon: PanelLeft,
    keywords: ['collapse', 'expand', 'hide', 'show'],
    action: (ctx) => ctx.toggleSidebar(),
  },
  {
    id: 'collapse-sidebar',
    label: 'Collapse Sidebar',
    icon: PanelLeftClose,
    keywords: ['hide', 'close'],
    action: (ctx) => {
      if (!ctx.isSidebarCollapsed) ctx.toggleSidebar()
    },
  },
  {
    id: 'expand-sidebar',
    label: 'Expand Sidebar',
    icon: PanelLeft,
    keywords: ['show', 'open'],
    action: (ctx) => {
      if (ctx.isSidebarCollapsed) ctx.toggleSidebar()
    },
  },
  {
    id: 'show-shortcuts',
    label: 'Show Keyboard Shortcuts',
    icon: Keyboard,
    keywords: ['help', 'hotkeys'],
    action: () => (window as any).__toggleKeyboardShortcuts?.(),
  },
]

export const COMMAND_GROUPS: CommandGroup[] = [
  { title: 'Navigation', commands: navigationCommands },
  { title: 'Actions', commands: actionCommands },
]

export const ALL_COMMANDS: CommandItem[] = [
  ...navigationCommands,
  ...actionCommands,
]
