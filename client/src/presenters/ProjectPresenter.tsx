import { BasePresenter } from './base'
import type { Project } from '../../../backend/types'

/**
 * Presenter for Project model
 */
export class ProjectPresenter extends BasePresenter<Project> {
  private onToggleEnabled?: (project: Project) => Promise<void>
  private togglingProjectId?: string | null

  constructor(
    model: Project,
    onToggleEnabled?: (project: Project) => Promise<void>,
    togglingProjectId?: string | null
  ) {
    super(model)
    this.onToggleEnabled = onToggleEnabled
    this.togglingProjectId = togglingProjectId
  }

  getId(): string {
    return this.model.id
  }

  getDisplayTitle(): string {
    return this.model.name
  }

  getTableColumns() {
    return [
      {
        key: 'name',
        label: 'Name',
        render: (project: Project) => <span className="font-medium">{project.name}</span>,
        sortable: true,
      },
      {
        key: 'status',
        label: 'Status',
        render: (project: Project) => (
          <span
            className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
              project.enabled
                ? 'bg-green-100 text-green-800 ring-green-500/10'
                : 'bg-gray-100 text-gray-800 ring-gray-500/10'
            }`}
          >
            {project.enabled ? 'Enabled' : 'Disabled'}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (project: Project) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(project.created_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    const isToggling = this.togglingProjectId === this.model.id

    return [
      {
        label: 'View Details',
        onClick: (project: Project) => {
          window.location.href = `/projects/${project.id}`
        },
        variant: 'default' as const,
      },
      {
        label: this.model.enabled ? 'Disable' : 'Enable',
        onClick: async (project: Project) => {
          if (this.onToggleEnabled) {
            await this.onToggleEnabled(project)
          }
        },
        variant: 'outline' as const,
        loading: isToggling,
      },
      {
        label: 'Delete',
        onClick: async (project: Project) => {
          if (confirm(`Are you sure you want to delete "${project.name}"?`)) {
            // TODO: Implement delete action
            console.log(`Delete project ${project.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
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
}
