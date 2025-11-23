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
  onDelete?: (task: Task) => void
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
  onDelete,
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
    if (!status) return 'text-neutral-400'

    const statusLower = status.toLowerCase()
    if (statusLower === 'completed' || statusLower === 'success') return 'text-neutral-300'
    if (statusLower === 'failed' || statusLower === 'error') return 'text-neutral-500'
    if (statusLower.includes('ing') || statusLower === 'running') return 'text-neutral-400'
    if (statusLower === 'queued') return 'text-neutral-400'
    if (statusLower === 'pending') return 'text-neutral-400'
    return 'text-neutral-400'
  }

  const getPriorityBadgeColor = (quadrant: string) => {
    if (quadrant === 'quick_win') return 'bg-neutral-400/20 text-neutral-300 border-neutral-400/50'
    if (quadrant === 'major_project') return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/50'
    if (quadrant === 'fill_in') return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/50'
    return 'bg-neutral-500/20 text-neutral-300 border-neutral-500/50'
  }

  const getPriorityLabel = (quadrant: string) => {
    if (quadrant === 'quick_win') return 'Quick Win'
    if (quadrant === 'major_project') return 'Major Project'
    if (quadrant === 'fill_in') return 'Fill In'
    return 'Low Priority'
  }

  const getQuickWinScoreColor = (score: number) => {
    if (score >= 75) return 'text-neutral-300'
    if (score >= 50) return 'text-neutral-400'
    if (score >= 25) return 'text-neutral-500'
    return 'text-neutral-600'
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
    <div className={`border backdrop-blur-xl hover:bg-neutral-800/60 transition-all duration-200 rounded-lg overflow-hidden ${
      isQuickWin
        ? 'border-neutral-500/60 bg-gradient-to-r from-neutral-700/20 via-neutral-800/40 to-neutral-800/40 shadow-lg shadow-neutral-500/10'
        : 'border-neutral-700/50 bg-neutral-800/40'
    }`}>
      {/* Status Bar at Top */}
      <div className="flex flex-wrap gap-4 bg-neutral-900/40 px-4 py-2.5 border-b border-neutral-700/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Simple Eval:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_evaluation_simple_status)}`}>
            {task.ai_evaluation_simple_status || 'not_started'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Advanced Eval:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_evaluation_advanced_status)}`}>
            {task.ai_evaluation_advanced_status || (task.ai_evaluation_simple_status === 'completed' && task.ai_evaluation_simple_verdict === 'ready' ? 'not_started' : 'not_started')}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Impl:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_implementation_status)}`}>
            {task.ai_implementation_status || 'pending'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Task:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.status)}`}>
            {task.status || 'pending'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-neutral-500">Remote:</span>
          <span className={`text-xs font-medium ${task.remote_status === 'opened' ? 'text-neutral-300' : 'text-neutral-400'}`}>
            {task.remote_status}
          </span>
        </div>

        {/* Quick Win Score, Price, and Priority */}
        {metrics && (
          <>
            {expectedPrice && (
              <div className="flex items-center gap-1.5 ml-auto">
                <span className="text-xs text-neutral-400">$</span>
                <span className="text-sm font-bold text-neutral-300">
                  {expectedPrice.toFixed(2)}
                </span>
              </div>
            )}
            <div className="flex items-center gap-1.5">
              <Star className="h-3 w-3 text-neutral-400" />
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
        <div className="flex flex-wrap gap-2 bg-neutral-900/20 px-4 py-2 border-b border-neutral-700/30">
          {metrics.is_ai_blocked && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-700/20 text-neutral-300 border border-neutral-700/50 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Blocked
            </span>
          )}
          {!metrics.is_ai_blocked && metrics.implementation_status.confidence === 'low' && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-300 border border-neutral-500/50 text-xs">
              <AlertTriangle className="h-3 w-3" />
              Low Confidence
            </span>
          )}
          {!metrics.is_ai_blocked && !metrics.implementation_status.can_verify && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-300 border border-neutral-500/50 text-xs">
              <Shield className="h-3 w-3" />
              Can't Test
            </span>
          )}
          {metrics.requires_human_oversight && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-neutral-500/20 text-neutral-300 border border-neutral-500/50 text-xs">
              <Eye className="h-3 w-3" />
              Needs Review
            </span>
          )}
          {task.ai_evaluation_simple_result && (
            <>
              <span className="text-xs text-neutral-400">
                Effort: <span className="text-neutral-200 font-medium">{task.ai_evaluation_simple_result.effort_estimate.toUpperCase()}</span>
              </span>
              <span className="text-xs text-neutral-400">
                Type: <span className="text-neutral-200 font-medium">{task.ai_evaluation_simple_result.task_type.replace('_', ' ')}</span>
              </span>
              <span className="text-xs text-neutral-400">
                Complexity: <span className="text-neutral-200 font-medium">{task.ai_evaluation_simple_result.complexity_score}/100</span>
              </span>
            </>
          )}
        </div>
      )}

      {/* Content */}
      <div className="p-4">
        {/* Header: Title and Key/ID */}
        <div className="flex items-start gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white mb-1 truncate">
              {task.task_key && (
                <span className="text-neutral-400 font-mono mr-2">{task.task_key}</span>
              )}
              {task.title}
            </h3>
            {!task.task_key && (
              <p className="text-xs font-mono text-neutral-400">
                ID: {task.id.substring(0, 8)}...
              </p>
            )}
          </div>
        </div>

        {/* Project and Task Source Info */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {project && (
            <div className="flex items-center gap-1.5 text-neutral-300">
              <Folder className="h-3.5 w-3.5 text-neutral-400" />
              <span>{project.name}</span>
            </div>
          )}
          {taskSource && (
            <div className="flex items-center gap-2">
              {getTaskSourceIcon(taskSource.type)}
              <span className="text-neutral-300">{taskSource.name}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-neutral-300 line-clamp-2 mb-4">
          {task.description}
        </p>

        {/* Action Buttons - Smart display based on task state */}
        <div className="flex flex-wrap gap-2 pt-3 border-t border-neutral-700/30">
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
                  className="bg-neutral-600/90 hover:bg-neutral-600 border-neutral-500/50 shadow-sm shadow-neutral-500/20"
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
                  className="bg-neutral-600/90 hover:bg-neutral-600 border-neutral-500/50 shadow-sm shadow-neutral-500/20"
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
                  className="border-neutral-500/50 text-neutral-300 cursor-not-allowed"
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
                  className="border-neutral-500/50 text-neutral-300 cursor-not-allowed"
                >
                  <Play className="h-3.5 w-3.5 mr-1.5 animate-pulse" />
                  Implementing...
                </Button>
              )
            }

            return null
          })()}

          {/* Delete button - only for manual tasks */}
          {onDelete && task.manual_task_metadata && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task)}
              className="border-neutral-700/50 text-neutral-400 hover:bg-neutral-700/10 hover:border-neutral-600"
            >
              Delete
            </Button>
          )}

          {/* View Details - Always available as secondary action */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewDetails(task)}
            className="border-neutral-600/50 hover:border-neutral-500 hover:bg-neutral-700/40"
          >
            <ExternalLink className="h-3.5 w-3.5 mr-1.5" />
            View Details
          </Button>
        </div>
      </div>
    </div>
  )
}
