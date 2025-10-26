/**
 * Environment variable validation utilities
 */

import { createLogger } from './logger'

const logger = createLogger({ namespace: 'env-validator' })

/**
 * Validates that required environment variables are set
 * @param required - Array of environment variable names to validate
 * @returns Object with validated environment variable values
 * @throws Error if any required variables are missing
 */
export function validateEnvironment<T extends string>(
  required: readonly T[]
): Record<T, string> {
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }

  logger.info('✓ Environment variables validated')

  return required.reduce((acc, key) => {
    acc[key] = process.env[key]!
    return acc
  }, {} as Record<T, string>)
}
