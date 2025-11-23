import { Badge } from './badge'
import { Button } from './button'
import { Card, CardContent, CardHeader } from './card'
import { Circle, Calendar, ExternalLink, CheckCircle2, Loader2, XCircle, Clock, RefreshCw } from "lucide-react"
import type { Task, TaskSource } from "@adi-simple/types"

interface TaskCardProps {
  task: Task
  taskSource?: TaskSource
  onViewDetails?: (taskId: string) => void
  onUpdateStatus?: (taskId: string) => void
  onRetrySync?: () => Promise<void>
  onRetryEvaluation?: () => Promise<void>
  onStartProcessing?: () => Promise<void>
  onDelete?: (taskId: string) => Promise<void>
}

/**
 * TaskCard component displays a task in a block/card format with all statuses visible
 */
export function TaskCard({
  task,
  taskSource,
  onViewDetails,
  onUpdateStatus,
  onRetrySync,
  onRetryEvaluation,
  onStartProcessing,
  onDelete
}: TaskCardProps) {
  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const truncateId = (id: string) => {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id
  }

  const getTaskSourceTypeVariant = (type: string) => {
    const typeLower = type.toLowerCase()
    if (typeLower === "gitlab") return "orange"
    if (typeLower === "github") return "purple"
    if (typeLower === "jira") return "blue"
    return "gray"
  }

  const getStepIcon = (status: string | null) => {
    if (!status) return Circle
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return CheckCircle2
    if (statusLower === "failed" || statusLower === "error") return XCircle
    if (statusLower.includes("ing") || statusLower === "running") return Loader2
    if (statusLower === "queued" || statusLower === "pending") return Clock
    return Circle
  }

  const getStepColor = (status: string | null) => {
    if (!status) return "text-gray-400"
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return "text-green-400"
    if (statusLower === "failed" || statusLower === "error") return "text-red-400"
    if (statusLower.includes("ing") || statusLower === "running") return "text-blue-400"
    if (statusLower === "queued") return "text-yellow-400"
    if (statusLower === "pending") return "text-gray-400"
    return "text-gray-400"
  }

  const getRemoteStatusVariant = (status: 'opened' | 'closed') => {
    return status === 'opened' ? 'green' : 'gray'
  }

  const steps = [
    {
      id: "sync",
      label: "Sync",
      status: taskSource?.sync_status || "pending",
      onRetry: onRetrySync,
    },
    {
      id: "simple_eval",
      label: "Simple Eval",
      status: task.ai_evaluation_simple_status,
      onRetry: onRetryEvaluation,
    },
    {
      id: "advanced_eval",
      label: "Advanced Eval",
      status: task.ai_evaluation_advanced_status || (task.ai_evaluation_simple_status === 'completed' && task.ai_evaluation_simple_verdict === 'ready' ? "not_started" : "not_started"),
      onRetry: undefined,
    },
    {
      id: "implementation",
      label: "Impl",
      status: task.ai_implementation_status,
      onRetry: undefined, // No retry action for implementation (use button instead)
    },
    {
      id: "task",
      label: "Task",
      status: task.status,
      onRetry: undefined, // No retry action for task status
    },
  ]

  return (
    <Card className="border-neutral-700/50 bg-neutral-800/40 backdrop-blur-xl shadow-2xl hover:shadow-blue-500/10 transition-all duration-200 hover:border-neutral-600/60">
      <CardHeader className="pb-3 bg-gradient-to-r from-neutral-700/30 to-neutral-800/30 border-b border-neutral-700/50">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white mb-1 truncate">
                {task.title}
              </h3>
              <p className="text-xs font-mono text-gray-400">
                ID: {truncateId(task.id)}
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between gap-2">
            {steps.map((step, index) => {
              const StepIcon = getStepIcon(step.status)
              const isAnimating = step.status?.toLowerCase().includes("ing") || false
              const isFailed = step.status?.toLowerCase() === "failed"

              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1 gap-0.5">
                    <div className={`flex items-center gap-1.5 ${getStepColor(step.status)}`}>
                      <StepIcon
                        className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`}
                      />
                      <span className="text-xs font-medium">{step.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-400">
                      {step.status}
                    </span>
                    {isFailed && step.onRetry && (
                      <button
                        onClick={step.onRetry}
                        className="flex items-center gap-0.5 text-[10px] text-blue-400 hover:text-blue-300 disabled:opacity-50 mt-0.5"
                        title="Retry this step"
                      >
                        <RefreshCw className="h-3 w-3" />
                        Retry
                      </button>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="h-px bg-neutral-600 flex-shrink-0 w-4 mx-1" />
                  )}
                </div>
              )
            })}
          </div>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm text-gray-200 line-clamp-2">
            {task.description}
          </p>
        </div>

        {/* Task Source Info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-400 uppercase tracking-wide">
            Source:
          </span>
          <span className="text-sm font-medium text-white">
            {taskSource?.name || "Unknown"}
          </span>
          {taskSource?.type && (
            <Badge variant={getTaskSourceTypeVariant(taskSource.type)} className="text-xs">
              {taskSource.type}
            </Badge>
          )}
          <Badge variant={getRemoteStatusVariant(task.remote_status)} className="text-xs">
            {task.remote_status}
          </Badge>
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-neutral-700/50">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Created
              </p>
              <p className="text-xs text-gray-200 truncate">
                {formatDate(task.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-500 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-400 uppercase tracking-wide">
                Updated
              </p>
              <p className="text-xs text-gray-200 truncate">
                {formatDate(task.updated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          {/* Delete button - only for manual tasks */}
          {onDelete && task.manual_task_metadata && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onDelete(task.id)}
              className="flex-1 border-red-500/50 text-red-400 hover:bg-red-500/10 hover:border-red-400"
            >
              Delete
            </Button>
          )}
          {/* Re-evaluate button - always shown */}
          {onRetryEvaluation && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetryEvaluation}
              className="flex-1 border-purple-500/50 text-purple-400 hover:bg-purple-500/10 hover:border-purple-400"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Re-evaluate
            </Button>
          )}
          {/* Re-implement button - always shown */}
          {onStartProcessing && (
            <Button
              variant="outline"
              size="sm"
              onClick={onStartProcessing}
              className="flex-1 border-teal-500/50 text-teal-400 hover:bg-teal-500/10 hover:border-teal-400"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Re-implement
            </Button>
          )}
          {onViewDetails && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onViewDetails(task.id)}
              className="flex-1"
            >
              <ExternalLink className="h-4 w-4 mr-1" />
              View Details
            </Button>
          )}
          {onUpdateStatus && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onUpdateStatus(task.id)}
              className="flex-1"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Refresh
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
