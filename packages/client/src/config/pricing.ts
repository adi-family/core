/**
 * Platform Pricing Configuration
 * Constants for pricing tokens and CI time
 */

// CONSTANT PRICING - NOT CONFIGURABLE
export const PRICING = {
  PER_MILLION_TOKENS: 1.00,           // $1.00 per 1M tokens
  PER_CI_HOUR: 0.07777777777          // $0.07777777777 per hour
} as const

export interface ApiUsageMetric {
  id: string
  session_id: string
  task_id: string
  provider: string
  model: string
  goal: string
  operation_phase: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  ci_duration_seconds: number
  iteration_number?: number
  created_at: string
}

export interface CostBreakdown {
  tokenCost: number
  ciCost: number
  totalCost: number
  totalTokens: number
  ciHours: number
}

/**
 * Calculate cost for a single API usage metric
 */
export function calculateCost(usage: ApiUsageMetric): number {
  const { tokenCost, ciCost } = calculateCostBreakdown(usage)
  return tokenCost + ciCost
}

/**
 * Calculate detailed cost breakdown
 */
export function calculateCostBreakdown(usage: ApiUsageMetric): CostBreakdown {
  const totalTokens =
    usage.input_tokens +
    usage.output_tokens +
    (usage.cache_creation_input_tokens || 0) +
    (usage.cache_read_input_tokens || 0)

  // Token cost: tokens × $1.00/1M
  const tokenCost = (totalTokens / 1_000_000) * PRICING.PER_MILLION_TOKENS

  // CI cost: seconds × $0.0778/hour
  const ciHours = usage.ci_duration_seconds / 3600
  const ciCost = ciHours * PRICING.PER_CI_HOUR

  return {
    tokenCost,
    ciCost,
    totalCost: tokenCost + ciCost,
    totalTokens,
    ciHours
  }
}

/**
 * Format cost as USD currency
 */
export function formatCost(cost: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 2,
    maximumFractionDigits: 4
  }).format(cost)
}

/**
 * Format number with commas
 */
export function formatNumber(num: number): string {
  return new Intl.NumberFormat('en-US').format(num)
}

/**
 * Format tokens in K or M notation
 */
export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) {
    return `${(tokens / 1_000_000).toFixed(2)}M`
  } else if (tokens >= 1_000) {
    return `${(tokens / 1_000).toFixed(1)}K`
  }
  return tokens.toString()
}

/**
 * Format duration in hours and minutes
 */
export function formatDuration(seconds: number): string {
  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = seconds % 60

  if (hours > 0) {
    return `${hours}h ${minutes}m`
  } else if (minutes > 0) {
    return `${minutes}m ${secs}s`
  }
  return `${secs}s`
}
