import { BasePresenter } from './base'
import type { TaskSource } from '@types'
import { Badge } from '@/components/ui/badge'
import { GitBranch, CheckCircle2, XCircle, Clock, Loader2, CheckCheck, AlertCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GithubIcon } from '@/components/icons/GithubIcon'

/**
 * Presenter for TaskSource model
 */
export class TaskSourcePresenter extends BasePresenter<TaskSource> {
  getId(): string {
    return this.model.id
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
          <Badge
            variant={this.getTypeBadgeVariant(taskSource.type)}
            icon={this.getTypeBadgeIcon(taskSource.type)}
          >
            {taskSource.type}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'status',
        label: 'Status',
        render: (taskSource: TaskSource) => (
          <Badge
            variant={taskSource.enabled ? 'success' : 'gray'}
            icon={taskSource.enabled ? CheckCircle2 : XCircle}
          >
            {taskSource.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'sync_status',
        label: 'Sync Status',
        render: (taskSource: TaskSource) => (
          <Badge
            variant={this.getSyncStatusVariant(taskSource.sync_status)}
            icon={this.getSyncStatusIcon(taskSource.sync_status)}
          >
            {this.formatSyncStatus(taskSource.sync_status)}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'last_synced_at',
        label: 'Last Synced',
        render: (taskSource: TaskSource) => (
          <span className="text-muted-foreground text-sm">
            {taskSource.last_synced_at ? this.formatDate(taskSource.last_synced_at) : 'Never'}
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
        label: 'Delete',
        onClick: async (taskSource: TaskSource) => {
          if (confirm(`Are you sure you want to delete "${taskSource.name}"?`)) {
            const { client } = await import('@/lib/client')
            const { toast } = await import('sonner')
            try {
              const res = await client['task-sources'][':id'].$delete({
                param: { id: taskSource.id }
              })
              if (res.ok) {
                toast.success('Task source deleted successfully')
                window.location.reload()
              } else {
                toast.error('Failed to delete task source')
              }
            } catch (error) {
              console.error('Error deleting task source:', error)
              toast.error('Error deleting task source')
            }
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }

  /**
   * Get type badge variant based on task source type
   */
  getTypeBadgeVariant(type?: 'gitlab_issues' | 'jira' | 'github_issues'): 'orange' | 'purple' | 'blue' | 'gray' {
    const sourceType = type ?? this.model.type

    switch (sourceType) {
      case 'gitlab_issues':
        return 'orange'
      case 'github_issues':
        return 'purple'
      case 'jira':
        return 'blue'
      default:
        return 'gray'
    }
  }

  /**
   * Get type badge icon based on task source type
   */
  getTypeBadgeIcon(type?: 'gitlab_issues' | 'jira' | 'github_issues'): LucideIcon | typeof GithubIcon {
    const sourceType = type ?? this.model.type

    switch (sourceType) {
      case 'gitlab_issues':
        return GitBranch
      case 'github_issues':
        return GithubIcon
      case 'jira':
        return GitBranch
      default:
        return GitBranch
    }
  }

  /**
   * Get sync status badge variant
   */
  getSyncStatusVariant(status: string): 'success' | 'warning' | 'blue' | 'gray' | 'danger' {
    switch (status) {
      case 'completed':
        return 'success'
      case 'syncing':
        return 'blue'
      case 'queued':
        return 'warning'
      case 'failed':
        return 'danger'
      case 'pending':
      default:
        return 'gray'
    }
  }

  /**
   * Get sync status icon
   */
  getSyncStatusIcon(status: string): LucideIcon {
    switch (status) {
      case 'completed':
        return CheckCheck
      case 'syncing':
        return Loader2
      case 'queued':
        return Clock
      case 'failed':
        return AlertCircle
      case 'pending':
      default:
        return Clock
    }
  }

  /**
   * Format sync status for display
   */
  formatSyncStatus(status: string): string {
    return status.charAt(0).toUpperCase() + status.slice(1)
  }
}
