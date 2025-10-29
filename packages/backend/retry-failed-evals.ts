#!/usr/bin/env bun
import { sql } from '@db/client'
import { publishTaskEval } from '@adi/queue/publisher'
import { createLogger } from '@utils/logger'
import type { Task } from '@types'

const logger = createLogger({ namespace: 'retry-failed-evals' })

async function retryFailedEvaluations() {
  try {
    // Get all failed tasks
    const failedTasks = await sql<Task[]>`
      SELECT id, title FROM tasks
      WHERE ai_evaluation_status = 'failed'
    `

    logger.info(`Found ${failedTasks.length} failed tasks to retry`)

    // Reset status to pending
    await sql`
      UPDATE tasks
      SET ai_evaluation_status = 'pending', updated_at = NOW()
      WHERE ai_evaluation_status = 'failed'
    `

    logger.info(`Reset ${failedTasks.length} tasks to pending status`)

    // Publish to queue
    for (const task of failedTasks) {
      await publishTaskEval({ taskId: task.id })
      logger.info(`Queued task ${task.id}: ${task.title}`)
    }

    logger.info(`Successfully queued ${failedTasks.length} tasks for evaluation`)

    process.exit(0)
  } catch (error) {
    logger.error('Failed to retry evaluations:', error)
    process.exit(1)
  }
}

retryFailedEvaluations()
