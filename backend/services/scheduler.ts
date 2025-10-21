/**
 * Scheduler Service
 * Provides cron-like scheduling for periodic task source processing
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger.ts'
import { syncAllProjects } from './orchestrator'

const logger = createLogger({ namespace: 'scheduler' })

export interface SchedulerOptions {
  intervalMs?: number
  enabled?: boolean
}

let schedulerIntervalId: Timer | null = null

/**
 * Start the scheduler to periodically process all projects
 */
export function startScheduler(sql: Sql, options: SchedulerOptions = {}): Timer | null {
  const {
    intervalMs = 600000, // 10 minutes default (same as old worker)
    enabled = process.env.ENABLE_SCHEDULER === 'true'
  } = options

  if (!enabled) {
    logger.info('Scheduler is disabled (set ENABLE_SCHEDULER=true to enable)')
    return null
  }

  if (schedulerIntervalId) {
    logger.warn('Scheduler already running, stopping existing scheduler first')
    stopScheduler()
  }

  logger.info(`Starting scheduler with ${intervalMs}ms interval (${intervalMs / 1000}s)`)

  // Run immediately on start
  syncAllProjects(sql)
    .then(result => {
      logger.info(`Initial scheduler run completed:`, result)
    })
    .catch(error => {
      logger.error('Initial scheduler run failed:', error)
    })

  // Schedule periodic runs
  schedulerIntervalId = setInterval(async () => {
    try {
      logger.info('Scheduler: Starting periodic task source sync')
      const result = await syncAllProjects(sql)
      logger.info(`Scheduler: Sync completed:`, result)
    } catch (error) {
      logger.error('Scheduler: Sync failed:', error)
    }
  }, intervalMs)

  return schedulerIntervalId
}

/**
 * Stop the scheduler
 */
export function stopScheduler(): void {
  if (schedulerIntervalId) {
    clearInterval(schedulerIntervalId)
    schedulerIntervalId = null
    logger.info('Scheduler stopped')
  }
}

/**
 * Check if scheduler is running
 */
export function isSchedulerRunning(): boolean {
  return schedulerIntervalId !== null
}
