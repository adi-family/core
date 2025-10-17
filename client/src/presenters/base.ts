/**
 * Base presenter abstract class for type-safe model presentation
 */
export abstract class BasePresenter<T> {
  protected model: T

  constructor(model: T) {
    this.model = model
  }

  /**
   * Get raw model data
   */
  getRawModel(): T {
    return this.model
  }

  /**
   * Get table columns configuration
   */
  abstract getTableColumns(): Array<{
    key: string
    label: string
    render: (model: T) => React.ReactNode
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
  }>

  /**
   * Get model identifier
   */
  abstract getId(): string

  /**
   * Get display title for the model
   */
  abstract getDisplayTitle(): string

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
}
