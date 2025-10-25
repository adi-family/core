/**
 * Evaluation Sync Service
 * Shared logic for syncing task evaluation status from pipeline executions
 * Used by both pipeline monitor and stuck evaluation recovery
 * Uses ONLY direct database access (no API calls)
 */

import type { Sql, MaybeRow, PendingQuery } from 'postgres'
import { createLogger } from '@utils/logger'
import * as taskQueries from '@db/tasks'
import * as sessionQueries from '@db/sessions'
import * as artifactQueries from '@db/pipeline-artifacts'

// Utility to unwrap postgres queries
function get<T extends readonly MaybeRow[]>(q: PendingQuery<T>) {
  return q.then(v => v);
}

const logger = createLogger({ namespace: 'evaluation-sync' })

export interface PipelineExecution {
  id: string
  session_id: string | null
  status: string
  pipeline_id: string | null
  worker_repository_id: string
  [key: string]: unknown
}

export interface Task {
  id: string
  ai_evaluation_status: string
  [key: string]: unknown
}

/**
 * Sync task evaluation status based on pipeline completion
 * This is the core logic used by both monitoring mechanisms
 */
export async function syncTaskEvaluationStatus(
  sql: Sql,
  execution: PipelineExecution,
  pipelineStatus: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
): Promise<void> {
  // Only process completed pipelines with a session
  if (!execution.session_id || pipelineStatus === 'pending' || pipelineStatus === 'running') {
    return
  }

  try {
    // Fetch session to get task_id (direct DB)
    const sessionResult = await sessionQueries.findSessionById(sql, execution.session_id)
    if (!sessionResult.ok) {
      logger.warn(`⚠️  Session not found for execution ${execution.id}`)
      return
    }

    const session = sessionResult.data
    if (!session.task_id) {
      // Session has no task - this is normal for non-evaluation pipelines
      return
    }

    // Fetch task (direct DB)
    const taskResult = await taskQueries.findTaskById(sql, session.task_id)
    if (!taskResult.ok) {
      logger.warn(`⚠️  Task not found: ${session.task_id}`)
      return
    }

    const task = taskResult.data

    // Only update if task is still in 'evaluating' state
    // This means the upload script didn't run or failed
    if (task.ai_evaluation_status !== 'evaluating') {
      logger.info(`  Task ${task.id} already in status '${task.ai_evaluation_status}', skipping sync`)
      return
    }

    logger.info(`🔄 Syncing task ${task.id} evaluation status (pipeline: ${pipelineStatus})`)

    if (pipelineStatus === 'success') {
      await handleSuccessfulPipeline(sql, execution, task)
    } else if (pipelineStatus === 'failed') {
      await handleFailedPipeline(sql, task)
    } else if (pipelineStatus === 'canceled') {
      await handleCanceledPipeline(sql, task)
    }

  } catch (error) {
    logger.error(`Failed to sync task evaluation status for execution ${execution.id}:`, error)
  }
}

/**
 * Handle successful pipeline - try to fetch artifact and set result
 */
async function handleSuccessfulPipeline(
  sql: Sql,
  execution: PipelineExecution,
  task: Task
): Promise<void> {
  // Try to fetch artifact to get evaluation result (direct DB)
  try {
    const artifacts = await artifactQueries.findPipelineArtifactsByExecutionId(sql, execution.id)

    const evalArtifact = artifacts.find((a: any) =>
      a.metadata?.task_id === task.id &&
      a.artifact_type === 'text'
    )

    if (evalArtifact?.metadata?.is_ready !== undefined) {
      // Use transaction to update both status and result atomically
      await sql.begin(async (sql) => {
        // Update status to completed
        await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'completed')

        // Update result
        const result = evalArtifact.metadata.is_ready ? 'ready' : 'needs_clarification'
        await taskQueries.updateTaskEvaluationResult(sql, task.id, result)

        logger.info(`✅ Task ${task.id} synced: completed (${result})`)
      })
      return
    }
  } catch (error) {
    logger.warn(`⚠️  Failed to fetch artifact for execution ${execution.id}:`, error)
  }

  // Fallback: mark as completed without result (direct DB)
  await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'completed')
  logger.warn(`⚠️  Task ${task.id} marked completed but no artifact result found`)
}

/**
 * Handle failed pipeline
 */
async function handleFailedPipeline(
  sql: Sql,
  task: Task
): Promise<void> {
  await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'failed')
  logger.info(`❌ Task ${task.id} marked as failed (pipeline failed)`)
}

/**
 * Handle canceled pipeline
 */
async function handleCanceledPipeline(
  sql: Sql,
  task: Task
): Promise<void> {
  await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'pending')
  logger.info(`🔄 Task ${task.id} reset to pending (pipeline canceled)`)
}

/**
 * Recover stuck evaluations using database queries
 * Used by stuck evaluation recovery cron job
 */
export async function recoverStuckEvaluationsFromDatabase(
  sql: Sql,
  timeoutMinutes: number
): Promise<{ tasksRecovered: number; errors: string[] }> {
  const result = {
    tasksRecovered: 0,
    errors: [] as string[]
  }

  try {
    logger.info(`🔍 Checking for stuck evaluations (timeout: ${timeoutMinutes} min)`)

    // Find tasks stuck in 'evaluating' for > timeout (direct DB)
    const stuckTasks = await get(sql<any[]>`
      SELECT
        t.*,
        pe.id as pipeline_execution_id,
        pe.status as pipeline_status,
        pe.last_status_update as pipeline_last_update
      FROM tasks t
      LEFT JOIN sessions s ON t.ai_evaluation_session_id = s.id
      LEFT JOIN pipeline_executions pe ON s.id = pe.session_id
      WHERE t.ai_evaluation_status = 'evaluating'
        AND t.updated_at < NOW() - INTERVAL '1 minute' * ${timeoutMinutes}
      ORDER BY t.updated_at ASC
    `)

    if (stuckTasks.length === 0) {
      logger.info('✓ No stuck evaluations found')
      return result
    }

    logger.warn(`⚠️  Found ${stuckTasks.length} stuck evaluation(s)`)

    for (const task of stuckTasks) {
      try {
        if (!task.pipeline_execution_id) {
          // No pipeline found - reset to pending (direct DB)
          await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'pending')
          result.tasksRecovered++
          logger.info(`🔄 Task ${task.id} reset to pending (no pipeline found)`)

        } else if (task.pipeline_status === 'success') {
          // Pipeline succeeded but upload failed - sync using DB
          const execution = {
            id: task.pipeline_execution_id,
            session_id: task.ai_evaluation_session_id,
            status: 'success',
            pipeline_id: null,
            worker_repository_id: ''
          } as PipelineExecution

          await syncTaskEvaluationStatus(sql, execution, 'success')
          result.tasksRecovered++

        } else if (task.pipeline_status === 'failed') {
          // Pipeline failed - mark task as failed (direct DB)
          await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'failed')
          result.tasksRecovered++
          logger.info(`❌ Task ${task.id} marked failed (pipeline failed)`)

        } else if (task.pipeline_status === 'canceled') {
          // Pipeline canceled - reset to pending for retry (direct DB)
          await taskQueries.updateTaskEvaluationStatus(sql, task.id, 'pending')
          result.tasksRecovered++
          logger.info(`🔄 Task ${task.id} reset to pending (pipeline canceled)`)

        } else {
          // Pipeline still running or stuck - log and skip
          logger.info(`⏳ Task ${task.id} pipeline still ${task.pipeline_status}, waiting...`)
        }

      } catch (error) {
        const errorMsg = `Failed to recover stuck task ${task.id}: ${error instanceof Error ? error.message : String(error)}`
        logger.error(errorMsg)
        result.errors.push(errorMsg)
      }
    }

    logger.info(`✅ Finished checking stuck evaluations: ${result.tasksRecovered} recovered, ${result.errors.length} errors`)
    return result

  } catch (error) {
    logger.error('Failed to recover stuck evaluations:', error)
    result.errors.push(error instanceof Error ? error.message : String(error))
    return result
  }
}
