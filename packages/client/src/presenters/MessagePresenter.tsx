import { BasePresenter } from './base'
import { navigateTo } from '@/utils/navigation'
import type { Message } from '@types'

/**
 * Presenter for Message model
 */
export class MessagePresenter extends BasePresenter<Message> {
  getId(): string {
    return this.model.id
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
        onClick: async (message: Message) => {
          // TODO: Show modal or navigate to detail view
          console.log('Message data:', message.data)
          const { toast } = await import('sonner')
          toast.info('Message data logged to console')
        },
        variant: 'default' as const,
      },
      {
        label: 'View Session',
        onClick: (message: Message) => {
          navigateTo(`/sessions/${message.session_id}`)
        },
        variant: 'outline' as const,
      },
      this.getDeleteAction(
        (message) => `Are you sure you want to delete message ${this.truncateId(message.id)}?`,
        async (message) => {
          // TODO: Implement delete action
          console.log(`Delete message ${message.id}`)
        }
      ),
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
}
