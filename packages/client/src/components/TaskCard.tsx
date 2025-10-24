import { Badge } from '@adi-simple/ui/badge'
import { Button } from '@adi-simple/ui/button'
import { Card, CardContent, CardHeader } from '@adi-simple/ui/card'
import { Circle, Calendar, ExternalLink, CheckCircle2, Loader2, XCircle, Clock, RefreshCw } from "lucide-react"
import type { Task, TaskSource } from "@types"
import { navigateTo } from "@/utils/navigation"
import { apiCall } from "@/utils/apiCall"
import { useState } from "react"
import { useAuth } from "@clerk/clerk-react"

interface TaskCardProps {
  task: Task
  taskSources: TaskSource[]
}

/**
 * TaskCard component displays a task in a block/card format with all statuses visible
 */
export function TaskCard({ task, taskSources }: TaskCardProps) {
  const taskSource = taskSources.find((ts) => ts.id === task.task_source_id)
  const [retryingStep, setRetryingStep] = useState<string | null>(null)
  const { getToken } = useAuth()
  const API_BASE = import.meta.env.VITE_API_URL || '/api'

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

  const getStepIcon = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return CheckCircle2
    if (statusLower === "failed" || statusLower === "error") return XCircle
    if (statusLower.includes("ing") || statusLower === "running") return Loader2
    if (statusLower === "queued" || statusLower === "pending") return Clock
    return Circle
  }

  const getStepColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return "text-green-600"
    if (statusLower === "failed" || statusLower === "error") return "text-red-600"
    if (statusLower.includes("ing") || statusLower === "running") return "text-blue-600"
    if (statusLower === "queued") return "text-yellow-600"
    if (statusLower === "pending") return "text-gray-400"
    return "text-gray-400"
  }

  const handleRetrySync = async () => {
    if (!taskSource) return
    setRetryingStep("sync")

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/task-sources/${taskSource.id}/sync`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: () => {
          alert('Sync restarted successfully!')
          window.location.reload()
        },
        onError: (error) => alert(`Failed to restart sync: ${error}`)
      }
    )

    setRetryingStep(null)
  }

  const handleRetryEvaluation = async () => {
    setRetryingStep("evaluation")

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${task.id}/evaluate`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: () => {
          alert('Evaluation restarted successfully!')
          window.location.reload()
        },
        onError: (error) => alert(`Failed to restart evaluation: ${error}`)
      }
    )

    setRetryingStep(null)
  }

  const steps = [
    {
      id: "sync",
      label: "Sync",
      status: taskSource?.sync_status || "pending",
      onRetry: handleRetrySync,
    },
    {
      id: "evaluation",
      label: "Evaluation",
      status: task.ai_evaluation_status,
      onRetry: handleRetryEvaluation,
    },
    {
      id: "task",
      label: "Task",
      status: task.status,
      onRetry: undefined, // No retry action for task status
    },
  ]

  return (
    <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-200 hover:border-accent-teal/40">
      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/60">
        <div className="space-y-3">
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
                {task.title}
              </h3>
              <p className="text-xs font-mono text-gray-500">
                ID: {truncateId(task.id)}
              </p>
            </div>
          </div>

          {/* Step Indicator */}
          <div className="flex items-center justify-between gap-2">
            {steps.map((step, index) => {
              const StepIcon = getStepIcon(step.status)
              const isAnimating = step.status.toLowerCase().includes("ing")
              const isFailed = step.status.toLowerCase() === "failed"
              const isRetrying = retryingStep === step.id

              return (
                <div key={step.label} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1 gap-0.5">
                    <div className={`flex items-center gap-1.5 ${getStepColor(step.status)}`}>
                      <StepIcon
                        className={`h-4 w-4 ${isAnimating ? 'animate-spin' : ''}`}
                      />
                      <span className="text-xs font-medium">{step.label}</span>
                    </div>
                    <span className="text-[10px] text-gray-500">
                      {step.status}
                    </span>
                    {isFailed && step.onRetry && (
                      <button
                        onClick={step.onRetry}
                        disabled={isRetrying}
                        className="flex items-center gap-0.5 text-[10px] text-blue-600 hover:text-blue-800 disabled:opacity-50 mt-0.5"
                        title="Retry this step"
                      >
                        <RefreshCw className={`h-3 w-3 ${isRetrying ? 'animate-spin' : ''}`} />
                        {isRetrying ? 'Retrying...' : 'Retry'}
                      </button>
                    )}
                  </div>
                  {index < steps.length - 1 && (
                    <div className="h-px bg-gray-300 flex-shrink-0 w-4 mx-1" />
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
          <p className="text-sm text-gray-700 line-clamp-2">
            {task.description}
          </p>
        </div>

        {/* Task Source Info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Source:
          </span>
          <span className="text-sm font-medium text-gray-900">
            {taskSource?.name || "Unknown"}
          </span>
          {taskSource?.type && (
            <Badge variant={getTaskSourceTypeVariant(taskSource.type)} className="text-xs">
              {taskSource.type}
            </Badge>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Created
              </p>
              <p className="text-xs text-gray-700 truncate">
                {formatDate(task.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Updated
              </p>
              <p className="text-xs text-gray-700 truncate">
                {formatDate(task.updated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => navigateTo(`/tasks/${task.id}`)}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement update status
              console.log(`Update task ${task.id} status`)
            }}
            className="flex-1"
          >
            Update Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
