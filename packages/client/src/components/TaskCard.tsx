import { TaskCard as UITaskCard } from '@adi-simple/ui/task-card'
import type { Task, TaskSource } from "@types"
import { navigateTo } from "@/utils/navigation"
import { apiCall } from "@/utils/apiCall"
import { useAuth } from "@clerk/clerk-react"
import { toast } from "sonner"

interface TaskCardProps {
  task: Task
  taskSources: TaskSource[]
  onRefresh?: () => void | Promise<void>
}

/**
 * TaskCard wrapper component that connects UI TaskCard with client-specific logic
 */
export function TaskCard({ task, taskSources, onRefresh }: TaskCardProps) {
  const taskSource = taskSources.find((ts) => ts.id === task.task_source_id)
  const { getToken } = useAuth()
  const API_BASE = import.meta.env.VITE_API_URL || '/api'

  const handleRetrySync = async () => {
    if (!taskSource) return

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
        onSuccess: async () => {
          toast.success('Sync restarted successfully!')
          if (onRefresh) {
            await onRefresh()
          }
        },
        onError: (error) => toast.error(`Failed to restart sync: ${error}`)
      }
    )
  }

  const handleRetryEvaluation = async () => {
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
        onSuccess: async () => {
          toast.success('Evaluation restarted successfully!')
          if (onRefresh) {
            await onRefresh()
          }
        },
        onError: (error) => toast.error(`Failed to restart evaluation: ${error}`)
      }
    )
  }

  const handleStartProcessing = async () => {
    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${task.id}/implement`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Task implementation started successfully!')
          if (onRefresh) {
            await onRefresh()
          }
        },
        onError: (error) => toast.error(`Failed to start task implementation: ${error}`)
      }
    )
  }

  const handleViewDetails = (taskId: string) => {
    navigateTo(`/tasks/${taskId}`)
  }

  const handleUpdateStatus = async (taskId: string) => {
    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${taskId}/refresh`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Task refreshed successfully!')
          if (onRefresh) {
            await onRefresh()
          }
        },
        onError: (error) => toast.error(`Failed to refresh task: ${error}`)
      }
    )
  }

  return (
    <UITaskCard
      task={task}
      taskSource={taskSource}
      onViewDetails={handleViewDetails}
      onUpdateStatus={handleUpdateStatus}
      onRetrySync={handleRetrySync}
      onRetryEvaluation={handleRetryEvaluation}
      onStartProcessing={handleStartProcessing}
    />
  )
}
