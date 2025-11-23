/**
 * Status color mapping utilities for badges and status indicators
 * Grayscale theme - all variants map to neutral shades
 */

export type BadgeVariant = 'default' | 'light' | 'medium' | 'dark' | 'white'

export const TASK_SOURCE_STATUS_COLORS: Record<string, BadgeVariant> = {
  pending: 'medium',
  connected: 'white',
  disconnected: 'dark',
  error: 'dark',
  syncing: 'medium',
  idle: 'default',
}

export const PIPELINE_STATUS_COLORS: Record<string, BadgeVariant> = {
  pending: 'medium',
  running: 'medium',
  success: 'white',
  failed: 'dark',
  canceled: 'default',
}

export const GENERIC_STATUS_COLORS: Record<string, BadgeVariant> = {
  active: 'white',
  inactive: 'default',
  error: 'dark',
  warning: 'medium',
  pending: 'medium',
  success: 'white',
  failed: 'dark',
  running: 'medium',
  canceled: 'default',
}

/**
 * Get badge variant for a given status
 */
export function getStatusColor(status: string, mapping: Record<string, BadgeVariant> = GENERIC_STATUS_COLORS): BadgeVariant {
  return mapping[status.toLowerCase()] ?? 'default'
}
