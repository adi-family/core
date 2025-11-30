/**
 * SDK Worker handlers - endpoints for managing SDK workers and their task lifecycle
 */

import type { Sql } from 'postgres'
import {
  listSdkWorkersConfig,
  getSdkWorkerConfig,
  createSdkWorkerConfig,
  deleteSdkWorkerConfig,
  sdkWorkerRegisterConfig,
  sdkWorkerHeartbeatConfig,
  sdkWorkerGetNextConfig,
  sdkWorkerPostMessageConfig,
  sdkWorkerFinishConfig,
  sdkWorkerGetMessagesConfig
} from '@adi/api-contracts/sdk-workers'
import * as sdkWorkerQueries from '@db/sdk-workers'
import * as sessionQueries from '@db/sessions'
import * as taskQueries from '@db/tasks'
import * as projectQueries from '@db/projects'
import { createSecuredHandlers } from '../utils/auth'
import { handler as baseHandler, type HandlerContext } from '@adi-family/http'
import { createLogger } from '@utils/logger'
import { BadRequestException, AuthRequiredException } from '@utils/exceptions'
import type { SdkWorkerCapabilities } from '@adi-simple/types'

const logger = createLogger({ namespace: 'sdk-workers-handlers' })

interface HttpError extends Error {
  statusCode: number
}

function createHttpError(message: string, statusCode: number): HttpError {
  const error = new Error(message) as HttpError
  error.statusCode = statusCode
  return error
}

/**
 * Authenticate SDK worker by API key from Authorization header
 */
async function authenticateSdkWorker(
  sql: Sql,
  ctx: HandlerContext<unknown, unknown, unknown>
): Promise<{ worker: Awaited<ReturnType<typeof sdkWorkerQueries.findSdkWorkerById>> }> {
  const authHeader = ctx.headers.get('Authorization')
  if (!authHeader) {
    throw new AuthRequiredException('No Authorization header')
  }

  const token = authHeader.replace('Bearer ', '')
  if (!token || !token.startsWith('sdk_')) {
    throw new AuthRequiredException('Invalid SDK worker API key format')
  }

  const apiKeyHash = sdkWorkerQueries.hashApiKey(token)
  const worker = await sdkWorkerQueries.findSdkWorkerByApiKeyHash(sql, apiKeyHash)

  if (!worker) {
    throw new AuthRequiredException('Invalid SDK worker API key')
  }

  return { worker }
}

export function createSdkWorkerHandlers(sql: Sql) {
  const { handler } = createSecuredHandlers(sql)

  // Admin/UI endpoints - require user authentication

  const listSdkWorkers = handler(listSdkWorkersConfig, async (ctx) => {
    const { projectId } = ctx.params
    await ctx.acl.project(projectId).viewer()
    return sdkWorkerQueries.findSdkWorkersByProjectId(sql, projectId)
  })

  const getSdkWorker = handler(getSdkWorkerConfig, async (ctx) => {
    const { workerId } = ctx.params
    const worker = await sdkWorkerQueries.findSdkWorkerById(sql, workerId)
    await ctx.acl.project(worker.project_id).viewer()
    return worker
  })

  const createSdkWorker = handler(createSdkWorkerConfig, async (ctx) => {
    const { project_id, name, description, capabilities } = ctx.body
    await ctx.acl.project(project_id).developer()

    // Generate API key
    const apiKey = sdkWorkerQueries.generateApiKey()
    const apiKeyHash = sdkWorkerQueries.hashApiKey(apiKey)

    const worker = await sdkWorkerQueries.createSdkWorker(sql, {
      project_id,
      name,
      description,
      api_key_hash: apiKeyHash,
      capabilities,
      metadata: {}
    })

    logger.info(`Created SDK worker ${worker.id} for project ${project_id}`)

    return {
      worker,
      apiKey // Only returned once!
    }
  })

  const deleteSdkWorker = handler(deleteSdkWorkerConfig, async (ctx) => {
    const { workerId } = ctx.params
    const worker = await sdkWorkerQueries.findSdkWorkerById(sql, workerId)
    await ctx.acl.project(worker.project_id).developer()

    await sdkWorkerQueries.deleteSdkWorker(sql, workerId)
    logger.info(`Deleted SDK worker ${workerId}`)

    return { success: true }
  })

  // SDK Worker API endpoints - authenticate via SDK worker API key

  const sdkWorkerRegister = handler(sdkWorkerRegisterConfig, async (ctx) => {
    const { projectId } = ctx.params
    const { name, description, capabilities, metadata } = ctx.body

    // For registration, we need user auth to create the worker
    await ctx.acl.project(projectId).developer()

    // Generate API key
    const apiKey = sdkWorkerQueries.generateApiKey()
    const apiKeyHash = sdkWorkerQueries.hashApiKey(apiKey)

    const worker = await sdkWorkerQueries.createSdkWorker(sql, {
      project_id: projectId,
      name,
      description,
      api_key_hash: apiKeyHash,
      capabilities,
      metadata
    })

    logger.info(`Registered SDK worker ${worker.id} for project ${projectId}`)

    return {
      worker,
      apiKey
    }
  })

  // These endpoints use SDK worker API key authentication
  const sdkWorkerHeartbeat = baseHandler(sdkWorkerHeartbeatConfig, async (ctx) => {
    try {
      const { worker } = await authenticateSdkWorker(sql, ctx)
      const { status, metadata } = ctx.body

      const updatedWorker = await sdkWorkerQueries.updateSdkWorkerHeartbeat(
        sql,
        worker.id,
        status,
        metadata
      )

      return updatedWorker
    } catch (error) {
      if (error instanceof AuthRequiredException) {
        throw createHttpError(error.message, 401)
      }
      throw error
    }
  })

  const sdkWorkerGetNext = baseHandler(sdkWorkerGetNextConfig, async (ctx) => {
    try {
      const { worker } = await authenticateSdkWorker(sql, ctx)

      // Get next pending task for this worker
      const task = await sdkWorkerQueries.getNextTaskForSdkWorker(sql, worker.id)

      if (!task) {
        return { task: null, context: null }
      }

      // Fetch session and related data to build context
      const session = await sessionQueries.findSessionById(sql, task.session_id)
      if (!session || !session.task_id) {
        return { task: null, context: null }
      }

      const taskData = await taskQueries.findTaskById(sql, session.task_id)
      if (!taskData || !taskData.project_id) {
        return { task: null, context: null }
      }

      const project = await projectQueries.findProjectById(sql, taskData.project_id)

      // Mark task as in progress
      await sdkWorkerQueries.updateSdkWorkerTask(sql, task.id, {
        status: 'in_progress',
        started_at: new Date()
      })

      // Build context for the worker
      const context = {
        taskId: taskData.id,
        sessionId: session.id,
        projectId: project.id,
        taskType: session.runner === 'evaluation' ? 'evaluation' as const : 'implementation' as const,
        task: taskData,
        project,
        aiProvider: project.ai_provider_configs,
        timeout: (worker.capabilities as SdkWorkerCapabilities | undefined)?.timeout || 3600000
      }

      return { task, context }
    } catch (error) {
      if (error instanceof AuthRequiredException) {
        throw createHttpError(error.message, 401)
      }
      throw error
    }
  })

  const sdkWorkerPostMessage = baseHandler(sdkWorkerPostMessageConfig, async (ctx) => {
    try {
      const { worker } = await authenticateSdkWorker(sql, ctx)
      const { taskId, messageType, payload } = ctx.body

      // Verify task belongs to this worker
      const task = await sdkWorkerQueries.findSdkWorkerTaskById(sql, taskId)
      if (task.worker_id !== worker.id) {
        throw new BadRequestException('Task does not belong to this worker')
      }

      const message = await sdkWorkerQueries.createSdkWorkerMessage(sql, {
        task_id: taskId,
        direction: 'worker_to_server',
        message_type: messageType,
        payload
      })

      return message
    } catch (error) {
      if (error instanceof AuthRequiredException || error instanceof BadRequestException) {
        throw createHttpError(error.message, error instanceof AuthRequiredException ? 401 : 400)
      }
      throw error
    }
  })

  const sdkWorkerFinish = baseHandler(sdkWorkerFinishConfig, async (ctx) => {
    try {
      const { worker } = await authenticateSdkWorker(sql, ctx)
      const { taskId, status, result, error } = ctx.body

      // Verify task belongs to this worker
      const task = await sdkWorkerQueries.findSdkWorkerTaskById(sql, taskId)
      if (task.worker_id !== worker.id) {
        throw new BadRequestException('Task does not belong to this worker')
      }

      // Update task status
      const updatedTask = await sdkWorkerQueries.updateSdkWorkerTask(sql, taskId, {
        status,
        completed_at: new Date(),
        result,
        error
      })

      // Update session based on result
      const session = await sessionQueries.findSessionById(sql, task.session_id)
      if (session) {
        await sessionQueries.updateSession(sql, session.id, {
          executed_by_worker_type: 'sdk'
        })
      }

      // Mark worker as online (available for new tasks)
      await sdkWorkerQueries.updateSdkWorker(sql, worker.id, { status: 'online' })

      logger.info(`SDK worker ${worker.id} finished task ${taskId} with status ${status}`)

      return updatedTask
    } catch (error) {
      if (error instanceof AuthRequiredException || error instanceof BadRequestException) {
        throw createHttpError(error.message, error instanceof AuthRequiredException ? 401 : 400)
      }
      throw error
    }
  })

  const sdkWorkerGetMessages = baseHandler(sdkWorkerGetMessagesConfig, async (ctx) => {
    try {
      const { worker } = await authenticateSdkWorker(sql, ctx)
      const { taskId } = ctx.params

      // Verify task belongs to this worker
      const task = await sdkWorkerQueries.findSdkWorkerTaskById(sql, taskId)
      if (task.worker_id !== worker.id) {
        throw new BadRequestException('Task does not belong to this worker')
      }

      return sdkWorkerQueries.findSdkWorkerMessagesByTaskId(sql, taskId)
    } catch (error) {
      if (error instanceof AuthRequiredException || error instanceof BadRequestException) {
        throw createHttpError(error.message, error instanceof AuthRequiredException ? 401 : 400)
      }
      throw error
    }
  })

  return {
    // Admin/UI endpoints
    listSdkWorkers,
    getSdkWorker,
    createSdkWorker,
    deleteSdkWorker,
    // SDK Worker API endpoints
    sdkWorkerRegister,
    sdkWorkerHeartbeat,
    sdkWorkerGetNext,
    sdkWorkerPostMessage,
    sdkWorkerFinish,
    sdkWorkerGetMessages
  }
}
