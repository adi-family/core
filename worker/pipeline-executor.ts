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
 * Fetch and validate session
 */
async function fetchAndValidateSession(apiClient: BackendApiClient, sessionId: string) {
  const sessionResult = await apiClient.getSession(sessionId)
  if (!sessionResult.ok) {
    throw new Error(`Session not found: ${sessionId}`)
  }
  const session = sessionResult.data

  if (!session.task_id) {
    throw new Error(
      `Session ${sessionId} has no associated task. Please ensure the session is properly configured.`
    )
  }

  return { session }
}

/**
 * Fetch and validate task
 */
async function fetchAndValidateTask(apiClient: BackendApiClient, session: { task_id: string | null }) {
  const taskResult = await apiClient.getTask(session.task_id!)
  if (!taskResult.ok) {
    throw new Error(`Task not found: ${session.task_id}`)
  }
  const task = taskResult.data

  if (!task.project_id) {
    throw new Error(
      `Task ${task.id} has no associated project. Please ensure the task is properly configured.`
    )
  }

  return { task }
}

/**
 * Fetch and validate project
 */
async function fetchAndValidateProject(apiClient: BackendApiClient, task: { project_id: string | null }) {
  const projectResult = await apiClient.getProject(task.project_id!)
  if (!projectResult.ok) {
    throw new Error(`Project not found: ${task.project_id}`)
  }
  const project = projectResult.data

  return { project }
}

/**
 * GitLab source configuration type
 */
interface GitLabSource {
  type: string
  project_id?: string
  project_path?: string
  host?: string
  user?: string
  access_token_encrypted?: string
}

/**
 * Fetch and validate worker repository
 */
async function fetchAndValidateWorkerRepository(apiClient: BackendApiClient, project: { id: string; name: string }) {
  const workerRepoResult = await apiClient.getWorkerRepositoryByProjectId(project.id)
  if (!workerRepoResult.ok) {
    throw new Error(
      `Worker repository not found for project: ${project.name} (${project.id}). Please create a worker repository first using the CIRepositoryManager.`
    )
  }
  const workerRepo = workerRepoResult.data

  const source = workerRepo.source_gitlab as GitLabSource

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

  if (!workerRepo.current_version) {
    throw new Error(
      `Worker repository ${workerRepo.id} has no current version. Please upload CI files first.`
    )
  }

  return { workerRepo, source }
}

/**
 * Determine CI config path based on runner type
 */
function determineCiConfigPath(session: { id: string; runner: string | null }, workerRepo: { current_version: string | null }) {
  if (!session.runner) {
    throw new Error(
      `Session ${session.id} has no runner type specified. Please ensure the session is properly configured.`
    )
  }

  const ciConfigPath = `${workerRepo.current_version}/.gitlab-ci-${session.runner}.yml`
  logger.info(`✓ Using CI config: ${ciConfigPath}`)

  return ciConfigPath
}

/**
 * Decrypt access token
 */
function decryptAccessToken(encryptedToken: string): string {
  try {
    return decrypt(encryptedToken)
  } catch (error) {
    throw new Error(
      `Failed to decrypt GitLab access token. Please check ENCRYPTION_KEY environment variable. Error: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Trigger GitLab pipeline with retry logic
 */
async function triggerGitLabPipelineWithRetry(source: GitLabSource, accessToken: string, variables: Record<string, string>) {
  const gitlabClient = new GitLabApiClient(source.host!, accessToken)

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
  return pipeline
}

/**
 * Update execution with pipeline info
 */
async function updateExecutionWithPipeline(apiClient: BackendApiClient, executionId: string, pipeline: Awaited<ReturnType<GitLabApiClient['triggerPipeline']>>) {
  const updateResult = await apiClient.updatePipelineExecution(executionId, {
    pipeline_id: pipeline.id.toString(),
    status: 'pending',
    last_status_update: new Date(),
  })

  if (!updateResult.ok) {
    throw new Error(
      `Failed to update pipeline execution ${executionId} with pipeline ID ${pipeline.id}`
    )
  }

  return updateResult.data
}

/**
 * Build pipeline URL
 */
function buildPipelineUrl(source: GitLabSource, pipelineId: number): string {
  return `${source.host}/${source.project_path}/-/pipelines/${pipelineId}`
}

/**
 * Handle pipeline execution error
 */
async function handlePipelineExecutionError(error: unknown, input: TriggerPipelineInput, executionId?: string): Promise<never> {
  const errorMessage = error instanceof Error ? error.message : String(error)
  logger.error(`❌ Pipeline execution failed for session ${input.sessionId}: ${errorMessage}`)

  if (executionId) {
    await input.apiClient.updatePipelineExecution(executionId, {
      status: 'failed',
      last_status_update: new Date(),
    })
  }

  throw error
}

/**
 * Trigger a GitLab pipeline for a session
 */
export async function triggerPipeline(
  input: TriggerPipelineInput
): Promise<TriggerPipelineResult> {
  logger.info(`🚀 Triggering pipeline for session ${input.sessionId}`)

  let executionId: string | undefined

  try {
    const { session } = await fetchAndValidateSession(input.apiClient, input.sessionId)
    const { task } = await fetchAndValidateTask(input.apiClient, session)
    const { project } = await fetchAndValidateProject(input.apiClient, task)
    const { workerRepo, source } = await fetchAndValidateWorkerRepository(input.apiClient, project)

    const execution = await input.apiClient.createPipelineExecution({
      session_id: session.id,
      worker_repository_id: workerRepo.id,
      status: 'pending',
    })
    executionId = execution.id
    logger.info(`✓ Created pipeline execution record: ${execution.id}`)

    const ciConfigPath = determineCiConfigPath(session, workerRepo)
    const variables = buildPipelineVariables(session.id, execution.id, ciConfigPath)
    logger.info(`✓ Pipeline variables prepared`)

    const accessToken = decryptAccessToken(source.access_token_encrypted!)
    const pipeline = await triggerGitLabPipelineWithRetry(source, accessToken, variables)

    const updatedExecution = await updateExecutionWithPipeline(input.apiClient, execution.id, pipeline)
    const pipelineUrl = buildPipelineUrl(source, pipeline.id)

    logger.info(`✅ Pipeline triggered successfully: ${pipelineUrl}`)

    return {
      execution: updatedExecution,
      pipelineUrl,
    }
  } catch (error) {
    return await handlePipelineExecutionError(error, input, executionId)
  }
}
