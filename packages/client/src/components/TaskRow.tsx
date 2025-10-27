import { Button } from '@adi-simple/ui/button'
import { ExternalLink, Folder, GitBranch, Star, AlertTriangle, Shield, Eye } from "lucide-react"
import { siJira, siGitlab, siGithub } from 'simple-icons'
import type { Task, TaskSource, Project } from "@types"
import { getComputedMetrics } from '@adi-simple/shared/task-scoring'

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
}

/**
 * TaskRow component displays a task in a compact row format
 */
export function TaskRow({
  task,
  taskSource,
  project,
  onViewDetails,
}: TaskRowProps) {
  // Compute metrics from evaluation result
  const metrics = task.ai_evaluation_simple_result
    ? getComputedMetrics(task.ai_evaluation_simple_result)
    : null

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
    <div className="border border-slate-700/50 bg-slate-800/40 backdrop-blur-xl hover:bg-slate-800/60 transition-all duration-200 rounded-lg overflow-hidden">
      {/* Status Bar at Top */}
      <div className="flex flex-wrap gap-4 bg-slate-900/40 px-4 py-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Eval:</span>
          <span className={`text-xs font-medium ${getStatusColor(task.ai_evaluation_status)}`}>
            {task.ai_evaluation_status || 'pending'}
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

        {/* Quick Win Score and Priority */}
        {metrics && (
          <>
            <div className="flex items-center gap-1.5 ml-auto">
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
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <h3 className="text-base font-semibold text-white mb-1 truncate">
              {task.title}
            </h3>
            <p className="text-xs font-mono text-gray-400">
              ID: {task.id.substring(0, 8)}...
            </p>
          </div>
          <Button
            variant="default"
            size="sm"
            onClick={() => onViewDetails(task)}
            className="shrink-0"
          >
            <ExternalLink className="h-3 w-3 mr-1" />
            View
          </Button>
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
        <p className="text-sm text-gray-300 line-clamp-2">
          {task.description}
        </p>
      </div>
    </div>
  )
}
