import type { Sql } from 'postgres'
import type {
  SdkWorker,
  SdkWorkerTask,
  SdkWorkerMessage,
  SdkWorkerStatus,
  SdkWorkerCapabilities,
  SdkWorkerTaskStatus
} from '@types'
import { get, findOneById, deleteById } from './utils'
import { NotFoundException } from '../utils/exceptions'
import crypto from 'crypto'

// SDK Worker CRUD operations

export const findAllSdkWorkers = async (sql: Sql): Promise<SdkWorker[]> =>
  get(sql<SdkWorker[]>`SELECT * FROM sdk_workers ORDER BY created_at DESC`)

export const findSdkWorkerById = async (sql: Sql, id: string): Promise<SdkWorker> =>
  findOneById<SdkWorker>(sql, 'sdk_workers', id, 'SDK Worker')

export const findSdkWorkerByApiKeyHash = async (sql: Sql, apiKeyHash: string): Promise<SdkWorker | null> => {
  const [worker] = await get(sql<SdkWorker[]>`
    SELECT * FROM sdk_workers WHERE api_key_hash = ${apiKeyHash}
  `)
  return worker || null
}

export const findSdkWorkersByProjectId = async (sql: Sql, projectId: string): Promise<SdkWorker[]> =>
  get(sql<SdkWorker[]>`
    SELECT * FROM sdk_workers WHERE project_id = ${projectId} ORDER BY created_at DESC
  `)

export const findOnlineSdkWorkersByProjectId = async (sql: Sql, projectId: string): Promise<SdkWorker[]> =>
  get(sql<SdkWorker[]>`
    SELECT * FROM sdk_workers
    WHERE project_id = ${projectId} AND status IN ('online', 'busy')
    ORDER BY last_heartbeat_at DESC
  `)

interface CreateSdkWorkerDbInput {
  project_id: string
  name: string
  description?: string | null
  api_key_hash: string
  capabilities?: SdkWorkerCapabilities
  metadata?: Record<string, unknown>
}

export const createSdkWorker = async (sql: Sql, input: CreateSdkWorkerDbInput): Promise<SdkWorker> => {
  const [worker] = await get(sql<SdkWorker[]>`
    INSERT INTO sdk_workers (
      project_id, name, description, api_key_hash, capabilities, metadata
    ) VALUES (
      ${input.project_id},
      ${input.name},
      ${input.description || null},
      ${input.api_key_hash},
      ${JSON.stringify(input.capabilities || {})}::jsonb,
      ${JSON.stringify(input.metadata || {})}::jsonb
    )
    RETURNING *
  `)
  if (!worker) {
    throw new Error('Failed to create SDK worker')
  }
  return worker
}

interface UpdateSdkWorkerInput {
  name?: string
  description?: string | null
  status?: SdkWorkerStatus
  capabilities?: SdkWorkerCapabilities
  metadata?: Record<string, unknown>
  last_heartbeat_at?: Date
}

export const updateSdkWorker = async (sql: Sql, id: string, input: UpdateSdkWorkerInput): Promise<SdkWorker> => {
  const sets: string[] = []
  const values: (string | Date | null)[] = []
  let paramIdx = 1

  if (input.name !== undefined) {
    sets.push(`name = $${paramIdx++}`)
    values.push(input.name)
  }
  if (input.description !== undefined) {
    sets.push(`description = $${paramIdx++}`)
    values.push(input.description)
  }
  if (input.status !== undefined) {
    sets.push(`status = $${paramIdx++}`)
    values.push(input.status)
  }
  if (input.capabilities !== undefined) {
    sets.push(`capabilities = $${paramIdx++}::jsonb`)
    values.push(JSON.stringify(input.capabilities))
  }
  if (input.metadata !== undefined) {
    sets.push(`metadata = $${paramIdx++}::jsonb`)
    values.push(JSON.stringify(input.metadata))
  }
  if (input.last_heartbeat_at !== undefined) {
    sets.push(`last_heartbeat_at = $${paramIdx++}`)
    values.push(input.last_heartbeat_at)
  }

  sets.push('updated_at = NOW()')
  values.push(id)

  const query = `UPDATE sdk_workers SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`
  const results = await get(sql.unsafe<SdkWorker[]>(query, values))
  const [worker] = results
  if (!worker) {
    throw new NotFoundException('SDK Worker not found')
  }
  return worker
}

export const deleteSdkWorker = async (sql: Sql, id: string): Promise<void> =>
  deleteById(sql, 'sdk_workers', id, 'SDK Worker')

export const updateSdkWorkerHeartbeat = async (
  sql: Sql,
  id: string,
  status?: SdkWorkerStatus,
  metadata?: Record<string, unknown>
): Promise<SdkWorker> => {
  const updateData: UpdateSdkWorkerInput = {
    last_heartbeat_at: new Date()
  }
  if (status) updateData.status = status
  if (metadata) updateData.metadata = metadata
  return updateSdkWorker(sql, id, updateData)
}

// Mark workers as offline if no heartbeat in last 60 seconds
export const markStaleWorkersOffline = async (sql: Sql): Promise<number> => {
  const result = await get(sql`
    UPDATE sdk_workers
    SET status = 'offline', updated_at = NOW()
    WHERE status IN ('online', 'busy')
      AND last_heartbeat_at < NOW() - INTERVAL '60 seconds'
    RETURNING id
  `)
  return result.length
}

// SDK Worker Task operations

export const findSdkWorkerTaskById = async (sql: Sql, id: string): Promise<SdkWorkerTask> =>
  findOneById<SdkWorkerTask>(sql, 'sdk_worker_tasks', id, 'SDK Worker Task')

export const findSdkWorkerTasksByWorkerId = async (sql: Sql, workerId: string): Promise<SdkWorkerTask[]> =>
  get(sql<SdkWorkerTask[]>`
    SELECT * FROM sdk_worker_tasks WHERE worker_id = ${workerId} ORDER BY created_at DESC
  `)

export const findPendingSdkWorkerTasksByWorkerId = async (sql: Sql, workerId: string): Promise<SdkWorkerTask[]> =>
  get(sql<SdkWorkerTask[]>`
    SELECT * FROM sdk_worker_tasks
    WHERE worker_id = ${workerId} AND status = 'pending'
    ORDER BY assigned_at ASC
  `)

export const findSdkWorkerTaskBySessionId = async (sql: Sql, sessionId: string): Promise<SdkWorkerTask | null> => {
  const [task] = await get(sql<SdkWorkerTask[]>`
    SELECT * FROM sdk_worker_tasks WHERE session_id = ${sessionId}
  `)
  return task || null
}

interface CreateSdkWorkerTaskInput {
  worker_id: string
  session_id: string
}

export const createSdkWorkerTask = async (sql: Sql, input: CreateSdkWorkerTaskInput): Promise<SdkWorkerTask> => {
  const [task] = await get(sql<SdkWorkerTask[]>`
    INSERT INTO sdk_worker_tasks (worker_id, session_id)
    VALUES (${input.worker_id}, ${input.session_id})
    RETURNING *
  `)
  if (!task) {
    throw new Error('Failed to create SDK worker task')
  }
  return task
}

interface UpdateSdkWorkerTaskInput {
  status?: SdkWorkerTaskStatus
  started_at?: Date | null
  completed_at?: Date | null
  result?: unknown
  error?: { code: string; message: string; details?: unknown } | null
}

export const updateSdkWorkerTask = async (sql: Sql, id: string, input: UpdateSdkWorkerTaskInput): Promise<SdkWorkerTask> => {
  const sets: string[] = []
  const values: (string | Date | null)[] = []
  let paramIdx = 1

  if (input.status !== undefined) {
    sets.push(`status = $${paramIdx++}`)
    values.push(input.status)
  }
  if (input.started_at !== undefined) {
    sets.push(`started_at = $${paramIdx++}`)
    values.push(input.started_at)
  }
  if (input.completed_at !== undefined) {
    sets.push(`completed_at = $${paramIdx++}`)
    values.push(input.completed_at)
  }
  if (input.result !== undefined) {
    sets.push(`result = $${paramIdx++}::jsonb`)
    values.push(JSON.stringify(input.result))
  }
  if (input.error !== undefined) {
    sets.push(`error = $${paramIdx++}::jsonb`)
    values.push(input.error ? JSON.stringify(input.error) : null)
  }

  sets.push('updated_at = NOW()')
  values.push(id)

  const query = `UPDATE sdk_worker_tasks SET ${sets.join(', ')} WHERE id = $${paramIdx} RETURNING *`
  const results = await get(sql.unsafe<SdkWorkerTask[]>(query, values))
  const [task] = results
  if (!task) {
    throw new NotFoundException('SDK Worker Task not found')
  }
  return task
}

export const deleteSdkWorkerTask = async (sql: Sql, id: string): Promise<void> =>
  deleteById(sql, 'sdk_worker_tasks', id, 'SDK Worker Task')

// Assign a pending task to an available worker
export const assignTaskToSdkWorker = async (
  sql: Sql,
  sessionId: string,
  workerId: string
): Promise<SdkWorkerTask> => {
  // Create the task assignment
  const task = await createSdkWorkerTask(sql, {
    worker_id: workerId,
    session_id: sessionId
  })

  // Mark worker as busy
  await updateSdkWorker(sql, workerId, { status: 'busy' })

  return task
}

// Get next available task for a worker (polling mechanism)
export const getNextTaskForSdkWorker = async (sql: Sql, workerId: string): Promise<SdkWorkerTask | null> => {
  // First, get any pending tasks assigned to this worker
  const [pendingTask] = await get(sql<SdkWorkerTask[]>`
    SELECT * FROM sdk_worker_tasks
    WHERE worker_id = ${workerId} AND status = 'pending'
    ORDER BY assigned_at ASC
    LIMIT 1
  `)
  return pendingTask || null
}

// SDK Worker Message operations

export const findSdkWorkerMessagesByTaskId = async (sql: Sql, taskId: string): Promise<SdkWorkerMessage[]> =>
  get(sql<SdkWorkerMessage[]>`
    SELECT * FROM sdk_worker_messages WHERE task_id = ${taskId} ORDER BY created_at ASC
  `)

interface CreateSdkWorkerMessageInput {
  task_id: string
  direction: 'worker_to_server' | 'server_to_worker'
  message_type: string
  payload: unknown
}

export const createSdkWorkerMessage = async (sql: Sql, input: CreateSdkWorkerMessageInput): Promise<SdkWorkerMessage> => {
  const [message] = await get(sql<SdkWorkerMessage[]>`
    INSERT INTO sdk_worker_messages (task_id, direction, message_type, payload)
    VALUES (
      ${input.task_id},
      ${input.direction},
      ${input.message_type},
      ${JSON.stringify(input.payload)}::jsonb
    )
    RETURNING *
  `)
  if (!message) {
    throw new Error('Failed to create SDK worker message')
  }
  return message
}

// Utility functions

export const hashApiKey = (apiKey: string): string =>
  crypto.createHash('sha256').update(apiKey).digest('hex')

export const generateApiKey = (): string =>
  `sdk_${crypto.randomBytes(32).toString('hex')}`
