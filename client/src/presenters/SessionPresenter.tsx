import { BasePresenter } from './base'
import type { Session } from '@types'

/**
 * Presenter for Session model
 */
export class SessionPresenter extends BasePresenter<Session> {
  getId(): string {
    return this.model.id
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (session: Session) => (
          <span className="font-mono text-xs">{this.truncateId(session.id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'task_id',
        label: 'Task ID',
        render: (session: Session) => (
          <span className="font-mono text-xs">
            {session.task_id ? this.truncateId(session.task_id) : '-'}
          </span>
        ),
        sortable: false,
      },
      {
        key: 'runner',
        label: 'Runner',
        render: (session: Session) => <span className="font-medium">{session.runner}</span>,
        sortable: true,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (session: Session) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(session.created_at)}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'updated_at',
        label: 'Updated At',
        render: (session: Session) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(session.updated_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    return [
      {
        label: 'View Messages',
        onClick: (session: Session) => {
          window.location.href = `/sessions/${session.id}/messages`
        },
        variant: 'default' as const,
      },
      {
        label: 'View Task',
        onClick: (session: Session) => {
          if (session.task_id) {
            window.location.href = `/tasks/${session.task_id}`
          }
        },
        variant: 'outline' as const,
        disabled: !this.model.task_id,
      },
      {
        label: 'Delete',
        onClick: async (session: Session) => {
          if (confirm(`Are you sure you want to delete session ${this.truncateId(session.id)}?`)) {
            // TODO: Implement delete action
            console.log(`Delete session ${session.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }
}
