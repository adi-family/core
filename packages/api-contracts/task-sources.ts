/**
 * Task Sources API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

/**
 * GitLab Issues Config Schema
 */
const gitlabIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

/**
 * GitHub Issues Config Schema
 */
const githubIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()).optional(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

/**
 * Jira Config Schema
 */
const jiraConfigSchema = z.object({
  project_key: z.string().optional(),
  jql_filter: z.string().optional(),
  host: z.string(),
  access_token_secret_id: z.string().optional(),
  cloud_id: z.string().optional()
})

/**
 * Task Source Schema
 */
const taskSourceSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema,
    enabled: z.boolean(),
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
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string()
  })
])

/**
 * Exported response types (inferred from schemas)
 */
export type TaskSourceResponse = z.infer<typeof taskSourceSchema>
export type GitLabIssuesConfig = z.infer<typeof gitlabIssuesConfigSchema>
export type JiraConfig = z.infer<typeof jiraConfigSchema>
export type GitHubIssuesConfig = z.infer<typeof githubIssuesConfigSchema>

/**
 * List task sources
 * GET /api/task-sources
 */
export const listTaskSourcesConfig = {
  method: 'GET',
  route: route.static('/api/task-sources'),
  query: {
    schema: z.object({
      project_id: z.string().optional()
    }).optional()
  },
  response: {
    schema: z.array(taskSourceSchema)
  }
} as const

/**
 * Get task source by ID
 * GET /api/task-sources/:id
 */
export const getTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: taskSourceSchema
  }
} as const

/**
 * Create task source body schema
 */
const createTaskSourceBodySchema = z.discriminatedUnion('type', [
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema,
    enabled: z.boolean().optional()
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('jira'),
    config: jiraConfigSchema,
    enabled: z.boolean().optional()
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('github_issues'),
    config: githubIssuesConfigSchema,
    enabled: z.boolean().optional()
  })
])

/**
 * Create task source
 * POST /api/task-sources
 */
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

/**
 * Update task source body schema
 */
const updateTaskSourceBodySchema = z.union([
  z.object({
    name: z.string().optional(),
    type: z.literal('gitlab_issues').optional(),
    config: gitlabIssuesConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  }),
  z.object({
    name: z.string().optional(),
    type: z.literal('jira').optional(),
    config: jiraConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  }),
  z.object({
    name: z.string().optional(),
    type: z.literal('github_issues').optional(),
    config: githubIssuesConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  })
])

/**
 * Update task source
 * PATCH /api/task-sources/:id
 */
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

/**
 * Sync task source
 * POST /api/task-sources/:id/sync
 */
export const syncTaskSourceConfig = {
  method: 'POST',
  route: route.dynamic('/api/task-sources/:id/sync', z.object({ id: z.string() })),
  body: {
    schema: z.object({}).optional()
  },
  response: {
    schema: z.object({
      success: z.boolean(),
      message: z.string()
    })
  }
} as const

/**
 * Delete task source
 * DELETE /api/task-sources/:id
 */
export const deleteTaskSourceConfig = {
  method: 'DELETE',
  route: route.dynamic('/api/task-sources/:id', z.object({ id: z.string() })),
  response: {
    schema: z.object({ success: z.boolean() })
  }
} as const
