import { z } from 'zod'

// Metadata schemas
export const gitlabMetadataSchema = z.object({
  provider: z.literal('gitlab'),
  repo: z.string(),
  host: z.string().optional(),
  iid: z.number().optional()
})

export const githubMetadataSchema = z.object({
  provider: z.literal('github'),
  repo: z.string(),
  host: z.string().optional()
})

export const jiraMetadataSchema = z.object({
  provider: z.literal('jira'),
  host: z.string(),
  key: z.string(),
  project_key: z.string()
})

// Issue schemas
export const gitlabIssueSchema = z.object({
  id: z.string(),
  iid: z.number().nullable().optional(),
  title: z.string(),
  updated_at: z.string(),
  metadata: gitlabMetadataSchema
})

export const githubIssueSchema = z.object({
  id: z.string(),
  iid: z.number().nullable().optional(),
  title: z.string(),
  updated_at: z.string(),
  metadata: githubMetadataSchema
})

export const jiraIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
  metadata: jiraMetadataSchema
})

// Project schemas
export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createProjectSchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional()
})

export const updateProjectSchema = createProjectSchema.partial()

// Task schemas
export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  project_id: z.string().nullable(),
  task_source_id: z.string(),
  source_gitlab_issue: gitlabIssueSchema.nullable(),
  source_github_issue: githubIssueSchema.nullable(),
  source_jira_issue: jiraIssueSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createTaskSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  project_id: z.string().optional(),
  task_source_id: z.string().optional(),
  source_gitlab_issue: gitlabIssueSchema.optional(),
  source_github_issue: githubIssueSchema.optional(),
  source_jira_issue: jiraIssueSchema.optional()
})

export const updateTaskSchema = createTaskSchema.partial()

// Session schemas
export const sessionSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable(),
  runner: z.string(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createSessionSchema = z.object({
  task_id: z.string().optional(),
  runner: z.string()
})

// Message schemas
export const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  data: z.unknown(),
  created_at: z.string()
})

export const createMessageSchema = z.object({
  session_id: z.string(),
  data: z.unknown()
})

// FileSpace schemas
export const fileSpaceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab', 'github']),
  config: z.unknown(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createFileSpaceSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab', 'github']),
  config: z.unknown(),
  enabled: z.boolean().optional()
})

export const updateFileSpaceSchema = createFileSpaceSchema.partial()

// TaskSource schemas
export const taskSourceSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab_issues', 'jira', 'github_issues']),
  config: z.unknown(),
  enabled: z.boolean(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createTaskSourceSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  type: z.enum(['gitlab_issues', 'jira', 'github_issues']),
  config: z.unknown(),
  enabled: z.boolean().optional()
})

export const updateTaskSourceSchema = createTaskSourceSchema.partial()

// WorkerRepository schemas
export const workerRepositorySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source_gitlab: z.unknown(),
  current_version: z.string(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createWorkerRepositorySchema = z.object({
  project_id: z.string(),
  source_gitlab: z.unknown(),
  current_version: z.string()
})

export const updateWorkerRepositorySchema = createWorkerRepositorySchema.omit({ project_id: true }).partial()

// PipelineExecution schemas
export const pipelineExecutionSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']),
  last_status_update: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export const createPipelineExecutionSchema = z.object({
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled'])
})

export const updatePipelineExecutionSchema = z.object({
  pipeline_id: z.string().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']).optional(),
  last_status_update: z.string().optional()
})

// PipelineArtifact schemas
export const pipelineArtifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text']),
  reference_url: z.string(),
  metadata: z.unknown().nullable(),
  created_at: z.string()
})

export const createPipelineArtifactSchema = z.object({
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text']),
  reference_url: z.string(),
  metadata: z.unknown().optional()
})

// WorkerCache schemas
export const workerCacheSchema = z.object({
  id: z.number(),
  issue_id: z.string(),
  project_id: z.string(),
  last_processed_at: z.string(),
  status: z.string().nullable(),
  task_id: z.string().nullable(),
  processing_started_at: z.string().nullable(),
  processing_worker_id: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export const lockContextSchema = z.object({
  issueId: z.string(),
  workerId: z.string(),
  lockTimeoutSeconds: z.number().optional()
})

export const signalInfoSchema = z.object({
  issueId: z.string(),
  date: z.string(),
  taskId: z.string()
})

// Param schemas for route parameters
export const idParamSchema = z.object({
  id: z.string()
})

export const projectIdParamSchema = z.object({
  projectId: z.string()
})

export const taskIdParamSchema = z.object({
  taskId: z.string()
})

export const sessionIdParamSchema = z.object({
  sessionId: z.string()
})

export const executionIdParamSchema = z.object({
  executionId: z.string()
})

export const issueIdParamSchema = z.object({
  issueId: z.string()
})

// Query schemas
export const timeoutQuerySchema = z.object({
  timeoutMinutes: z.string().transform(Number)
})

export const projectIdQuerySchema = z.object({
  project_id: z.string().optional()
})

// Worker repository setup schemas
export const setupWorkerRepositorySchema = z.object({
  version: z.string().optional(),
  customPath: z.string().optional()
})

export const updateVersionSchema = z.object({
  version: z.string()
})

// Worker cache traffic light schemas
export const isSignaledBodySchema = z.object({
  issueId: z.string(),
  date: z.string()
})

export const releaseLockBodySchema = z.object({
  issueId: z.string()
})
