import { BasePresenter } from './base'
import type { TaskSource } from '../../../backend/types'
import { Badge } from '@/components/ui/badge'
import { GitBranch, CheckCircle2, XCircle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { GithubIcon } from '@/components/icons/GithubIcon'

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
   * Get type badge class based on task source type (legacy - use getTypeBadgeVariant)
   */
  getTypeBadgeClass(type?: 'gitlab_issues' | 'jira' | 'github_issues'): string {
    const sourceType = type ?? this.model.type

    switch (sourceType) {
      case 'gitlab_issues':
        return 'bg-orange-50/80 text-orange-700 border-orange-300 hover:bg-orange-100/80'
      case 'github_issues':
        return 'bg-purple-50/80 text-purple-700 border-purple-300 hover:bg-purple-100/80'
      case 'jira':
        return 'bg-blue-50/80 text-blue-700 border-blue-300 hover:bg-blue-100/80'
      default:
        return 'bg-gray-100/80 text-gray-700 border-gray-300 hover:bg-gray-200/80'
    }
  }

  /**
   * Get status badge class
   */
  getStatusBadgeClass(): string {
    return this.model.enabled
      ? 'bg-green-50/80 text-green-700 border-green-300 shadow-sm backdrop-blur-sm'
      : 'bg-gray-100/80 text-gray-700 border-gray-300 shadow-sm backdrop-blur-sm'
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
