import { Link, useLocation } from 'react-router-dom'
import { useSnapshot } from 'valtio'
import { UserButton } from '@clerk/clerk-react'
import {
  ListTodo,
  Database,
  FolderOpen,
  Plus,
  Play,
  ChevronLeft,
  Activity,
  CheckCircle2,
  Clock,
  AlertCircle,
  Command,
  Rocket,
  Search,
  Zap,
  BarChart3,
  Keyboard,
  DollarSign,
} from 'lucide-react'
import { designTokens } from '@/theme/tokens'
import { useProject } from '@/contexts/ProjectContext'
import { useExpertMode } from '@/contexts/ExpertModeContext'
import { tasksStore, projectsStore, usageMetricsStore } from '@/stores'
import { formatShortcut } from '@/utils/platform'
import { calculateCostBreakdown, formatCost } from '@/config/pricing'
import { Select } from '@adi-simple/ui/select'
import { useMemo } from 'react'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const location = useLocation()
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const { expertMode } = useExpertMode()
  const { tasks } = useSnapshot(tasksStore)
  const { projects } = useSnapshot(projectsStore)
  const { metrics: usageMetrics, loading: loadingUsage } = useSnapshot(usageMetricsStore)

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  )

  // Calculate total cost and balance
  const totalCost = useMemo(() => {
    if (usageMetrics.length === 0) return 0
    return usageMetrics.reduce((acc, metric) => {
      const breakdown = calculateCostBreakdown(metric)
      return acc + breakdown.totalCost
    }, 0)
  }, [usageMetrics])

  const balance = 100 - totalCost

  // Filter tasks by project
  const projectTasks = useMemo(() => {
    if (!selectedProjectId) return tasks
    return tasks.filter(t => t.project_id === selectedProjectId)
  }, [tasks, selectedProjectId])

  // Calculate stats
  const stats = useMemo(() => {
    const total = projectTasks.length
    const completed = projectTasks.filter(t => t.ai_implementation_status === 'completed').length
    const inProgress = projectTasks.filter(t =>
      t.ai_implementation_status === 'implementing' ||
      t.ai_implementation_status === 'queued'
    ).length
    const needsReview = projectTasks.filter(t =>
      !t.ai_evaluation_simple_status ||
      t.ai_evaluation_simple_status === 'not_started'
    ).length

    return { total, completed, inProgress, needsReview }
  }, [projectTasks])

  // Mode navigation items
  const modeNavItems = useMemo(() => [
    { to: '/', label: 'Command', icon: Command, color: 'text-white', shortcut: formatShortcut('H', { ctrl: true }) },
    { to: '/ship', label: 'Ship', icon: Rocket, color: designTokens.colors.text.ship, shortcut: formatShortcut('S', { ctrl: true }) },
    { to: '/review', label: 'Review', icon: Search, color: designTokens.colors.text.review, shortcut: formatShortcut('R', { ctrl: true }) },
    { to: '/build', label: 'Build', icon: Zap, color: designTokens.colors.text.build, shortcut: formatShortcut('B', { ctrl: true }) },
    { to: '/insights', label: 'Insights', icon: BarChart3, color: 'text-purple-400', shortcut: formatShortcut('I', { ctrl: true }) },
  ], [])

  const navItems = [
    { to: '/tasks', label: 'Tasks', icon: ListTodo, badge: stats.total },
    { to: '/task-sources', label: 'Task Sources', icon: Database },
    { to: '/file-spaces', label: 'File Spaces', icon: FolderOpen },
  ]

  const quickActions = [
    { to: '/tasks?action=new', label: 'New Task', icon: Plus },
    { to: '/pipeline-executions', label: 'Pipelines', icon: Play },
  ]

  // Legacy navigation items (for expert mode)
  const legacyNavItems = [
    { to: '/projects', label: 'Projects', requiresExpert: true },
    { to: '/sessions', label: 'Sessions', requiresExpert: true },
    { to: '/messages', label: 'Messages', requiresExpert: true },
    { to: '/worker-cache', label: 'Cache', requiresExpert: true },
    { to: '/pipeline-artifacts', label: 'Artifacts', requiresExpert: true },
    { to: '/admin', label: 'Admin', requiresExpert: true, isAdmin: true },
  ]

  const visibleLegacyItems = legacyNavItems.filter(item => !item.requiresExpert || expertMode)

  if (isCollapsed) {
    return (
      <div className={`${designTokens.colors.bg.secondary} ${designTokens.borders.right} h-full flex flex-col items-center py-4 gap-3`}>
        {/* Logo */}
        <Link to="/" className="font-bold text-lg text-white mb-2">
          A
        </Link>

        <div className={`${designTokens.borders.bottom} w-full pb-3`} />

        {/* Expand button */}
        <button
          onClick={onToggle}
          className={`${designTokens.colors.text.secondary} ${designTokens.interactions.hover} p-2 rounded-lg rotate-180`}
          title={`Expand sidebar ${formatShortcut('[', { ctrl: true })}`}
        >
          <ChevronLeft className={designTokens.icons.standard} />
        </button>

        {/* Mode icons */}
        {modeNavItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`p-2 rounded-lg ${isActive
                  ? designTokens.colors.bg.tertiary
                  : designTokens.interactions.hover
                }`}
              title={`${item.label} (${item.shortcut})`}
            >
              <Icon className={`${designTokens.icons.standard} ${isActive ? item.color : designTokens.colors.text.secondary
                }`} />
            </Link>
          )
        })}

        <div className={`${designTokens.borders.bottom} w-full my-2`} />

        {/* Navigation icons */}
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = location.pathname === item.to
          return (
            <Link
              key={item.to}
              to={item.to}
              className={`relative p-2 rounded-lg ${isActive
                  ? designTokens.colors.bg.tertiary
                  : designTokens.interactions.hover
                }`}
              title={item.label}
            >
              <Icon className={`${designTokens.icons.standard} ${isActive ? designTokens.colors.text.accent : designTokens.colors.text.secondary
                }`} />
              {item.badge !== undefined && item.badge > 0 && (
                <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center">
                  <span className="text-[9px] text-white font-bold">{item.badge > 99 ? '99+' : item.badge}</span>
                </div>
              )}
            </Link>
          )
        })}

        <div className="flex-1" />

        {/* Bottom icons */}
        <button
          onClick={() => (window as any).__toggleKeyboardShortcuts?.()}
          className={`${designTokens.colors.text.secondary} ${designTokens.interactions.hover} p-2 rounded-lg`}
          title="Keyboard shortcuts (?)"
        >
          <Keyboard className={designTokens.icons.standard} />
        </button>

        <div className="scale-75">
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>
    )
  }

  return (
    <div className={`${designTokens.colors.bg.secondary} ${designTokens.borders.right} h-full flex flex-col w-64`}>
      {/* Header with Logo and Collapse */}
      <div className={`${designTokens.spacing.cardHeader} ${designTokens.borders.bottom} flex items-center justify-between`}>
        <Link to="/" className="font-bold text-lg text-white">
          ADI
        </Link>
        <button
          onClick={onToggle}
          className={`${designTokens.colors.text.secondary} ${designTokens.interactions.hover} p-2 rounded-lg`}
          title={`Collapse sidebar ${formatShortcut('[', { ctrl: true })}`}
        >
          <ChevronLeft className={designTokens.icons.standard} />
        </button>
      </div>

      {/* Balance & User */}
      <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom} space-y-3`}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <DollarSign className={`${designTokens.icons.standard} text-green-400`} />
            <span className={`${designTokens.text.body} font-medium text-green-400`}>
              {loadingUsage ? '...' : formatCost(balance)}
            </span>
          </div>
          <UserButton afterSignOutUrl="/" />
        </div>
      </div>

      {/* Project Selector */}
      {projects.length > 0 && (
        <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
          <div className={`${designTokens.text.label} mb-2`}>Project</div>
          <Select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="w-full h-8 text-[13px]"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Mode Navigation */}
      <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
        <div className={`${designTokens.text.label} mb-2`}>Modes</div>
        <div className="space-y-1">
          {modeNavItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center justify-between px-3 py-2 rounded-lg transition-all group ${isActive
                    ? `${designTokens.colors.bg.tertiary} ${item.color}`
                    : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
                  }`}
              >
                <div className="flex items-center gap-3">
                  <Icon className={designTokens.icons.standard} />
                  <span className={designTokens.text.body}>{item.label}</span>
                </div>
                <kbd className={`${designTokens.kbd} text-[10px] opacity-50 group-hover:opacity-100`}>
                  {item.shortcut}
                </kbd>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Project Stats */}
      {selectedProject && (
        <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
          <div className="mb-3">
            <div className={`${designTokens.text.label} mb-1`}>Current Project</div>
            <div className={`${designTokens.text.body} font-medium`}>{selectedProject.name}</div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            <div className={`${designTokens.colors.bg.tertiary} rounded-lg p-2`}>
              <div className="flex items-center gap-1 mb-1">
                <CheckCircle2 className={`h-3 w-3 ${designTokens.colors.text.ship}`} />
                <span className={designTokens.text.caption}>Done</span>
              </div>
              <div className={`${designTokens.text.body} font-bold`}>{stats.completed}</div>
            </div>
            <div className={`${designTokens.colors.bg.tertiary} rounded-lg p-2`}>
              <div className="flex items-center gap-1 mb-1">
                <Activity className={`h-3 w-3 ${designTokens.colors.text.build}`} />
                <span className={designTokens.text.caption}>Active</span>
              </div>
              <div className={`${designTokens.text.body} font-bold`}>{stats.inProgress}</div>
            </div>
            <div className={`${designTokens.colors.bg.tertiary} rounded-lg p-2`}>
              <div className="flex items-center gap-1 mb-1">
                <AlertCircle className={`h-3 w-3 ${designTokens.colors.text.review}`} />
                <span className={designTokens.text.caption}>Review</span>
              </div>
              <div className={`${designTokens.text.body} font-bold`}>{stats.needsReview}</div>
            </div>
            <div className={`${designTokens.colors.bg.tertiary} rounded-lg p-2`}>
              <div className="flex items-center gap-1 mb-1">
                <Clock className="h-3 w-3 text-gray-400" />
                <span className={designTokens.text.caption}>Total</span>
              </div>
              <div className={`${designTokens.text.body} font-bold`}>{stats.total}</div>
            </div>
          </div>
        </div>
      )}

      {/* Navigation */}
      <div className={`flex-1 overflow-y-auto ${designTokens.spacing.cardPadding}`}>
        <div className="space-y-1 mb-6">
          <div className={`${designTokens.text.label} mb-2`}>Quick Links</div>
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = location.pathname === item.to
            return (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${isActive
                    ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.accent}`
                    : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
                  }`}
              >
                <Icon className={designTokens.icons.standard} />
                <span className={designTokens.text.body}>{item.label}</span>
                {item.badge !== undefined && item.badge > 0 && (
                  <span className={`ml-auto ${designTokens.kbd} px-2`}>{item.badge}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Quick Actions */}
        <div className="space-y-1">
          <div className={`${designTokens.text.label} mb-2`}>Quick Actions</div>
          {quickActions.map((action) => {
            const Icon = action.icon
            return (
              <Link
                key={action.to}
                to={action.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`}
              >
                <Icon className={designTokens.icons.standard} />
                <span className={designTokens.text.body}>{action.label}</span>
              </Link>
            )
          })}
        </div>
      </div>

      {/* Expert Mode Items */}
      {expertMode && visibleLegacyItems.length > 0 && (
        <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.top}`}>
          <div className={`${designTokens.text.label} mb-2`}>Advanced</div>
          <div className="space-y-1">
            {visibleLegacyItems.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${item.isAdmin
                    ? `${designTokens.colors.text.accent} font-medium`
                    : designTokens.colors.text.secondary
                  } ${designTokens.interactions.hover}`}
              >
                <span className={designTokens.text.body}>{item.label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* Footer - Shortcuts hint */}
      <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.top} mt-auto`}>
        <button
          onClick={() => (window as any).__toggleKeyboardShortcuts?.()}
          className={`w-full flex items-center justify-center gap-2 ${designTokens.colors.text.secondary} ${designTokens.interactions.hover} px-3 py-2 rounded-lg`}
        >
          <Keyboard className={designTokens.icons.standard} />
          <span className={designTokens.text.caption}>Shortcuts</span>
          <kbd className={designTokens.kbd}>?</kbd>
        </button>
      </div>
    </div>
  )
}
