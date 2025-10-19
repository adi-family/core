import { Hono } from 'hono'
import { sql } from '../db/client'
import { createProjectHandlers } from './handlers/projects'
import { createTaskHandlers } from './handlers/tasks'
import { createSessionHandlers } from './handlers/sessions'
import { createMessageHandlers } from './handlers/messages'
import { createWorkerCacheHandlers } from './handlers/worker-cache'
import { createFileSpaceHandlers } from './handlers/file-spaces'
import { createTaskSourceHandlers } from './handlers/task-sources'
import { createWorkerRepositoryHandlers } from './handlers/worker-repositories'
import { createPipelineExecutionHandlers } from './handlers/pipeline-executions'
import { createPipelineArtifactHandlers } from './handlers/pipeline-artifacts'
import { createWebhookHandlers } from './handlers/webhooks'
import { authMiddleware } from './middleware/auth'

const app = new Hono()

const projectHandlers = createProjectHandlers(sql)
const taskHandlers = createTaskHandlers(sql)
const sessionHandlers = createSessionHandlers(sql)
const messageHandlers = createMessageHandlers(sql)
const workerCacheHandlers = createWorkerCacheHandlers(sql)
const fileSpaceHandlers = createFileSpaceHandlers(sql)
const taskSourceHandlers = createTaskSourceHandlers(sql)
const workerRepositoryHandlers = createWorkerRepositoryHandlers(sql)
const pipelineExecutionHandlers = createPipelineExecutionHandlers(sql)
const pipelineArtifactHandlers = createPipelineArtifactHandlers(sql)
const webhookHandlers = createWebhookHandlers(sql)

app.get('/projects', projectHandlers.list)
app.post('/projects', projectHandlers.create)
app.get('/projects/:id', projectHandlers.get)
app.patch('/projects/:id', projectHandlers.update)
app.delete('/projects/:id', projectHandlers.delete)

app.get('/tasks', taskHandlers.list)
app.post('/tasks', taskHandlers.create)
app.get('/tasks/:id', taskHandlers.get)
app.patch('/tasks/:id', taskHandlers.update)
app.delete('/tasks/:id', taskHandlers.delete)

app.get('/sessions', sessionHandlers.list)
app.post('/sessions', sessionHandlers.create)
app.get('/sessions/:id', sessionHandlers.get)
app.delete('/sessions/:id', sessionHandlers.delete)
app.get('/tasks/:taskId/sessions', sessionHandlers.listByTask)

app.get('/messages', messageHandlers.list)
app.post('/messages', messageHandlers.create)
app.get('/messages/:id', messageHandlers.get)
app.delete('/messages/:id', messageHandlers.delete)
app.get('/sessions/:sessionId/messages', messageHandlers.listBySession)

app.get('/worker-cache', workerCacheHandlers.list)
app.post('/projects/:projectId/worker-cache/is-signaled', workerCacheHandlers.isSignaledBefore)
app.post('/projects/:projectId/worker-cache/try-acquire-lock', workerCacheHandlers.tryAcquireLock)
app.post('/projects/:projectId/worker-cache/release-lock', workerCacheHandlers.releaseLock)
app.post('/projects/:projectId/worker-cache/signal', workerCacheHandlers.signal)
app.get('/projects/:projectId/worker-cache/:issueId/task-id', workerCacheHandlers.getTaskId)

app.get('/file-spaces', fileSpaceHandlers.list)
app.post('/file-spaces', fileSpaceHandlers.create)
app.get('/file-spaces/:id', fileSpaceHandlers.get)
app.patch('/file-spaces/:id', fileSpaceHandlers.update)
app.delete('/file-spaces/:id', fileSpaceHandlers.delete)

app.get('/task-sources', taskSourceHandlers.list)
app.post('/task-sources', taskSourceHandlers.create)
app.get('/task-sources/:id', taskSourceHandlers.get)
app.patch('/task-sources/:id', taskSourceHandlers.update)
app.delete('/task-sources/:id', taskSourceHandlers.delete)
app.post('/task-sources/:id/sync', taskSourceHandlers.sync)

app.get('/worker-repositories', workerRepositoryHandlers.list)
app.post('/worker-repositories', workerRepositoryHandlers.create)
app.get('/worker-repositories/:id', workerRepositoryHandlers.get)
app.get('/projects/:projectId/worker-repository', workerRepositoryHandlers.getByProjectId)
app.patch('/worker-repositories/:id', workerRepositoryHandlers.update)
app.delete('/worker-repositories/:id', workerRepositoryHandlers.delete)

app.get('/pipeline-executions', pipelineExecutionHandlers.list)
app.get('/pipeline-executions/stale', pipelineExecutionHandlers.listStale)
app.post('/pipeline-executions', pipelineExecutionHandlers.create)
app.get('/pipeline-executions/:id', pipelineExecutionHandlers.get)
app.patch('/pipeline-executions/:id', authMiddleware, pipelineExecutionHandlers.update)
app.delete('/pipeline-executions/:id', pipelineExecutionHandlers.delete)
app.get('/sessions/:sessionId/pipeline-executions', pipelineExecutionHandlers.getBySessionId)

app.get('/pipeline-artifacts', pipelineArtifactHandlers.list)
app.get('/pipeline-artifacts/:id', pipelineArtifactHandlers.get)
app.delete('/pipeline-artifacts/:id', pipelineArtifactHandlers.delete)
app.get('/pipeline-executions/:executionId/artifacts', pipelineArtifactHandlers.getByExecutionId)
app.post('/pipeline-executions/:executionId/artifacts', authMiddleware, pipelineArtifactHandlers.create)

// Webhooks (no auth middleware - verified via webhook tokens)
app.post('/webhooks/gitlab', webhookHandlers.gitlab)
app.post('/webhooks/jira', webhookHandlers.jira)
app.post('/webhooks/github', webhookHandlers.github)

export { app }
export type AppType = typeof app
