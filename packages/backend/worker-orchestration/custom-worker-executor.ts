/**
 * Worker Executor - Routes tasks to different worker types (adi-runner, sdk, gitlab-ci)
 */

import type { Sql } from 'postgres'
import type { WorkerTaskMessage, Task, Project, WorkerType } from '@types'
import { createPublisher } from '@adi/queue/publisher'
import { WORKER_TASKS_QUEUE, WORKER_RESPONSES_QUEUE } from '@adi/queue/queues'
import { createLogger } from '@utils/logger'
import { sql as defaultSql } from '@db/client'
import { findSessionById, updateSession } from '@db/sessions'
import { findTaskById } from '@db/tasks'
import { findProjectById } from '@db/projects'
import { v4 as uuidv4 } from 'uuid'
import { assertNever } from '@utils/assert-never'

const logger = createLogger({ namespace: 'worker-executor' })

export interface ExecuteTaskInput {
  sessionId: string
  taskType: 'evaluation' | 'implementation'
  workerTypeOverride?: WorkerType
}

export interface ExecuteTaskResult {
  sessionId: string
  workerType: WorkerType
  status: 'queued'
}

/**
 * Execute task using adi-runner microservice (via RabbitMQ)
 */
export async function executeTaskWithAdiRunner(
  input: ExecuteTaskInput,
  sql: Sql = defaultSql
): Promise<ExecuteTaskResult> {
  const { sessionId, taskType, workerTypeOverride } = input

  logger.info(`Executing ${taskType} task via adi-runner for session ${sessionId}`)

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
    executed_by_worker_type: 'adi-runner'
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
    workerType: 'adi-runner',
    status: 'queued'
  }
}

/**
 * @deprecated Use executeTaskWithAdiRunner instead. This is kept for backwards compatibility.
 */
export const executeTaskWithCustomWorker = executeTaskWithAdiRunner

/**
 * Determine which worker type to use based on project configuration and overrides
 */
export function determineWorkerType(
  project: Project,
  workerTypeOverride?: WorkerType
): WorkerType {
  // If override provided and allowed, use it
  if (workerTypeOverride && project.allow_worker_override) {
    return workerTypeOverride
  }

  // Otherwise use project default
  return project.default_worker_type || 'adi-runner'
}

/**
 * Check if a worker type requires RabbitMQ queues (adi-runner)
 * SDK workers use HTTP polling, GitLab CI uses pipelines
 */
export function workerTypeUsesQueue(workerType: WorkerType): boolean {
  switch (workerType) {
    case 'adi-runner':
      return true
    case 'gitlab-ci':
    case 'sdk':
      return false
    default:
      return assertNever(workerType)
  }
}

/**
 * Check if a worker type supports a specific task type
 */
export function workerTypeSupportsTaskType(
  workerType: WorkerType,
  _taskType: 'evaluation' | 'implementation'
): boolean {
  switch (workerType) {
    case 'adi-runner':
    case 'sdk':
      // Both adi-runner and sdk support all task types
      return true
    case 'gitlab-ci':
      // GitLab CI supports all task types
      return true
    default:
      return assertNever(workerType)
  }
}

/**
 * Get a human-readable label for a worker type
 */
export function getWorkerTypeLabel(workerType: WorkerType): string {
  switch (workerType) {
    case 'adi-runner':
      return 'ADI Runner'
    case 'gitlab-ci':
      return 'GitLab CI'
    case 'sdk':
      return 'SDK Worker'
    default:
      return assertNever(workerType)
  }
}
