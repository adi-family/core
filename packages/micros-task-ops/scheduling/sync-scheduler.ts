/**
 * Task Source Sync Scheduler
 * Schedules periodic task source synchronization
 * Moved from micros-cron to micros-task-ops
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskSourceQueries from '@db/task-sources'
import { syncTaskSource } from '@backend/services/orchestrator'

const logger = createLogger({ namespace: 'sync-scheduler' })

/**
 * Sync task sources that need syncing
 * Only syncs enabled task sources that haven't been synced in the last N minutes
 * Also re-queues task sources stuck in 'queued' or 'syncing' status
 */
export async function syncTaskSourcesNeedingSync(
  sql: Sql,
  minutesSinceLastSync: number,
  queuedTimeoutMinutes: number = 120
): Promise<void> {
  logger.info(`Looking for task sources needing sync:`)
  logger.info(`  - Last synced > ${minutesSinceLastSync} minutes ago`)
  logger.info(`  - Stuck in queue/syncing > ${queuedTimeoutMinutes} minutes`)

  try {
    // Find task sources that need syncing
    const taskSources = await taskSourceQueries.findTaskSourcesNeedingSync(
      sql,
      minutesSinceLastSync,
      queuedTimeoutMinutes
    )

    logger.info(`Found ${taskSources.length} task sources needing sync`)

    let totalPublished = 0
    let totalErrors = 0
    let totalStuck = 0

    // Sync each task source via orchestrator
    for (const taskSource of taskSources) {
      try {
        // Check if this is a stuck task (queued/syncing for too long)
        const isStuck = ['queued', 'syncing'].includes(taskSource.sync_status)
        if (isStuck) {
          totalStuck++
          logger.warn(`Task source ${taskSource.id} stuck in '${taskSource.sync_status}' status, re-queuing`)
        }

        // Use orchestrator to sync (handles 'queued' status and publishing)
        const result = await syncTaskSource(sql, {
          taskSourceId: taskSource.id
        })

        if (result.errors.length > 0) {
          totalErrors++
          logger.error(`Failed to sync task source ${taskSource.id}:`, result.errors)
        } else {
          totalPublished += result.tasksPublished
          logger.debug(`Queued sync for task source ${taskSource.id}`)
        }
      } catch (error) {
        totalErrors++
        logger.error(`Failed to sync task source ${taskSource.id}:`, error)
      }
    }

    logger.info(`Sync scheduling completed: ${totalPublished} task sources published (${totalStuck} stuck tasks re-queued), ${totalErrors} errors`)
  } catch (error) {
    logger.error('Failed to run sync scheduling:', error)
    throw error
  }
}

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

/**
 * Create sync scheduler runner
 */
export function createSyncScheduler(
  sql: Sql,
  intervalMinutes: number = 15,
  syncThresholdMinutes: number = 30,
  queuedTimeoutMinutes: number = 120
): Runner {
  const intervalMs = intervalMinutes * 60 * 1000
  let timer: NodeJS.Timeout | null = null

  return {
    start: () => {
      if (timer) {
        logger.warn('Sync scheduler already running')
        return
      }

      logger.info(`Starting sync scheduler:`)
      logger.info(`  - Check interval: ${intervalMinutes} minutes`)
      logger.info(`  - Sync threshold: ${syncThresholdMinutes} minutes`)
      logger.info(`  - Stuck task timeout: ${queuedTimeoutMinutes} minutes`)

      // Run immediately on startup
      syncTaskSourcesNeedingSync(sql, syncThresholdMinutes, queuedTimeoutMinutes).catch(error => {
        logger.error('Initial sync failed:', error)
      })

      // Schedule periodic runs
      timer = setInterval(() => {
        syncTaskSourcesNeedingSync(sql, syncThresholdMinutes, queuedTimeoutMinutes).catch(error => {
          logger.error('Scheduled sync failed:', error)
        })
      }, intervalMs)

      logger.info('Sync scheduler started successfully')
    },

    stop: () => {
      if (timer) {
        clearInterval(timer)
        timer = null
        logger.info('Sync scheduler stopped')
      }
    }
  }
}
