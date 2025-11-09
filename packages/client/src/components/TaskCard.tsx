import { TaskCard as UITaskCard } from '@adi-simple/ui/task-card'
import type { Task, TaskSource } from "@types"
import { navigateTo } from "@/utils/navigation"
import { apiCall } from "@/utils/apiCall"
import { useAuth } from "@clerk/clerk-react"
import { toast } from "sonner"
import { createAuthenticatedClient } from "@/lib/client"
import { deleteTask } from "@/stores/tasks"

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

  const handleDelete = async (taskId: string) => {
    if (!confirm('Are you sure you want to delete this task? This action cannot be undone.')) {
      return
    }

    try {
      const client = createAuthenticatedClient(getToken)
      await deleteTask(client, taskId)
      toast.success('Task deleted successfully!')
      if (onRefresh) {
        await onRefresh()
      }
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Failed to delete task')
    }
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
      onDelete={handleDelete}
    />
  )
}
