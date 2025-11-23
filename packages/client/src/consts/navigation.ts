import type { LucideIcon } from 'lucide-react'
import {
  Command,
  Rocket,
  Search,
  Zap,
  BarChart3,
  ListTodo,
  Database,
  FolderOpen,
  Play,
} from 'lucide-react'
import { designTokens } from '@/theme/tokens'

export interface NavItem {
  to: string
  label: string
  icon: LucideIcon
  activeColor?: string
  hasBadge?: boolean
  requiresExpert?: boolean
}

export const modeNav: NavItem[] = [
  { to: '/', label: 'Command', icon: Command, activeColor: 'text-white' },
  { to: '/ship', label: 'Ship', icon: Rocket, activeColor: designTokens.colors.text.ship },
  { to: '/review', label: 'Review', icon: Search, activeColor: designTokens.colors.text.review },
  { to: '/build', label: 'Build', icon: Zap, activeColor: designTokens.colors.text.build },
  { to: '/insights', label: 'Insights', icon: BarChart3, activeColor: 'text-purple-400' },
]

export const mainNav: NavItem[] = [
  { to: '/tasks', label: 'Tasks', icon: ListTodo },
  { to: '/task-sources', label: 'Task Sources', icon: Database },
  { to: '/file-spaces', label: 'File Spaces', icon: FolderOpen },
  { to: '/pipeline-executions', label: 'Pipelines', icon: Play },
]

export const expertNav: NavItem[] = [
  { to: '/projects', label: 'Projects', requiresExpert: true },
  { to: '/sessions', label: 'Sessions', requiresExpert: true },
  { to: '/messages', label: 'Messages', requiresExpert: true },
  { to: '/worker-cache', label: 'Cache', requiresExpert: true },
  { to: '/pipeline-artifacts', label: 'Artifacts', requiresExpert: true },
  { to: '/admin', label: 'Admin', requiresExpert: true },
]
