/**
 * Custom Worker Executor - Routes tasks to custom worker microservices via RabbitMQ
 */

import type { Sql } from 'postgres'
import type { WorkerTaskMessage, Task, Project, Session } from '@types'
import { createPublisher } from '@adi-simple/queue/publisher'
import { WORKER_TASKS_QUEUE, WORKER_RESPONSES_QUEUE } from '@adi-simple/queue/queues'
import { createLogger } from '@utils/logger'
import { sql as defaultSql } from '@db/client'
import { findSessionById, updateSession } from '@db/sessions'
import { findTaskById } from '@db/tasks'
import { findProjectById } from '@db/projects'
import { v4 as uuidv4 } from 'uuid'

const logger = createLogger({ namespace: 'custom-worker-executor' })

export interface ExecuteTaskInput {
  sessionId: string
  taskType: 'evaluation' | 'implementation'
  workerTypeOverride?: 'gitlab-ci' | 'custom-microservice'
}

export interface ExecuteTaskResult {
  sessionId: string
  workerType: 'custom-microservice'
  status: 'queued'
}

/**
 * Execute task using custom worker microservice
 */
export async function executeTaskWithCustomWorker(
  input: ExecuteTaskInput,
  sql: Sql = defaultSql
): Promise<ExecuteTaskResult> {
  const { sessionId, taskType, workerTypeOverride } = input

  logger.info(`Executing ${taskType} task via custom worker for session ${sessionId}`)

  // Fetch session, task, and project
  const session = await findSessionById(sql, sessionId)
  if (!session) {
    throw new Error(`Session not found: ${sessionId}`)
  }

  if (!session.task_id) {
    throw new Error(`Session has no task associated: ${sessionId}`)
  }

  const task = await findTaskById(sql, session.task_id)
  if (!task) {
    throw new Error(`Task not found: ${session.task_id}`)
  }

  if (!task.project_id) {
    throw new Error(`Task has no project associated: ${task.id}`)
  }

  const project = await findProjectById(sql, task.project_id)
  if (!project) {
    throw new Error(`Project not found: ${task.project_id}`)
  }

  // Update session with worker type information
  await updateSession(sql, sessionId, {
    worker_type_override: workerTypeOverride || null,
    executed_by_worker_type: 'custom-microservice'
  })

  // Build worker task message
  const correlationId = uuidv4()
  const taskMessage: WorkerTaskMessage = {
    taskId: task.id,
    sessionId: session.id,
    projectId: project.id,
    taskType,
    context: {
      task: task as Task,
      project: project as Project,
      aiProvider: project.ai_provider_configs || {},
      workspace: undefined
    },
    timeout: 1800000, // 30 minutes
    attempt: 1,
    correlationId,
    replyTo: WORKER_RESPONSES_QUEUE
  }

  // Publish message to worker-tasks queue
  const publisher = await createPublisher()
  await publisher.publish(WORKER_TASKS_QUEUE, taskMessage, {
    persistent: true,
    correlationId
  })

  logger.info(`Task ${taskType} queued for session ${sessionId} with correlation ID ${correlationId}`)

  return {
    sessionId,
    workerType: 'custom-microservice',
    status: 'queued'
  }
}

/**
 * Determine which worker type to use based on project configuration and overrides
 */
export function determineWorkerType(
  project: Project,
  workerTypeOverride?: 'gitlab-ci' | 'custom-microservice'
): 'gitlab-ci' | 'custom-microservice' {
  // If override provided and allowed, use it
  if (workerTypeOverride && project.allow_worker_override) {
    return workerTypeOverride
  }

  // Otherwise use project default
  return project.default_worker_type || 'custom-microservice'
}
