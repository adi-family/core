/**
 * Pipeline Executor
 * Triggers GitLab CI pipelines for worker execution
 */

import type { PipelineExecution } from '../backend/types'
import type { BackendApiClient } from './api-client'
import { GitLabApiClient } from './gitlab-api-client'
import { decrypt } from './crypto-utils'
import { retry, isRetryableError } from '../utils/retry'
import { createLogger } from '../utils/logger'

const logger = createLogger({ namespace: 'pipeline-executor' })

export interface TriggerPipelineInput {
  sessionId: string
  apiClient: BackendApiClient
}

export interface TriggerPipelineResult {
  execution: PipelineExecution
  pipelineUrl: string
}

/**
 * Build pipeline variables from session
 */
export function buildPipelineVariables(
  sessionId: string,
  executionId: string,
  ciConfigPath: string
): Record<string, string> {
  return {
    SESSION_ID: sessionId,
    PIPELINE_EXECUTION_ID: executionId,
    CI_CONFIG_PATH: ciConfigPath,
  }
}

/**
 * Trigger a GitLab pipeline for a session
 */
export async function triggerPipeline(
  input: TriggerPipelineInput
): Promise<TriggerPipelineResult> {
  logger.info(`🚀 Triggering pipeline for session ${input.sessionId}`)

  try {
    // Fetch session
    const sessionResult = await input.apiClient.getSession(input.sessionId)
    if (!sessionResult.ok) {
      throw new Error(`Session not found: ${input.sessionId}`)
    }
    const session = sessionResult.data

    // Validate session has task
    if (!session.task_id) {
      throw new Error(
        `Session ${input.sessionId} has no associated task. Please ensure the session is properly configured.`
      )
    }

    // Fetch task
    const taskResult = await input.apiClient.getTask(session.task_id)
    if (!taskResult.ok) {
      throw new Error(`Task not found: ${session.task_id}`)
    }
    const task = taskResult.data

    // Validate task has project
    if (!task.project_id) {
      throw new Error(
        `Task ${task.id} has no associated project. Please ensure the task is properly configured.`
      )
    }

    // Fetch project
    const projectResult = await input.apiClient.getProject(task.project_id)
    if (!projectResult.ok) {
      throw new Error(`Project not found: ${task.project_id}`)
    }
    const project = projectResult.data

    // Fetch worker repository
    const workerRepoResult = await input.apiClient.getWorkerRepositoryByProjectId(project.id)
    if (!workerRepoResult.ok) {
      throw new Error(
        `Worker repository not found for project: ${project.name} (${project.id}). Please create a worker repository first using the CIRepositoryManager.`
      )
    }
    const workerRepo = workerRepoResult.data

    // Parse source from JSONB
    const source = workerRepo.source_gitlab as {
      type: string
      project_id?: string
      project_path?: string
      host?: string
      user?: string
      access_token_encrypted?: string
    }

    // Validate worker repository configuration
    if (source.type !== 'gitlab') {
      throw new Error(
        `Unsupported worker repository type: ${source.type}. Only 'gitlab' is currently supported.`
      )
    }

    if (!source.project_id || !source.host || !source.access_token_encrypted) {
      throw new Error(
        `Invalid worker repository source configuration. Missing required fields: ${[
          !source.project_id && 'project_id',
          !source.host && 'host',
          !source.access_token_encrypted && 'access_token_encrypted',
        ].filter(Boolean).join(', ')}`
      )
    }

    // Validate runner type
    if (!session.runner) {
      throw new Error(
        `Session ${session.id} has no runner type specified. Please ensure the session is properly configured.`
      )
    }

    // Validate CI version
    if (!workerRepo.current_version) {
      throw new Error(
        `Worker repository ${workerRepo.id} has no current version. Please upload CI files first.`
      )
    }

    // Create pipeline execution record first (with empty pipeline_id)
    const execution = await input.apiClient.createPipelineExecution({
      session_id: session.id,
      worker_repository_id: workerRepo.id,
      status: 'pending',
    })

    logger.info(`✓ Created pipeline execution record: ${execution.id}`)

    // Determine CI file based on runner type
    const runnerType = session.runner
    const ciConfigPath = `${workerRepo.current_version}/.gitlab-ci-${runnerType}.yml`

    logger.info(`✓ Using CI config: ${ciConfigPath}`)

    // Build pipeline variables
    const variables = buildPipelineVariables(
      session.id,
      execution.id,
      ciConfigPath
    )

    logger.info(`✓ Pipeline variables prepared`)

    // Decrypt access token
    let accessToken: string
    try {
      accessToken = decrypt(source.access_token_encrypted)
    } catch (error) {
      throw new Error(
        `Failed to decrypt GitLab access token. Please check ENCRYPTION_KEY environment variable. Error: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Trigger GitLab pipeline with retry logic
    const gitlabClient = new GitLabApiClient(source.host, accessToken)

    try {
      const pipeline = await retry(
        async () => {
          logger.info(`📡 Attempting to trigger pipeline...`)
          return await gitlabClient.triggerPipeline(source.project_id!, {
            ref: 'main',
            variables,
          })
        },
        {
          maxAttempts: 3,
          initialDelayMs: 2000,
          onRetry: (error, attempt) => {
            if (isRetryableError(error)) {
              logger.warn(
                `⚠️  Pipeline trigger failed (attempt ${attempt}/3): ${error.message}. Retrying...`
              )
            } else {
              logger.error(
                `❌ Non-retryable error: ${error.message}. Aborting.`
              )
              throw error
            }
          },
        }
      )

      logger.info(`✓ GitLab pipeline triggered: ${pipeline.id}`)

      // Update execution with GitLab pipeline ID
      const updateResult = await input.apiClient.updatePipelineExecution(execution.id, {
        pipeline_id: pipeline.id.toString(),
        status: 'pending',
        last_status_update: new Date(),
      })

      if (!updateResult.ok) {
        throw new Error(
          `Failed to update pipeline execution ${execution.id} with pipeline ID ${pipeline.id}`
        )
      }

      const pipelineUrl = `${source.host}/${source.project_path}/-/pipelines/${pipeline.id}`

      logger.info(`✅ Pipeline triggered successfully: ${pipelineUrl}`)

      return {
        execution: updateResult.data,
        pipelineUrl,
      }
    } catch (error) {
      // If pipeline trigger fails, update execution status to failed
      const errorMessage = error instanceof Error ? error.message : String(error)
      logger.error(`❌ Pipeline trigger failed: ${errorMessage}`)

      await input.apiClient.updatePipelineExecution(execution.id, {
        status: 'failed',
        last_status_update: new Date(),
      })

      throw new Error(
        `Failed to trigger pipeline for session ${input.sessionId}: ${errorMessage}`
      )
    }
  } catch (error) {
    // Log error with context
    const errorMessage = error instanceof Error ? error.message : String(error)
    logger.error(
      `❌ Pipeline execution failed for session ${input.sessionId}: ${errorMessage}`
    )
    throw error
  }
}
