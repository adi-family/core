import { z } from 'zod'
import { route } from '@adi-family/http'
import { taskSchema as taskSchemaFromTypes, sessionSchema as sessionSchemaFromTypes } from '@adi-simple/types'

export const taskSchema = taskSchemaFromTypes
export type Task = z.infer<typeof taskSchema>

export const sessionSchema = sessionSchemaFromTypes
export type Session = z.infer<typeof sessionSchema>

const artifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
  reference_url: z.string(),
  metadata: z.any().nullable(),
  created_at: z.string().or(z.date())
})

export type Artifact = z.infer<typeof artifactSchema>

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
    schema: z.array(artifactSchema)
  }
} as const

export const getTaskConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  response: {
    schema: taskSchema
  }
} as const

export const listTasksConfig = {
  method: 'GET',
  route: route.static('/api/tasks'),
  query: {
    schema: z.object({
      project_id: z.string().optional(),
      status: z.string().optional(),
      limit: z.number().optional(),
    }).optional()
  },
  response: {
    schema: z.array(taskSchema)
  }
} as const

export const implementTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/implement', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      session_id: z.string().optional()
    })
  }
} as const

export const evaluateTaskConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/evaluate', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      evaluation: z.any().optional()
    })
  }
} as const

export const evaluateTaskAdvancedConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/evaluate-advanced', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string().optional(),
      evaluation: z.any().optional()
    })
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

export const getTaskStatsConfig = {
  method: 'GET',
  route: route.static('/api/tasks/stats'),
  query: {
    schema: z.object({
      project_id: z.string().optional(),
      task_source_id: z.string().optional(),
      evaluated_only: z.string().optional(),
      sort_by: z.string().optional()
    }).optional()
  },
  response: {
    schema: z.object({
      total: z.number(),
      evaluated: z.number(),
      implemented: z.number(),
      inProgress: z.number(),
      avgComplexity: z.string(),
      quadrantData: z.array(z.object({
        x: z.number(),
        y: z.number(),
        title: z.string(),
        id: z.string(),
        impactLabel: z.string(),
        effortLabel: z.string()
      })),
      taskTypeData: z.array(z.object({
        name: z.string(),
        value: z.number()
      })),
      effortData: z.array(z.object({
        name: z.string(),
        value: z.number()
      })),
      riskData: z.array(z.object({
        name: z.string(),
        value: z.number()
      }))
    })
  }
} as const

export const updateTaskImplementationStatusConfig = {
  method: 'POST',
  route: route.dynamic('/api/tasks/:id/implementation-status', z.object({ id: z.string() })),
  body: {
    schema: z.object({
      status: z.enum(['pending', 'queued', 'implementing', 'completed', 'failed'])
    })
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string().optional()
    })
  }
} as const
