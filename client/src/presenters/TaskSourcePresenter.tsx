import { BasePresenter } from './base'
import type { TaskSource } from '../../../backend/types'

/**
 * Presenter for TaskSource model
 */
export class TaskSourcePresenter extends BasePresenter<TaskSource> {
  getId(): string {
    return this.model.id
  }

  getDisplayTitle(): string {
    return this.model.name
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (taskSource: TaskSource) => (
          <span className="font-mono text-xs">{this.truncateId(taskSource.id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'name',
        label: 'Name',
        render: (taskSource: TaskSource) => <span className="font-medium">{taskSource.name}</span>,
        sortable: true,
      },
      {
        key: 'type',
        label: 'Type',
        render: (taskSource: TaskSource) => (
          <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${this.getTypeBadgeClass(taskSource.type)}`}>
            {taskSource.type}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'status',
        label: 'Status',
        render: (taskSource: TaskSource) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
              taskSource.enabled
                ? 'bg-green-100 text-green-800 ring-green-500/10'
                : 'bg-gray-100 text-gray-800 ring-gray-500/10'
            }`}
          >
            {taskSource.enabled ? 'Enabled' : 'Disabled'}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'project_id',
        label: 'Project ID',
        render: (taskSource: TaskSource) => (
          <span className="font-mono text-xs">{this.truncateId(taskSource.project_id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (taskSource: TaskSource) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(taskSource.created_at)}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'updated_at',
        label: 'Updated At',
        render: (taskSource: TaskSource) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(taskSource.updated_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    return [
      {
        label: 'Sync',
        onClick: async (taskSource: TaskSource) => {
          const { client } = await import('@/lib/client')
          const { toast } = await import('sonner')
          try {
            const res = await client['task-sources'][':id']['sync'].$post({
              param: { id: taskSource.id }
            })
            if (res.ok) {
              toast.success('Sync triggered successfully')
            } else {
              toast.error('Failed to trigger sync')
            }
          } catch (error) {
            console.error('Error syncing task source:', error)
            toast.error('Error syncing task source')
          }
        },
        variant: 'outline' as const,
      },
      {
        label: 'View Details',
        onClick: (taskSource: TaskSource) => {
          window.location.href = `/task-sources/${taskSource.id}`
        },
        variant: 'default' as const,
      },
      {
        label: 'View Project',
        onClick: (taskSource: TaskSource) => {
          window.location.href = `/projects/${taskSource.project_id}`
        },
        variant: 'outline' as const,
      },
      {
        label: this.model.enabled ? 'Disable' : 'Enable',
        onClick: async (taskSource: TaskSource) => {
          // TODO: Implement toggle enabled status
          console.log(`Toggle task source ${taskSource.id} status`)
        },
        variant: 'outline' as const,
      },
      {
        label: 'Delete',
        onClick: async (taskSource: TaskSource) => {
          if (confirm(`Are you sure you want to delete "${taskSource.name}"?`)) {
            // TODO: Implement delete action
            console.log(`Delete task source ${taskSource.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }

  /**
   * Get type badge class based on task source type
   */
  getTypeBadgeClass(type?: 'gitlab_issues' | 'jira' | 'github_issues'): string {
    const sourceType = type ?? this.model.type

    switch (sourceType) {
      case 'gitlab_issues':
        return 'bg-orange-50 text-orange-700 ring-orange-500/10'
      case 'github_issues':
        return 'bg-purple-50 text-purple-700 ring-purple-500/10'
      case 'jira':
        return 'bg-blue-50 text-blue-700 ring-blue-500/10'
      default:
        return 'bg-gray-50 text-gray-700 ring-gray-500/10'
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(): string {
    return this.model.enabled
      ? 'bg-green-100 text-green-800 ring-green-500/10'
      : 'bg-gray-100 text-gray-800 ring-gray-500/10'
  }

  /**
   * Get status text
   */
  getStatusText(): string {
    return this.model.enabled ? 'Enabled' : 'Disabled'
  }

  /**
   * Get task source type
   */
  getType(): 'gitlab_issues' | 'jira' | 'github_issues' {
    return this.model.type
  }

  /**
   * Get project ID
   */
  getProjectId(): string {
    return this.model.project_id
  }

  /**
   * Get config
   */
  getConfig(): unknown {
    return this.model.config
  }

  /**
   * Get formatted config
   */
  getFormattedConfig(): string {
    try {
      return JSON.stringify(this.model.config, null, 2)
    } catch {
      return 'Invalid config'
    }
  }
}
