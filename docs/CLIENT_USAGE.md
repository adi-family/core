# Client Usage Guide

## Overview

The ADI API uses **Hono RPC** for type-safe client-server communication. The backend exports its app type (`AppType`), which clients import to get full TypeScript type inference for all routes, parameters, and request/response bodies.

## Installation

```bash
bun add hono
```

## Creating a Client

```typescript
import { hc } from 'hono/client'
import type { AppType } from '@adi/backend/app'

const client = hc<AppType>('http://localhost:3000')
```

## API Reference

### Tasks

**List all tasks**
```typescript
const res = await client.tasks.$get()
const tasks = await res.json() // Type: Task[]
```

**Create a task**
```typescript
const res = await client.tasks.$post({
  json: {
    title: 'Implement feature X',
    status: 'pending',
    description: 'Add new feature',
    source_gitlab_issue: { id: 123, url: 'https://gitlab.com/...' }
  }
})
const task = await res.json() // Type: Task
```

**Get a task**
```typescript
const res = await client.tasks[':id'].$get({
  param: { id: 'task-uuid-here' }
})
const task = await res.json() // Type: Task
```

**Update a task**
```typescript
const res = await client.tasks[':id'].$patch({
  param: { id: 'task-uuid-here' },
  json: { status: 'in_progress' }
})
const task = await res.json() // Type: Task
```

**Delete a task**
```typescript
const res = await client.tasks[':id'].$delete({
  param: { id: 'task-uuid-here' }
})
```

### Sessions

**List all sessions**
```typescript
const res = await client.sessions.$get()
const sessions = await res.json() // Type: Session[]
```

**Create a session**
```typescript
const res = await client.sessions.$post({
  json: {
    task_id: 'task-uuid-here', // optional
    runner: 'cloud' // or 'codex', etc.
  }
})
const session = await res.json() // Type: Session
```

**Get a session**
```typescript
const res = await client.sessions[':id'].$get({
  param: { id: 'session-uuid-here' }
})
const session = await res.json() // Type: Session
```

**Get sessions for a task**
```typescript
const res = await client.tasks[':taskId'].sessions.$get({
  param: { taskId: 'task-uuid-here' }
})
const sessions = await res.json() // Type: Session[]
```

**Delete a session**
```typescript
const res = await client.sessions[':id'].$delete({
  param: { id: 'session-uuid-here' }
})
```

### Messages

**Create a message**
```typescript
const res = await client.messages.$post({
  json: {
    session_id: 'session-uuid-here',
    data: { role: 'user', content: 'Hello!' }
  }
})
const message = await res.json() // Type: Message
```

**Get a message**
```typescript
const res = await client.messages[':id'].$get({
  param: { id: 'message-uuid-here' }
})
const message = await res.json() // Type: Message
```

**Get messages for a session**
```typescript
const res = await client.sessions[':sessionId'].messages.$get({
  param: { sessionId: 'session-uuid-here' }
})
const messages = await res.json() // Type: Message[]
```

**Delete a message**
```typescript
const res = await client.messages[':id'].$delete({
  param: { id: 'message-uuid-here' }
})
```

## Type Safety

### Single Source of Truth

The backend (`backend/app.ts`) exports `AppType`:
```typescript
export type AppType = typeof app
```

Clients import this type and get:
- ✅ Full autocomplete for all routes
- ✅ Type checking for request bodies
- ✅ Inferred response types
- ✅ Compile-time errors when backend changes

### No Manual Type Definitions

You **never** need to manually define request/response types. Everything is inferred from the backend.

### Example: Type Flow

```typescript
// Backend (backend/handlers/tasks.ts)
export const createTaskHandlers = (sql: Sql) => ({
  create: async (c: Context) => {
    const body = await c.req.json()
    const task = await queries.createTask(sql)(body)
    return c.json(task, 201)  // Return type: Task
  }
})

// Client (your app)
const res = await client.tasks.$post({
  json: {
    title: 'New task',  // TypeScript knows these fields!
    status: 'pending'
  }
})
const task = await res.json()  // Type is automatically Task
```

## Complete Example

```typescript
import { hc } from 'hono/client'
import type { AppType } from '@adi/backend/app'

const client = hc<AppType>('http://localhost:3000')

// Create a task
const taskRes = await client.tasks.$post({
  json: {
    title: 'Implement authentication',
    status: 'pending',
    source_github_issue: { number: 42 }
  }
})
const task = await taskRes.json()

// Create a session for the task
const sessionRes = await client.sessions.$post({
  json: {
    task_id: task.id,
    runner: 'cloud'
  }
})
const session = await sessionRes.json()

// Add messages to the session
await client.messages.$post({
  json: {
    session_id: session.id,
    data: { role: 'user', content: 'Start implementing' }
  }
})

await client.messages.$post({
  json: {
    session_id: session.id,
    data: { role: 'assistant', content: 'I will implement authentication' }
  }
})

// Retrieve all messages
const messagesRes = await client.sessions[':sessionId'].messages.$get({
  param: { sessionId: session.id }
})
const messages = await messagesRes.json()

console.log('Conversation:', messages)
```

## Best Practices

1. **Import AppType from backend** - Don't duplicate types
2. **Use JSONB fields flexibly** - `data`, `source_*` can hold any structure
3. **Check response status** - `res.ok` before calling `res.json()`
4. **Centralize client creation** - Create once, reuse everywhere
5. **Type assertions only when necessary** - Let inference do the work

## Error Handling

```typescript
const res = await client.tasks[':id'].$get({
  param: { id: 'invalid-id' }
})

if (!res.ok) {
  const error = await res.json() // { error: string }
  console.error('Failed:', error)
  return
}

const task = await res.json()
console.log('Success:', task)
```

## Notes

- All IDs are UUIDs generated by the database
- Timestamps are automatically managed by the database
- JSONB fields (`data`, `source_*`) accept any valid JSON
- Sessions can exist without a task (`task_id` is nullable)
