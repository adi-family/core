import { Hono } from 'hono'
import { sql } from './db'
import { createTaskHandlers } from './handlers/tasks'
import { createSessionHandlers } from './handlers/sessions'
import { createMessageHandlers } from './handlers/messages'

const app = new Hono()

const taskHandlers = createTaskHandlers(sql)
const sessionHandlers = createSessionHandlers(sql)
const messageHandlers = createMessageHandlers(sql)

// Tasks
app.get('/tasks', taskHandlers.list)
app.post('/tasks', taskHandlers.create)
app.get('/tasks/:id', taskHandlers.get)
app.patch('/tasks/:id', taskHandlers.update)
app.delete('/tasks/:id', taskHandlers.delete)

// Sessions
app.get('/sessions', sessionHandlers.list)
app.post('/sessions', sessionHandlers.create)
app.get('/sessions/:id', sessionHandlers.get)
app.delete('/sessions/:id', sessionHandlers.delete)
app.get('/tasks/:taskId/sessions', sessionHandlers.listByTask)

// Messages
app.get('/messages', messageHandlers.list)
app.post('/messages', messageHandlers.create)
app.get('/messages/:id', messageHandlers.get)
app.delete('/messages/:id', messageHandlers.delete)
app.get('/sessions/:sessionId/messages', messageHandlers.listBySession)

export { app }
export type AppType = typeof app
