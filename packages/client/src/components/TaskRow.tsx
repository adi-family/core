import { Button } from '@adi-simple/ui/button'
import { ExternalLink, Folder, GitBranch, Star, AlertTriangle, Shield, Eye, Play, Zap } from "lucide-react"
import { siJira, siGitlab, siGithub } from 'simple-icons'
import { getComputedMetrics } from '@adi-simple/shared/task-scoring'
import type { Task } from '@adi/api-contracts'
import type { Project, TaskSource } from '@types'

/**
 * SimpleIcon component to render simple-icons SVG icons
 */
const SimpleIcon = ({ icon, size = 16, color }: { icon: typeof siJira; size?: number; color?: string }) => (
  <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={color || `#${icon.hex}`} className="shrink-0">
    <path d={icon.path} />
  </svg>
)

interface TaskRowProps {
  task: Task
  taskSource?: TaskSource
  project?: Project
  onViewDetails: (task: Task) => void
  onStartImplementation?: (task: Task) => void
  onEvaluate?: (task: Task) => void
}

/**
 * Calculate expected price based on task complexity and effort
 */
const calculateExpectedPrice = (complexity: number, effort: string): number => {
  // Base price from complexity (0-100 -> $0.20-$2.20)
  const complexityPrice = 0.20 + (complexity / 100) * 2.00

  // Effort multiplier - maps to effort_estimate values (xs, s, m, l, xl)
  const effortMultipliers: Record<string, number> = {
    'xs': 0.3,      // Extra small: 30% of base
    's': 0.5,       // Small: 50% of base
    'm': 1.0,       // Medium: 100% of base
    'l': 1.5,       // Large: 150% of base
    'xl': 2.0,      // Extra large: 200% of base
  }

  const multiplier = effortMultipliers[effort.toLowerCase()] || 1.0
  const finalPrice = complexityPrice * multiplier

  // Clamp between $0.05 and $3.00
  return Math.max(0.05, Math.min(3.00, finalPrice))
}

/**
 * TaskRow component displays a task in a compact row format
 */
export function TaskRow({
  task,
  taskSource,
  project,
  onViewDetails,
  onStartImplementation,
  onEvaluate,
}: TaskRowProps) {
  // Compute metrics from evaluation result
  const metrics = task.ai_evaluation_simple_result
    ? getComputedMetrics(task.ai_evaluation_simple_result)
    : null

  // Calculate expected price for evaluated tasks
  const expectedPrice = task.ai_evaluation_simple_result
    ? calculateExpectedPrice(
        task.ai_evaluation_simple_result.complexity_score,
        task.ai_evaluation_simple_result.effort_estimate
      )
    : null

  // Check if this is a quick win task
  const isQuickWin = metrics?.priority_quadrant === 'quick_win'

  const getStatusColor = (status: string | null) => {
    if (!status) return 'text-gray-400'

    const statusLower = status.toLowerCase()
    if (statusLower === 'completed' || statusLower === 'success') return 'text-green-400'
    if (statusLower === 'failed' || statusLower === 'error') return 'text-red-400'
    if (statusLower.includes('ing') || statusLower === 'running') return 'text-blue-400'
    if (statusLower === 'queued') return 'text-yellow-400'
    if (statusLower === 'pending') return 'text-gray-400'
    return 'text-gray-400'
  }

  const getPriorityBadgeColor = (quadrant: string) => {
    if (quadrant === 'quick_win') return 'bg-green-500/20 text-green-300 border-green-500/50'
    if (quadrant === 'major_project') return 'bg-blue-500/20 text-blue-300 border-blue-500/50'
    if (quadrant === 'fill_in') return 'bg-yellow-500/20 text-yellow-300 border-yellow-500/50'
    return 'bg-gray-500/20 text-gray-300 border-gray-500/50'
  }

  const getPriorityLabel = (quadrant: string) => {
    if (quadrant === 'quick_win') return 'Quick Win'
    if (quadrant === 'major_project') return 'Major Project'
    if (quadrant === 'fill_in') return 'Fill In'
    return 'Low Priority'
  }

  const getQuickWinScoreColor = (score: number) => {
    if (score >= 75) return 'text-green-400'
    if (score >= 50) return 'text-yellow-400'
    if (score >= 25) return 'text-orange-400'
    return 'text-red-400'
  }

  const getTaskSourceIcon = (type: string) => {
    const typeLower = type.toLowerCase()
    if (typeLower === 'gitlab_issues' || typeLower === 'gitlab') {
      return <SimpleIcon icon={siGitlab} size={16} />
    }
    if (typeLower === 'github_issues' || typeLower === 'github') {
      return <SimpleIcon icon={siGithub} size={16} color="#ffffff" />
    }
    if (typeLower === 'jira') {
      return <SimpleIcon icon={siJira} size={16} />
    }
    return <GitBranch className="h-4 w-4" />
  }

  return (
    <div className={`border backdrop-blur-xl hover:bg-slate-800/60 transition-all duration-200 rounded-lg overflow-hidden ${
      isQuickWin
        ? 'border-green-500/60 bg-gradient-to-r from-green-900/20 via-slate-800/40 to-slate-800/40 shadow-lg shadow-green-500/10'
        : 'border-slate-700/50 bg-slate-800/40'
    }`}>
      {/* Status Bar at Top */}
      <div className="flex flex-wrap gap-4 bg-slate-900/40 px-4 py-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Simple Eval:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_evaluation_simple_status)}`}>
            {task.ai_evaluation_simple_status || 'not_started'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Advanced Eval:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_evaluation_advanced_status)}`}>
            {task.ai_evaluation_advanced_status || (task.ai_evaluation_simple_status === 'completed' && task.ai_evaluation_simple_verdict === 'ready' ? 'not_started' : 'not_started')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Impl:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_implementation_status)}`}>
            {task.ai_implementation_status || 'pending'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Task:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.status)}`}>
            {task.status || 'pending'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Remote:</span>
          <span className={`text-xs font-medium ${task.remote_status === 'opened' ? 'text-green-400' : 'text-gray-400'}`}>
            {task.remote_status}
          </span>
        </div>

        {/* Quick Win Score, Price, and Priority */}
        {metrics && (
          <>
            {expectedPrice && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-gray-400">$</span>
                <span className="text-sm font-bold text-green-400">
                  {expectedPrice.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Star className="h-3 w-3 text-yellow-400" />
              <span className={`text-xs font-bold ${getQuickWinScoreColor(metrics.quick_win_score)}`}>
                {metrics.quick_win_score}
              </span>
            </div>
            <div className={`px-2 py-0.5 rounded-full border text-xs font-medium ${getPriorityBadgeColor(metrics.priority_quadrant)}`}>
              {getPriorityLabel(metrics.priority_quadrant)}
            </div>
          </>
        )}
      </div>

      {/* Evaluation Badges */}
      {metrics && (
        <div className="flex flex-wrap gap-2 bg-slate-900/20 px-4 py-2 border-b border-slate-700/30">
          {metrics.is_ai_blocked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/20 text-red-300 border border-red-500/50 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Blocked
            </span>
          )}
          {!metrics.is_ai_blocked && metrics.implementation_status.confidence === 'low' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-orange-500/20 text-orange-300 border border-orange-500/50 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Low Confidence
            </span>
          )}
          {!metrics.is_ai_blocked && !metrics.implementation_status.can_verify && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-300 border border-blue-500/50 text-xs">
              <Shield className="h-3 w-3" />
              Can't Test
            </span>
          )}
          {metrics.requires_human_oversight && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-300 border border-purple-500/50 text-xs">
              <Eye className="h-3 w-3" />
              Needs Review
            </span>
          )}
          {task.ai_evaluation_simple_result && (
            <>
              <span className="text-xs text-gray-400">
                Effort: <span className="text-gray-200 font-medium">{task.ai_evaluation_simple_result.effort_estimate.toUpperCase()}</span>
              </span>
              <span className="text-xs text-gray-400">
                Type: <span className="text-gray-200 font-medium">{task.ai_evaluation_simple_result.task_type.replace('_', ' ')}</span>
              </span>
              <span className="text-xs text-gray-400">
                Complexity: <span className="text-gray-200 font-medium">{task.ai_evaluation_simple_result.complexity_score}/100</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header: Title and ID */}
        <div className="flex items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white mb-1 truncate">
              {task.title}
            </h3>
            <p className="text-xs font-mono text-gray-400">
              ID: {task.id.substring(0, 8)}...
            </p>
          </div>
        </div>

        {/* Project and Task Source Info */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {project && (
            <div className="flex items-center gap-1.5 text-gray-300">
              <Folder className="h-3.5 w-3.5 text-gray-400" />
              <span>{project.name}</span>
            </div>
          )}
          {taskSource && (
            <div className="flex items-center gap-2">
              {getTaskSourceIcon(taskSource.type)}
              <span className="text-gray-300">{taskSource.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-gray-300 line-clamp-2 mb-4">
          {task.description}
        </p>

        {/* Action Buttons - Smart display based on task state */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-slate-700/30">
          {/* Primary Action - Contextual based on state */}
          {(() => {
            const isEvaluated = task.ai_evaluation_simple_status === 'completed'
            const isEvaluating = task.ai_evaluation_simple_status === 'evaluating' || task.ai_evaluation_simple_status === 'queued'
            const isImplementing = task.ai_implementation_status === 'implementing' || task.ai_implementation_status === 'queued'
            const isImplemented = task.ai_implementation_status === 'completed'

            // Show Evaluate as primary action if not evaluated and not currently evaluating
            if (!isEvaluated && !isEvaluating && onEvaluate) {
              return (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onEvaluate(task)}
                  className="bg-blue-600/90 hover:bg-blue-600 border-blue-500/50 shadow-sm shadow-blue-500/20"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5" />
                  Evaluate Task
                </Button>
              )
            }

            // Show Start Implementation if evaluated but not implemented and not currently implementing
            if (isEvaluated && !isImplemented && !isImplementing && onStartImplementation) {
              return (
                <Button
                  variant="default"
                  size="sm"
                  onClick={() => onStartImplementation(task)}
                  className="bg-emerald-600/90 hover:bg-emerald-600 border-emerald-500/50 shadow-sm shadow-emerald-500/20"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5" />
                  Start Implementation
                </Button>
              )
            }

            // Show status indicators for running tasks
            if (isEvaluating) {
              return (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="border-blue-500/50 text-blue-300 cursor-not-allowed"
                >
                  <Zap className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                  Evaluating...
                </Button>
              )
            }

            if (isImplementing) {
              return (
                <Button
                  variant="outline"
                  size="sm"
                  disabled
                  className="border-emerald-500/50 text-emerald-300 cursor-not-allowed"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                  Implementing...
                </Button>
              )
            }

            return null
          })()}

          {/* View Details - Always available as secondary action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(task)}
            className="border-slate-600/50 hover:border-slate-500 hover:bg-slate-700/40"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  )
}
