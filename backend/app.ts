import { Hono } from 'hono'
import { sql } from './db'
import { createProjectHandlers } from './handlers/projects'
import { createTaskHandlers } from './handlers/tasks'
import { createSessionHandlers } from './handlers/sessions'
import { createMessageHandlers } from './handlers/messages'
import { createWorkerCacheHandlers } from './handlers/worker-cache'

const app = new Hono()

const projectHandlers = createProjectHandlers(sql)
const taskHandlers = createTaskHandlers(sql)
const sessionHandlers = createSessionHandlers(sql)
const messageHandlers = createMessageHandlers(sql)
const workerCacheHandlers = createWorkerCacheHandlers(sql)

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

export { app }
export type AppType = typeof app
