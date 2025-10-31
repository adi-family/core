import type { ReactNode } from "react";

/**
 * Base presenter abstract class for type-safe model presentation
 */
export abstract class BasePresenter<T> {
  protected model: T
  protected onRefresh?: () => void | Promise<void>

  constructor(model: T, onRefresh?: () => void | Promise<void>) {
    this.model = model
    this.onRefresh = onRefresh
  }

  /**
   * Get table columns configuration
   */
  abstract getTableColumns(): Array<{
    key: string
    label: string
    render: (model: T) => ReactNode
    sortable?: boolean
  }>

  /**
   * Get available actions for the model
   */
  abstract getActions(): Array<{
    label: string
    onClick: (model: T) => void | Promise<void>
    variant?: 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link'
    disabled?: boolean
    loading?: boolean
  }>

  /**
   * Get model identifier
   */
  abstract getId(): string

  /**
   * Format date to locale string
   */
  protected formatDate(date: Date | string | null | undefined): string {
    if (!date) return '-'
    return new Date(date).toLocaleString()
  }

  /**
   * Truncate text with ellipsis
   */
  protected truncateText(text: string | null | undefined, maxLength: number = 50): string {
    if (!text) return '-'
    return text.length > maxLength ? `${text.substring(0, maxLength)}...` : text
  }

  /**
   * Truncate ID for display
   */
  protected truncateId(id: string, length: number = 8): string {
    return `${id.substring(0, length)}...`
  }

  /**
   * Get delete action with confirmation dialog
   */
  protected getDeleteAction(
    confirmMessage: (model: T) => string,
    deleteFn: (model: T) => Promise<void>
  ): {
    label: string
    onClick: (model: T) => Promise<void>
    variant: 'destructive'
  } {
    return {
      label: 'Delete',
      onClick: async (model: T) => {
        if (confirm(confirmMessage(model))) {
          await deleteFn(model)
        }
      },
      variant: 'destructive' as const,
    }
  }
}
