import { BasePresenter } from './base'
import { navigateTo } from '@/utils/navigation'
import type { Task, TaskSource } from '@types'
import { Badge } from '@adi-simple/ui/badge'
import { Circle, CheckCircle2, XCircle, Loader2, Clock } from 'lucide-react'

/**
 * Presenter for Task model
 */
export class TaskPresenter extends BasePresenter<Task> {
  private taskSources?: TaskSource[]
  private onRetrySync?: (task: Task) => Promise<void>
  private onRetryEvaluation?: (task: Task) => Promise<void>
  private onStartProcessing?: (task: Task) => Promise<void>
  private onUpdateStatus?: (task: Task) => Promise<void>

  constructor(
    model: Task,
    taskSources?: TaskSource[],
    callbacks?: {
      onRetrySync?: (task: Task) => Promise<void>
      onRetryEvaluation?: (task: Task) => Promise<void>
      onStartProcessing?: (task: Task) => Promise<void>
      onUpdateStatus?: (task: Task) => Promise<void>
    }
  ) {
    super(model)
    this.taskSources = taskSources
    this.onRetrySync = callbacks?.onRetrySync
    this.onRetryEvaluation = callbacks?.onRetryEvaluation
    this.onStartProcessing = callbacks?.onStartProcessing
    this.onUpdateStatus = callbacks?.onUpdateStatus
  }

  getId(): string {
    return this.model.id
  }

  getTableColumns() {
    return [
      {
        key: 'title',
        label: 'Title',
        render: (task: Task) => (
          <div>
            <div className="font-medium">{task.title}</div>
            <div className="text-xs font-mono text-gray-400">ID: {this.truncateId(task.id)}</div>
          </div>
        ),
        sortable: true,
      },
      {
        key: 'description',
        label: 'Description',
        render: (task: Task) => (
          <span className="max-w-md truncate">{this.truncateText(task.description, 60)}</span>
        ),
        sortable: false,
      },
      {
        key: 'sync_status',
        label: 'Sync',
        render: (task: Task) => {
          const taskSource = this.taskSources?.find((ts) => ts.id === task.task_source_id)
          const status = taskSource?.sync_status || 'pending'
          return this.renderStatusBadge(status)
        },
        sortable: false,
      },
      {
        key: 'simple_evaluation_status',
        label: 'Simple Eval',
        render: (task: Task) => this.renderStatusBadge(task.ai_evaluation_simple_status),
        sortable: false,
      },
      {
        key: 'advanced_evaluation_status',
        label: 'Advanced Eval',
        render: (task: Task) => this.renderStatusBadge(
          task.ai_evaluation_advanced_status ||
          (task.ai_evaluation_simple_status === 'completed' && task.ai_evaluation_simple_verdict === 'ready' ? 'not_started' : 'not_started')
        ),
        sortable: false,
      },
      {
        key: 'implementation_status',
        label: 'Implementation',
        render: (task: Task) => this.renderStatusBadge(task.ai_implementation_status),
        sortable: false,
      },
      {
        key: 'status',
        label: 'Task Status',
        render: (task: Task) => this.renderStatusBadge(task.status),
        sortable: true,
      },
      {
        key: 'remote_status',
        label: 'Remote',
        render: (task: Task) => (
          <Badge variant={task.remote_status === 'opened' ? 'green' : 'gray'} className="text-xs">
            {task.remote_status}
          </Badge>
        ),
        sortable: false,
      },
    ]
  }

  /**
   * Render status badge with appropriate icon and color
   */
  private renderStatusBadge(status: string | null) {
    if (!status) {
      return <Badge variant="gray" icon={Circle}>pending</Badge>
    }

    const statusLower = status.toLowerCase()
    let icon = Circle
    let variant: 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'orange' | 'purple' | 'green' | 'gray' = 'gray'

    if (statusLower === 'completed' || statusLower === 'success') {
      icon = CheckCircle2
      variant = 'green'
    } else if (statusLower === 'failed' || statusLower === 'error') {
      icon = XCircle
      variant = 'danger'
    } else if (statusLower.includes('ing') || statusLower === 'running') {
      icon = Loader2
      variant = 'blue'
    } else if (statusLower === 'queued') {
      icon = Clock
      variant = 'warning'
    } else if (statusLower === 'pending') {
      icon = Clock
      variant = 'gray'
    }

    return (
      <Badge variant={variant} icon={icon} className="text-xs">
        {status}
      </Badge>
    )
  }

  getActions() {
    const actions = []

    // View Details - always available
    actions.push({
      label: 'View',
      onClick: (task: Task) => {
        navigateTo(`/tasks/${task.id}`)
      },
      variant: 'default' as const,
    })

    // Re-evaluate - always available
    if (this.onRetryEvaluation) {
      actions.push({
        label: 'Re-evaluate',
        onClick: async (task: Task) => {
          await this.onRetryEvaluation!(task)
        },
        variant: 'outline' as const,
      })
    }

    // Re-implement - always available
    if (this.onStartProcessing) {
      actions.push({
        label: 'Re-implement',
        onClick: async (task: Task) => {
          await this.onStartProcessing!(task)
        },
        variant: 'outline' as const,
      })
    }

    // Refresh - always available
    if (this.onUpdateStatus) {
      actions.push({
        label: 'Refresh',
        onClick: async (task: Task) => {
          await this.onUpdateStatus!(task)
        },
        variant: 'outline' as const,
      })
    }

    // Retry sync - only show if sync failed
    if (this.onRetrySync) {
      const taskSource = this.taskSources?.find((ts) => ts.id === this.model.task_source_id)
      if (taskSource?.sync_status?.toLowerCase() === 'failed') {
        actions.push({
          label: 'Retry Sync',
          onClick: async (task: Task) => {
            await this.onRetrySync!(task)
          },
          variant: 'outline' as const,
        })
      }
    }

    return actions
  }

  /**
   * Get task source information
   */
  getTaskSourceInfo(taskSourceId: string): { name: string; type: string } {
    const taskSource = this.taskSources?.find((ts) => ts.id === taskSourceId)
    return taskSource ? { name: taskSource.name, type: taskSource.type } : { name: 'Unknown', type: '' }
  }
}
