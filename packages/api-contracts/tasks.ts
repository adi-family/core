/**
 * Task API Contracts
 */

import { z } from 'zod'
import { route } from '@adi-family/http'

// Session schema - matches database type
const sessionSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable(),
  runner: z.string(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

// Artifact schema - matches database type
const artifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
  reference_url: z.string(),
  metadata: z.any().nullable(),
  created_at: z.string().or(z.date())
})

// Task schema - matches database type
const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  remote_status: z.enum(['opened', 'closed']),
  project_id: z.string().nullable(),
  task_source_id: z.string(),
  source_gitlab_issue: z.any().nullable(),
  source_github_issue: z.any().nullable(),
  source_jira_issue: z.any().nullable(),
  ai_evaluation_status: z.enum(['pending', 'queued', 'evaluating', 'completed', 'failed']).nullable(),
  ai_evaluation_result: z.enum(['ready', 'needs_clarification']).nullable(),
  ai_evaluation_simple_result: z.any().nullable(),
  ai_evaluation_agentic_result: z.object({
    report: z.string().optional(),
    verdict: z.string().optional(),
    can_implement: z.boolean().optional(),
    blockers: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional()
  }).nullable(),
  created_at: z.string().or(z.date()),
  updated_at: z.string().or(z.date())
})

/**
 * Get sessions by task ID
 * GET /tasks/:taskId/sessions
 */
export const getTaskSessionsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/sessions', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(sessionSchema)
  }
} as const

/**
 * Get artifacts by task ID
 * GET /tasks/:taskId/artifacts
 */
export const getTaskArtifactsConfig = {
  method: 'GET',
  route: route.dynamic('/tasks/:taskId/artifacts', z.object({ taskId: z.string() })),
  response: {
    schema: z.array(artifactSchema)
  }
} as const

/**
 * Get task by ID
 * GET /api/tasks/:id
 */
export const getTaskConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/:id', z.object({ id: z.string() })),
  response: {
    schema: taskSchema
  }
} as const

/**
 * List all tasks
 * GET /api/tasks
 */
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

/**
 * Implement task
 * POST /api/tasks/:id/implement
 */
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

/**
 * Evaluate task
 * POST /api/tasks/:id/evaluate
 */
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

/**
 * Get tasks by task source ID
 * GET /api/tasks/by-task-source/:taskSourceId
 */
export const getTasksByTaskSourceConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-task-source/:taskSourceId', z.object({ taskSourceId: z.string() })),
  response: {
    schema: z.array(taskSchema)
  }
} as const

/**
 * Get tasks by project ID
 * GET /api/tasks/by-project/:projectId
 */
export const getTasksByProjectConfig = {
  method: 'GET',
  route: route.dynamic('/api/tasks/by-project/:projectId', z.object({ projectId: z.string() })),
  response: {
    schema: z.array(taskSchema)
  }
} as const
