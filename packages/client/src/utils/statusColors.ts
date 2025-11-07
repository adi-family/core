/**
 * Status color mapping utilities for badges and status indicators
 */

export type BadgeVariant = 'default' | 'success' | 'warning' | 'danger' | 'info' | 'blue' | 'orange' | 'purple' | 'green' | 'gray'

export const TASK_SOURCE_STATUS_COLORS: Record<string, BadgeVariant> = {
  pending: 'warning',
  connected: 'success',
  disconnected: 'danger',
  error: 'danger',
  syncing: 'blue',
  idle: 'gray',
}

export const PIPELINE_STATUS_COLORS: Record<string, BadgeVariant> = {
  pending: 'warning',
  running: 'blue',
  success: 'success',
  failed: 'danger',
  canceled: 'gray',
}

export const GENERIC_STATUS_COLORS: Record<string, BadgeVariant> = {
  active: 'success',
  inactive: 'gray',
  error: 'danger',
  warning: 'warning',
  pending: 'warning',
  success: 'success',
  failed: 'danger',
  running: 'blue',
  canceled: 'gray',
}

/**
 * Get badge variant for a given status
 */
export function getStatusColor(status: string, mapping: Record<string, BadgeVariant> = GENERIC_STATUS_COLORS): BadgeVariant {
  return mapping[status.toLowerCase()] ?? 'default'
}
