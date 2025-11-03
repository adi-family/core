/**
 * Native HTTP Server for ADI Backend
 * Uses @adi/http with native Node.js HTTP server
 */

import { createServer } from 'http'
import { createHandler } from '@adi-family/http-native'
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
import { createLogger } from '@utils/logger'

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

// Collect all handlers
const allHandlers = [
  // Projects
  projectHandlers.listProjects,
  projectHandlers.getProject,
  projectHandlers.getProjectStats,
  projectHandlers.createProject,
  projectHandlers.updateProject,
  projectHandlers.deleteProject,
  // Tasks
  taskHandlers.getTaskSessions,
  taskHandlers.getTaskArtifacts,
  taskHandlers.listTasks,
  taskHandlers.getTask,
  taskHandlers.implementTask,
  taskHandlers.evaluateTask,
  // Sessions
  sessionHandlers.getSessionMessages,
  sessionHandlers.getSessionPipelineExecutions,
  sessionHandlers.listSessions,
  // Pipeline Executions
  pipelineExecutionHandlers.getExecutionArtifacts,
  pipelineExecutionHandlers.createExecutionArtifact,
  pipelineExecutionHandlers.updatePipelineExecution,
  // Messages
  messageHandlers.listMessages,
  // Task Sources
  taskSourceHandlers.listTaskSources,
  taskSourceHandlers.syncTaskSource,
  // Alerts
  alertHandlers.listAlerts,
  // Admin
  adminHandlers.getUsageMetrics,
  // Secrets
  secretHandlers.listSecrets,
  secretHandlers.getSecretsByProject,
  // File Spaces
  fileSpaceHandlers.listFileSpaces,
]

// Create native request handler
const requestHandler = createHandler(allHandlers)

// CORS and middleware wrapper
const wrappedHandler = async (req: any, res: any) => {
  // Handle CORS
  const origin = req.headers.origin || 'http://localhost:4173'
  res.setHeader('Access-Control-Allow-Origin', origin)
  res.setHeader('Access-Control-Allow-Credentials', 'true')
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

  // Pass to native handler
  await requestHandler(req, res)
}

// Create and start server
const PORT = process.env.SERVER_PORT ? parseInt(process.env.SERVER_PORT) : 5174
const server = createServer(wrappedHandler)

server.listen(PORT, () => {
  logger.info(`🚀 Native HTTP server running on http://localhost:${PORT}`)
  logger.info(`📝 Routes registered: ${allHandlers.length}`)
})

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  logger.info('SIGINT signal received: closing HTTP server')
  server.close(() => {
    logger.info('HTTP server closed')
    process.exit(0)
  })
})

export { server }
