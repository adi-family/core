/**
 * Evaluation Recovery Monitor
 * Monitors and recovers stuck task evaluations
 * Uses ONLY direct database access (no API calls)
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import { recoverStuckEvaluationsFromDatabase } from '../core/evaluation-sync-service'
import { EVALUATION_RECOVERY } from '@adi-simple/config'

const logger = createLogger({ namespace: 'evaluation-recovery' })

export interface EvaluationRecoveryConfig {
  timeoutMinutes?: number
  checkIntervalMs?: number
  sql: Sql
}

const DEFAULT_TIMEOUT_MINUTES = EVALUATION_RECOVERY.stuckEvaluationTimeoutMinutes
const DEFAULT_CHECK_INTERVAL_MS = EVALUATION_RECOVERY.checkIntervalMinutes * 60 * 1000

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

/**
 * Create evaluation recovery monitor runner
 */
export function createEvaluationRecovery(
  config: EvaluationRecoveryConfig
): Runner {
  const timeoutMinutes =
    config.timeoutMinutes ||
    parseInt(process.env.STUCK_EVALUATION_TIMEOUT_MINUTES || '') ||
    DEFAULT_TIMEOUT_MINUTES

  const checkIntervalMs =
    config.checkIntervalMs ||
    parseInt(process.env.STUCK_EVAL_CHECK_INTERVAL_MINUTES || '') * 60 * 1000 ||
    DEFAULT_CHECK_INTERVAL_MS

  let intervalId: NodeJS.Timeout | null = null

  return {
    start: () => {
      if (intervalId) {
        logger.warn('Evaluation recovery monitor already running')
        return
      }

      logger.info(`🔄 Starting evaluation recovery monitor:`)
      logger.info(`  - Check interval: ${checkIntervalMs / 60000} minutes`)
      logger.info(`  - Stuck timeout: ${timeoutMinutes} minutes`)

      intervalId = setInterval(async () => {
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
    },

    stop: () => {
      if (intervalId) {
        clearInterval(intervalId)
        intervalId = null
        logger.info('⏹️  Evaluation recovery monitor stopped')
      }
    }
  }
}
