import { BasePresenter } from './base'
import type { Message } from '../../../backend/types'

/**
 * Presenter for Message model
 */
export class MessagePresenter extends BasePresenter<Message> {
  getId(): string {
    return this.model.id
  }

  getDisplayTitle(): string {
    return `Message ${this.truncateId(this.model.id)}`
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (message: Message) => (
          <span className="font-mono text-xs">{this.truncateId(message.id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'session_id',
        label: 'Session ID',
        render: (message: Message) => (
          <span className="font-mono text-xs">{this.truncateId(message.session_id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'data',
        label: 'Data Preview',
        render: (message: Message) => (
          <span className="max-w-md truncate font-mono text-xs">
            {this.formatDataPreview(message.data)}
          </span>
        ),
        sortable: false,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (message: Message) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(message.created_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    return [
      {
        label: 'View Full Data',
        onClick: (message: Message) => {
          // TODO: Show modal or navigate to detail view
          console.log('Message data:', message.data)
          alert(JSON.stringify(message.data, null, 2))
        },
        variant: 'default' as const,
      },
      {
        label: 'View Session',
        onClick: (message: Message) => {
          window.location.href = `/sessions/${message.session_id}`
        },
        variant: 'outline' as const,
      },
      {
        label: 'Delete',
        onClick: async (message: Message) => {
          if (confirm(`Are you sure you want to delete message ${this.truncateId(message.id)}?`)) {
            // TODO: Implement delete action
            console.log(`Delete message ${message.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }

  /**
   * Format data preview for display
   */
  formatDataPreview(data: unknown): string {
    if (data === null || data === undefined) return '-'

    try {
      const jsonStr = JSON.stringify(data)
      return this.truncateText(jsonStr, 100)
    } catch {
      return 'Invalid data'
    }
  }

  /**
   * Get formatted JSON data
   */
  getFormattedData(): string {
    try {
      return JSON.stringify(this.model.data, null, 2)
    } catch {
      return 'Invalid JSON data'
    }
  }

  /**
   * Get session ID
   */
  getSessionId(): string {
    return this.model.session_id
  }

  /**
   * Get raw data
   */
  getData(): unknown {
    return this.model.data
  }
}
