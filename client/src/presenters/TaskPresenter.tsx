import { BasePresenter } from './base'
import type { Task, TaskSource } from '../../../types'
import { Badge } from '@/components/ui/badge'
import { Circle } from 'lucide-react'

/**
 * Presenter for Task model
 */
export class TaskPresenter extends BasePresenter<Task> {
  private taskSources?: TaskSource[]

  constructor(model: Task, taskSources?: TaskSource[]) {
    super(model)
    this.taskSources = taskSources
  }

  getId(): string {
    return this.model.id
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (task: Task) => (
          <span className="font-mono text-xs">{this.truncateId(task.id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'title',
        label: 'Title',
        render: (task: Task) => <span className="font-medium">{task.title}</span>,
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
        key: 'status',
        label: 'Status',
        render: (task: Task) => (
          <Badge variant="default" icon={Circle}>
            {task.status}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'task_source',
        label: 'Task Source',
        render: (task: Task) => {
          const info = this.getTaskSourceInfo(task.task_source_id)
          return (
            <span className="text-sm">
              {info.name}
              {info.type && (
                <span className="ml-1 text-xs text-muted-foreground">({info.type})</span>
              )}
            </span>
          )
        },
        sortable: false,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (task: Task) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(task.created_at)}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'updated_at',
        label: 'Updated At',
        render: (task: Task) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(task.updated_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    return [
      {
        label: 'View Details',
        onClick: (task: Task) => {
          window.location.href = `/tasks/${task.id}`
        },
        variant: 'default' as const,
      },
      {
        label: 'Update Status',
        onClick: async (task: Task) => {
          // TODO: Implement update status
          console.log(`Update task ${task.id} status`)
        },
        variant: 'outline' as const,
      },
      {
        label: 'Delete',
        onClick: async (task: Task) => {
          if (confirm(`Are you sure you want to delete "${task.title}"?`)) {
            // TODO: Implement delete action
            console.log(`Delete task ${task.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }

  /**
   * Get task source information
   */
  getTaskSourceInfo(taskSourceId: string): { name: string; type: string } {
    const taskSource = this.taskSources?.find((ts) => ts.id === taskSourceId)
    return taskSource ? { name: taskSource.name, type: taskSource.type } : { name: 'Unknown', type: '' }
  }
}
