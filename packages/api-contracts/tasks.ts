import { z } from 'zod'
import { route } from '@adi-family/http'
import { taskSchema as taskSchemaFromTypes, sessionSchema as sessionSchemaFromTypes, pipelineArtifactSchema } from '@adi-simple/types'

export const taskSchema = taskSchemaFromTypes
export type Task = z.infer<typeof taskSchema>

export const sessionSchema = sessionSchemaFromTypes
export type Session = z.infer<typeof sessionSchema>

export type Artifact = z.infer<typeof pipelineArtifactSchema>

export const getTaskSessionsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/sessions', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(sessionSchema)
  }
} as const

export const getTaskArtifactsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/artifacts', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(pipelineArtifactSchema)
  }
} as const

export const getTaskConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  response: {
    schema: taskSchema
  }
} as const

export const listTasksQuerySchema = z.object({
  project_id: z.string().optional(),
  status: z.string().optional(),
  limit: z.number().optional(),
  search: z.string().optional(),
})

export const listTasksConfig = {
  method: 'GET',
  route: route.static('/api/tasks'),
  query: {
    schema: listTasksQuerySchema.optional()
  },
  response: {
    schema: z.array(taskSchema)
  }
} as const

export const implementTaskResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  session_id: z.string().optional()
})

export const implementTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/implement', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: implementTaskResponseSchema
  }
} as const

export const evaluateTaskResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional(),
  evaluation: z.any().optional()
})

export const evaluateTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/evaluate', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: evaluateTaskResponseSchema
  }
} as const

export const evaluateTaskAdvancedConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/evaluate-advanced', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: evaluateTaskResponseSchema
  }
} as const

export const getTasksByTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-task-source/:taskSourceId', z.object({ taskSourceId: z.string() })),
  response: {
    schema: z.array(taskSchema)
  }
} as const

export const getTasksByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.array(taskSchema)
  }
} as const

export const getTaskStatsQuerySchema = z.object({
  project_id: z.string().optional(),
  task_source_id: z.string().optional(),
  evaluated_only: z.string().optional(),
  sort_by: z.string().optional(),
  search: z.string().optional()
})

export const quadrantDataItemSchema = z.object({
  x: z.number(),
  y: z.number(),
  title: z.string(),
  id: z.string(),
  impactLabel: z.string(),
  effortLabel: z.string()
})

export const chartDataItemSchema = z.object({
  name: z.string(),
  value: z.number()
})

export const taskStatsResponseSchema = z.object({
  total: z.number(),
  evaluated: z.number(),
  implemented: z.number(),
  inProgress: z.number(),
  avgComplexity: z.string(),
  quadrantData: z.array(quadrantDataItemSchema),
  taskTypeData: z.array(chartDataItemSchema),
  effortData: z.array(chartDataItemSchema),
  riskData: z.array(chartDataItemSchema)
})

export const getTaskStatsConfig = {
  method: 'GET',
  route: route.static('/api/tasks/stats'),
  query: {
    schema: getTaskStatsQuerySchema.optional()
  },
  response: {
    schema: taskStatsResponseSchema
  }
} as const

export const implementationStatusSchema = z.enum(['pending', 'queued', 'implementing', 'completed', 'failed'])

export const updateTaskImplementationStatusBodySchema = z.object({
  status: implementationStatusSchema
})

export const updateTaskImplementationStatusResponseSchema = z.object({
  success: z.boolean(),
  message: z.string().optional()
})

export const updateTaskImplementationStatusConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/implementation-status', z.object({ id: z.string() })),
  body: {
    schema: updateTaskImplementationStatusBodySchema
  },
  response: {
    schema: updateTaskImplementationStatusResponseSchema
  }
} as const

export const updateTaskBodySchema = z.object({
  status: z.string().optional(),
  title: z.string().optional(),
  description: z.string().optional()
})

export const updateTaskConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  body: {
    schema: updateTaskBodySchema
  },
  response: {
    schema: taskSchema
  }
} as const

export const createTaskBodySchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  project_id: z.string(),
  status: z.string().optional()
})

export const createTaskConfig = {
  method: 'POST',
  route: route.static('/api/tasks'),
  body: {
    schema: createTaskBodySchema
  },
  response: {
    schema: taskSchema
  }
} as const

export const deleteTaskResponseSchema = z.object({
  success: z.boolean()
})

export const deleteTaskConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  response: {
    schema: deleteTaskResponseSchema
  }
} as const
