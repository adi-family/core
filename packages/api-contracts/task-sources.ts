import { z } from 'zod'
import { route } from '@adi-family/http'

export const gitlabIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export const githubIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()).optional(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export const jiraConfigSchema = z.object({
  project_key: z.string().optional(),
  jql_filter: z.string().optional(),
  host: z.string(),
  access_token_secret_id: z.string().optional(),
  cloud_id: z.string().optional()
})

export const taskSourceSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema,
    enabled: z.boolean(),
    auto_evaluate: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('jira'),
    config: jiraConfigSchema,
    enabled: z.boolean(),
    auto_evaluate: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('github_issues'),
    config: githubIssuesConfigSchema,
    enabled: z.boolean(),
    auto_evaluate: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
  })
])

export type TaskSourceResponse = z.infer<typeof taskSourceSchema>
export type GitLabIssuesConfig = z.infer<typeof gitlabIssuesConfigSchema>
export type JiraConfig = z.infer<typeof jiraConfigSchema>
export type GitHubIssuesConfig = z.infer<typeof githubIssuesConfigSchema>

export const listTaskSourcesQuerySchema = z.object({
  project_id: z.string().optional()
})

export const listTaskSourcesConfig = {
  method: 'GET',
  route: route.static('/api/task-sources'),
  query: {
    schema: listTaskSourcesQuerySchema.optional()
  },
  response: {
    schema: z.array(taskSourceSchema)
  }
} as const

export const getTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: taskSourceSchema
  }
} as const

export const createTaskSourceBodySchema = z.discriminatedUnion('type', [
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema,
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('jira'),
    config: jiraConfigSchema,
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('github_issues'),
    config: githubIssuesConfigSchema,
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  })
])

export const createTaskSourceConfig = {
  method: 'POST',
  route: route.static('/api/task-sources'),
  body: {
    schema: createTaskSourceBodySchema
  },
  response: {
    schema: taskSourceSchema
  }
} as const

export const updateTaskSourceBodySchema = z.union([
  z.object({
    name: z.string().optional(),
    type: z.literal('gitlab_issues').optional(),
    config: gitlabIssuesConfigSchema.partial().optional(),
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  }),
  z.object({
    name: z.string().optional(),
    type: z.literal('jira').optional(),
    config: jiraConfigSchema.partial().optional(),
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  }),
  z.object({
    name: z.string().optional(),
    type: z.literal('github_issues').optional(),
    config: githubIssuesConfigSchema.partial().optional(),
    enabled: z.boolean().optional(),
    auto_evaluate: z.boolean().optional()
  })
])

export const updateTaskSourceConfig = {
  method: 'PATCH',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  body: {
    schema: updateTaskSourceBodySchema
  },
  response: {
    schema: taskSourceSchema
  }
} as const

export const syncTaskSourceResponseSchema = z.object({
  success: z.boolean(),
  message: z.string()
})

export const syncTaskSourceConfig = {
  method: 'POST',
  route: route.dynamic('/api/task-sources/:id/sync', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: syncTaskSourceResponseSchema
  }
} as const

export const deleteTaskSourceResponseSchema = z.object({ success: z.boolean() })

export const deleteTaskSourceConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: deleteTaskSourceResponseSchema
  }
} as const
