/**
 * Task Evaluation Scheduler
 * Schedules periodic task evaluation processing
 * Moved from micros-cron to micros-task-ops
 */

import type { Sql } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskQueries from '@db/tasks'
import { publishTaskEval } from '@adi/queue/publisher.ts'
import { getProjectOwnerId } from '@db/user-access'
import { checkQuotaAvailable } from '@db/user-quotas'
import { checkProjectHasAnthropicProvider } from '@backend/services/ai-provider-selector'

const logger = createLogger({ namespace: 'eval-scheduler' })

/**
 * Process all pending task evaluations by publishing them to the queue
 * Skips tasks that would fail due to quota/API key issues
 */
export async function processTaskEvaluations(sql: Sql): Promise<{ tasksPublished: number; tasksSkipped: number; errors: string[] }> {
  const result = {
    tasksPublished: 0,
    tasksSkipped: 0,
    errors: [] as string[]
  }

  try {
    // Fetch all tasks with pending evaluation status
    const pendingTasks = await taskQueries.findTasksNeedingEvaluation(sql)

    logger.info(`Found ${pendingTasks.length} tasks pending evaluation`)

    // Publish each task to the evaluation queue
    for (const task of pendingTasks) {
      try {
        // Get project info for quota checking
        if (!task.project_id) {
          result.tasksSkipped++
          continue
        }

        // Get project owner
        const userId = await getProjectOwnerId(sql, task.project_id)
        if (!userId) {
          result.tasksSkipped++
          continue
        }

        // Check quota availability for simple evaluation
        const quotaCheck = await checkQuotaAvailable(sql, userId, 'simple')

        // If user is at hard limit, check if project has API key (platform key cannot be used)
        if (quotaCheck.at_hard_limit) {
          const hasProjectKey = await checkProjectHasAnthropicProvider(sql, task.project_id)

          if (!hasProjectKey) {
            result.tasksSkipped++
            continue
          }
        }

        // Publish to queue
        await publishTaskEval({ taskId: task.id })
        result.tasksPublished++
        logger.debug(`Published task ${task.id} to eval queue`)
      } catch (error) {
        const errorMsg = `Failed to publish task ${task.id}: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    logger.info(`✓ Evaluation processing: ${result.tasksPublished} published, ${result.tasksSkipped} skipped, ${result.errors.length} errors`)

    return result
  } catch (error) {
    logger.error('Failed to process pending evaluations:', error)
    result.errors.push(error instanceof Error ? error.message : String(error))
    return result
  }
}

export interface Runner {
  start: () => void | Promise<void>
  stop: () => void | Promise<void>
}

/**
 * Create evaluation scheduler runner
 */
export function createEvalScheduler(
  sql: Sql,
  intervalMinutes: number = 1
): Runner {
  const intervalMs = intervalMinutes * 60 * 1000
  let timer: NodeJS.Timeout | null = null

  return {
    start: () => {
      if (timer) {
        logger.warn('Evaluation scheduler already running')
        return
      }

      logger.info(`Starting evaluation scheduler with ${intervalMinutes} minute interval`)

      // Run immediately on startup
      processTaskEvaluations(sql).then(result => {
        logger.info(`Initial evaluation run completed:`, result)
      }).catch(error => {
        logger.error('Initial evaluation run failed:', error)
      })

      // Schedule periodic runs
      timer = setInterval(() => {
        processTaskEvaluations(sql).catch(error => {
          logger.error('Scheduled evaluation run failed:', error)
        })
      }, intervalMs)

      logger.info('Evaluation scheduler started successfully')
    },

    stop: () => {
      if (timer) {
        clearInterval(timer)
        timer = null
        logger.info('Evaluation scheduler stopped')
      }
    }
  }
}
