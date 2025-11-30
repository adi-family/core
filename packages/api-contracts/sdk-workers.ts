import { z } from 'zod'
import { route } from '@adi-family/http'
import {
  sdkWorkerSchema,
  sdkWorkerTaskSchema,
  sdkWorkerCapabilitiesSchema,
  sdkWorkerStatusSchema,
  sdkWorkerTaskContextSchema,
  sdkWorkerMessageSchema
} from '@adi-simple/types'

// SDK Worker management endpoints (for admin UI)

export const listSdkWorkersConfig = {
  method: 'GET',
  route: route.dynamic('/api/projects/:projectId/sdk-workers', z.object({ projectId: z.string() })),
  response: {
    schema: z.array(sdkWorkerSchema)
  }
} as const

export const getSdkWorkerConfig = {
  method: 'GET',
  route: route.dynamic('/api/sdk-workers/:workerId', z.object({ workerId: z.string() })),
  response: {
    schema: sdkWorkerSchema
  }
} as const

export const createSdkWorkerBodySchema = z.object({
  project_id: z.string(),
  name: z.string(),
  description: z.string().optional(),
  capabilities: sdkWorkerCapabilitiesSchema.optional()
})

export const createSdkWorkerResponseSchema = z.object({
  worker: sdkWorkerSchema,
  apiKey: z.string()
})

export const createSdkWorkerConfig = {
  method: 'POST',
  route: route.static('/api/sdk-workers'),
  body: {
    schema: createSdkWorkerBodySchema
  },
  response: {
    schema: createSdkWorkerResponseSchema
  }
} as const

export const deleteSdkWorkerConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/sdk-workers/:workerId', z.object({ workerId: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const

// SDK Worker API endpoints (for SDK clients to use)

export const sdkWorkerRegisterBodySchema = z.object({
  name: z.string(),
  description: z.string().optional(),
  capabilities: sdkWorkerCapabilitiesSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export const sdkWorkerRegisterConfig = {
  method: 'POST',
  route: route.dynamic('/api/projects/:projectId/sdk-workers/register', z.object({ projectId: z.string() })),
  body: {
    schema: sdkWorkerRegisterBodySchema
  },
  response: {
    schema: z.object({
      worker: sdkWorkerSchema,
      apiKey: z.string()
    })
  }
} as const

export const sdkWorkerHeartbeatBodySchema = z.object({
  status: sdkWorkerStatusSchema.optional(),
  metadata: z.record(z.string(), z.unknown()).optional()
})

export const sdkWorkerHeartbeatConfig = {
  method: 'POST',
  route: route.static('/api/sdk-workers/heartbeat'),
  body: {
    schema: sdkWorkerHeartbeatBodySchema
  },
  response: {
    schema: sdkWorkerSchema
  }
} as const

export const sdkWorkerGetNextConfig = {
  method: 'GET',
  route: route.static('/api/sdk-workers/next'),
  response: {
    schema: z.object({
      task: sdkWorkerTaskSchema.nullable(),
      context: sdkWorkerTaskContextSchema.nullable()
    })
  }
} as const

export const sdkWorkerPostMessageBodySchema = z.object({
  taskId: z.string(),
  messageType: z.string(),
  payload: z.unknown()
})

export const sdkWorkerPostMessageConfig = {
  method: 'POST',
  route: route.static('/api/sdk-workers/message'),
  body: {
    schema: sdkWorkerPostMessageBodySchema
  },
  response: {
    schema: sdkWorkerMessageSchema
  }
} as const

export const sdkWorkerFinishBodySchema = z.object({
  taskId: z.string(),
  status: z.enum(['completed', 'failed']),
  result: z.unknown().optional(),
  error: z.object({
    code: z.string(),
    message: z.string(),
    details: z.unknown().optional()
  }).optional()
})

export const sdkWorkerFinishConfig = {
  method: 'POST',
  route: route.static('/api/sdk-workers/finish'),
  body: {
    schema: sdkWorkerFinishBodySchema
  },
  response: {
    schema: sdkWorkerTaskSchema
  }
} as const

// Get messages for a task (for SDK workers to poll for server messages)
export const sdkWorkerGetMessagesConfig = {
  method: 'GET',
  route: route.dynamic('/api/sdk-workers/tasks/:taskId/messages', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(sdkWorkerMessageSchema)
  }
} as const
