/**
 * Evaluation Recovery Monitor
 * Monitors and recovers stuck task evaluations
 * Uses ONLY direct database access (no API calls)
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import { recoverStuckEvaluationsFromDatabase } from '../core/evaluation-sync-service'

const logger = createLogger({ namespace: 'evaluation-recovery' })

export interface EvaluationRecoveryConfig {
  timeoutMinutes?: number
  checkIntervalMs?: number
  sql: Sql
}

const DEFAULT_TIMEOUT_MINUTES = 60
const DEFAULT_CHECK_INTERVAL_MS = 15 * 60 * 1000 // 15 minutes

/**
 * Start periodic monitoring and recovery of stuck evaluations
 */
export function startEvaluationRecovery(
  config: EvaluationRecoveryConfig
): NodeJS.Timeout {
  const timeoutMinutes =
    config.timeoutMinutes ||
    parseInt(process.env.STUCK_EVALUATION_TIMEOUT_MINUTES || '') ||
    DEFAULT_TIMEOUT_MINUTES

  const checkIntervalMs =
    config.checkIntervalMs ||
    parseInt(process.env.STUCK_EVAL_CHECK_INTERVAL_MINUTES || '') * 60 * 1000 ||
    DEFAULT_CHECK_INTERVAL_MS

  logger.info(`🔄 Starting evaluation recovery monitor:`)
  logger.info(`  - Check interval: ${checkIntervalMs / 60000} minutes`)
  logger.info(`  - Stuck timeout: ${timeoutMinutes} minutes`)

  const intervalId = setInterval(async () => {
    try {
      await recoverStuckEvaluationsFromDatabase(
        config.sql,
        timeoutMinutes
      )
    } catch (error) {
      logger.error('Evaluation recovery error:', error)
    }
  }, checkIntervalMs)

  // Run immediately on start
  recoverStuckEvaluationsFromDatabase(
    config.sql,
    timeoutMinutes
  ).catch((error) => {
    logger.error('Evaluation recovery initial run error:', error)
  })

  return intervalId
}

/**
 * Stop evaluation recovery monitor
 */
export function stopEvaluationRecovery(intervalId: NodeJS.Timeout): void {
  clearInterval(intervalId)
  logger.info('⏹️  Evaluation recovery monitor stopped')
}
