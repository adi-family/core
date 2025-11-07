/**
 * Retry Utility
 * Provides retry logic with exponential backoff for operations
 */

import { RETRY_DEFAULTS } from '@adi-simple/config'

export interface RetryOptions {
  maxAttempts?: number
  initialDelayMs?: number
  maxDelayMs?: number
  backoffMultiplier?: number
  onRetry?: (error: Error, attempt: number) => void
}

const DEFAULT_OPTIONS: Required<RetryOptions> = {
  maxAttempts: RETRY_DEFAULTS.maxAttempts,
  initialDelayMs: RETRY_DEFAULTS.initialDelayMs,
  maxDelayMs: RETRY_DEFAULTS.maxDelayMs,
  backoffMultiplier: RETRY_DEFAULTS.backoffMultiplier,
  // eslint-disable-next-line @typescript-eslint/no-empty-function
  onRetry: () => {},
}

/**
 * Retry an async operation with exponential backoff
 */
export async function retry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const opts = { ...DEFAULT_OPTIONS, ...options }
  let lastError: Error

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      if (attempt === opts.maxAttempts) {
        throw lastError
      }

      // Calculate delay with exponential backoff
      const delay = Math.min(
        opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1),
        opts.maxDelayMs
      )

      opts.onRetry(lastError, attempt)

      // Wait before retrying
      await new Promise((resolve) => setTimeout(resolve, delay))
    }
  }

  throw lastError!
}

/**
 * Check if an error is retryable
 */
export function isRetryableError(error: Error): boolean {
  const message = error.message.toLowerCase()

  // Network errors
  if (
    message.includes('econnrefused') ||
    message.includes('enotfound') ||
    message.includes('etimedout') ||
    message.includes('network')
  ) {
    return true
  }

  // HTTP errors (5xx, 429)
  if (
    message.includes('500') ||
    message.includes('502') ||
    message.includes('503') ||
    message.includes('504') ||
    message.includes('429')
  ) {
    return true
  }

  return false
}
