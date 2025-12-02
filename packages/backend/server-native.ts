/**
 * Native HTTP Server for ADI Backend
 * Uses @adi/http with native Node.js HTTP server
 */

import { createServer, type IncomingMessage, type ServerResponse } from 'http'
import { createHandler } from './utils/custom-native-handler'
import { sql } from '@db/client'
import { createProjectHandlers } from './handlers/projects'
import { createTaskHandlers } from './handlers/tasks'
import { createSessionHandlers } from './handlers/sessions'
import { createPipelineExecutionHandlers } from './handlers/pipeline-executions'
import { createMessageHandlers } from './handlers/messages'
import { createTaskSourceHandlers } from './handlers/task-sources'
import { createAlertHandlers } from './handlers/alerts'
import { createAdminHandlers } from './handlers/admin'
import { createSecretHandlers } from './handlers/secrets'
import { createFileSpaceHandlers } from './handlers/file-spaces'
import { createOAuthHandlers } from './handlers/oauth'
import { createSdkWorkerHandlers } from './handlers/sdk-workers'
import { createLogger } from '@utils/logger'
import { setupGracefulShutdown } from './utils/graceful-shutdown'
import { NotFoundException, BadRequestException, NotEnoughRightsException, AuthRequiredException } from '@utils/exceptions'
import { ALLOWED_ORIGINS } from './config'

const logger = createLogger({ namespace: 'native-server' })

// Create handlers
const projectHandlers = createProjectHandlers(sql)
const taskHandlers = createTaskHandlers(sql)
const sessionHandlers = createSessionHandlers(sql)
const pipelineExecutionHandlers = createPipelineExecutionHandlers(sql)
const messageHandlers = createMessageHandlers(sql)
const taskSourceHandlers = createTaskSourceHandlers(sql)
const alertHandlers = createAlertHandlers()
const adminHandlers = createAdminHandlers(sql)
const secretHandlers = createSecretHandlers(sql)
const fileSpaceHandlers = createFileSpaceHandlers(sql)
const oauthHandlers = createOAuthHandlers(sql)
const sdkWorkerHandlers = createSdkWorkerHandlers(sql)

// Collect all handlers
const allHandlers = [
  // Projects
  projectHandlers.listProjects,
  projectHandlers.getProject,
  projectHandlers.getProjectStats,
  projectHandlers.createProject,
  projectHandlers.updateProject,
  projectHandlers.deleteProject,
  projectHandlers.getProjectAIProviders,
  projectHandlers.updateProjectAIProvider,
  projectHandlers.deleteProjectAIProvider,
  projectHandlers.validateProjectAIProvider,
  projectHandlers.getProjectGitLabExecutor,
  projectHandlers.createProjectGitLabExecutor,
  projectHandlers.deleteProjectGitLabExecutor,
  // Tasks
  taskHandlers.getTaskSessions,
  taskHandlers.getTaskArtifacts,
  taskHandlers.listTasks,
  taskHandlers.getTaskStats,  // Register static route before dynamic route
  taskHandlers.getTask,
  taskHandlers.createTask,
  taskHandlers.implementTask,
  taskHandlers.evaluateTask,
  taskHandlers.evaluateTaskAdvanced,
  taskHandlers.updateTaskImplementationStatus,
  taskHandlers.updateTask,
  taskHandlers.deleteTask,
  // Sessions
  sessionHandlers.getSessionMessages,
  sessionHandlers.getSessionPipelineExecutions,
  sessionHandlers.getSession,
  sessionHandlers.listSessions,
  // Pipeline Executions
  pipelineExecutionHandlers.listPipelineArtifacts,
  pipelineExecutionHandlers.getExecutionArtifacts,
  pipelineExecutionHandlers.createExecutionArtifact,
  pipelineExecutionHandlers.createPipelineExecution,
  pipelineExecutionHandlers.updatePipelineExecution,
  pipelineExecutionHandlers.saveExecutionApiUsage,
  // Messages
  messageHandlers.listMessages,
  // Task Sources
  taskSourceHandlers.listTaskSources,
  taskSourceHandlers.getTaskSource,
  taskSourceHandlers.createTaskSource,
  taskSourceHandlers.updateTaskSource,
  taskSourceHandlers.deleteTaskSource,
  taskSourceHandlers.syncTaskSource,
  // Alerts
  alertHandlers.listAlerts,
  // Admin
  adminHandlers.getUsageMetrics,
  adminHandlers.getWorkerRepos,
  adminHandlers.refreshWorkerRepos,
  // Secrets
  secretHandlers.listSecrets,
  secretHandlers.getSecretsByProject,
  secretHandlers.getSecret,
  secretHandlers.getSecretValue,
  secretHandlers.createSecret,
  secretHandlers.validateGitLabRawToken,
  secretHandlers.validateGitLabToken,
  secretHandlers.getGitLabRepositories,
  secretHandlers.validateJiraRawToken,
  secretHandlers.validateJiraToken,
  // File Spaces
  fileSpaceHandlers.listFileSpaces,
  fileSpaceHandlers.getFileSpace,
  fileSpaceHandlers.createFileSpace,
  fileSpaceHandlers.updateFileSpace,
  fileSpaceHandlers.deleteFileSpace,
  fileSpaceHandlers.getTaskFileSpaces,
  // OAuth
  oauthHandlers.gitlabAuthorize,
  oauthHandlers.gitlabExchange,
  oauthHandlers.gitlabRefresh,
  oauthHandlers.jiraAuthorize,
  oauthHandlers.jiraExchange,
  oauthHandlers.jiraRefresh,
  oauthHandlers.githubAuthorize,
  oauthHandlers.githubExchange,
  // SDK Workers
  sdkWorkerHandlers.listSdkWorkers,
  sdkWorkerHandlers.getSdkWorker,
  sdkWorkerHandlers.createSdkWorker,
  sdkWorkerHandlers.deleteSdkWorker,
  sdkWorkerHandlers.sdkWorkerRegister,
  sdkWorkerHandlers.sdkWorkerHeartbeat,
  sdkWorkerHandlers.sdkWorkerGetNext,
  sdkWorkerHandlers.sdkWorkerPostMessage,
  sdkWorkerHandlers.sdkWorkerFinish,
  sdkWorkerHandlers.sdkWorkerGetMessages,
]

// Create native request handler
const requestHandler = createHandler(allHandlers as Parameters<typeof createHandler>[0])

// CORS and middleware wrapper
const wrappedHandler = async (req: IncomingMessage, res: ServerResponse) => {
  // Handle CORS - validate origin against allowed list
  const requestOrigin = req.headers.origin

  // Check if origin is in allowed list
  if (requestOrigin && ALLOWED_ORIGINS.includes(requestOrigin)) {
    res.setHeader('Access-Control-Allow-Origin', requestOrigin)
    res.setHeader('Access-Control-Allow-Credentials', 'true')
  } else if (!requestOrigin && req.headers.host) {
    // Allow same-origin requests (no origin header)
    // This is normal for requests from the same origin
  } else if (requestOrigin) {
    // Origin not allowed - reject the request
    logger.warn(`CORS: Rejected origin ${requestOrigin}. Allowed origins:`, ALLOWED_ORIGINS)
    res.writeHead(403, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Forbidden',
      message: 'Origin not allowed by CORS policy'
    }))
    return
  }

  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization')
  res.setHeader('Access-Control-Expose-Headers', 'Content-Length')
  res.setHeader('Access-Control-Max-Age', '600')

  // Handle OPTIONS (preflight)
  if (req.method === 'OPTIONS') {
    res.writeHead(204)
    res.end()
    return
  }

  // Health check
  if (req.url === '/healthcheck') {
    res.writeHead(200, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }))
    return
  }

  // Pass to native handler with error handling
  try {
    await requestHandler(req, res)
  } catch (error) {
    // Handle custom exceptions with appropriate status codes
    if (error instanceof NotFoundException) {
      res.writeHead(404, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Not Found', message: error.message }))
      return
    }

    if (error instanceof BadRequestException) {
      res.writeHead(400, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Bad Request', message: error.message }))
      return
    }

    if (error instanceof AuthRequiredException) {
      res.writeHead(401, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Unauthorized', message: error.message }))
      return
    }

    if (error instanceof NotEnoughRightsException) {
      res.writeHead(403, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify({ error: 'Forbidden', message: error.message }))
      return
    }

    // Log unexpected errors
    logger.error('Unhandled error in request handler:', error)

    // Generic 500 error for unexpected exceptions
    res.writeHead(500, { 'Content-Type': 'application/json' })
    res.end(JSON.stringify({
      error: 'Internal Server Error',
      message: error instanceof Error ? error.message : 'Unknown error'
    }))
  }
}

// Create and start server
const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 5174
const server = createServer(wrappedHandler)

server.listen(PORT, () => {
  logger.info(`🚀 Native HTTP server running on http://localhost:${PORT}`)
  logger.info(`📝 Routes registered: ${allHandlers.length}`)
})

// Setup graceful shutdown
setupGracefulShutdown({
  logger,
  serviceName: 'HTTP Server',
  cleanup: async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        logger.info('HTTP server closed')
        resolve()
      })
    })
  }
})

export { server }
