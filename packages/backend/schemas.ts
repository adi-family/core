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

export const setJobExecutorSchema = z.object({
  host: z.string().url(),
  access_token: z.string().min(1).optional(),
  access_token_secret_id: z.string().optional()
}).refine(
  (data) => data.access_token || data.access_token_secret_id,
  { message: "Either access_token or access_token_secret_id must be provided" }
)

export const aiProviderSchema = z.enum(['anthropic', 'openai', 'google'])

export const setAIProviderKeySchema = z.object({
  api_key: z.string().min(1).optional(),
  api_key_secret_id: z.string().optional()
}).refine(
  (data) => data.api_key || data.api_key_secret_id,
  { message: "Either api_key or api_key_secret_id must be provided" }
)

export const aiProviderParamSchema = z.object({
  provider: aiProviderSchema
})

export const idAndProviderParamSchema = z.object({
  id: z.string(),
  provider: aiProviderSchema
})

// Enterprise AI Provider Configuration Schemas

export const anthropicCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string().uuid(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional()
})

export const anthropicSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string().uuid(),
  endpoint_url: z.string().url(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export const anthropicConfigSchema = z.discriminatedUnion('type', [
  anthropicCloudConfigSchema,
  anthropicSelfHostedConfigSchema
])

export const openaiCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string().uuid(),
  organization_id: z.string().optional(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional()
})

export const openaiAzureConfigSchema = z.object({
  type: z.literal('azure'),
  api_key_secret_id: z.string().uuid(),
  endpoint_url: z.string().url(),
  deployment_name: z.string().min(1),
  api_version: z.string().regex(/^\d{4}-\d{2}-\d{2}(-preview)?$/),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional()
})

export const openaiSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string().uuid(),
  endpoint_url: z.string().url(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export const openaiConfigSchema = z.discriminatedUnion('type', [
  openaiCloudConfigSchema,
  openaiAzureConfigSchema,
  openaiSelfHostedConfigSchema
])

export const googleCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string().uuid(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional()
})

export const googleVertexConfigSchema = z.object({
  type: z.literal('vertex'),
  api_key_secret_id: z.string().uuid(),
  project_id: z.string().min(1),
  location: z.string().min(1),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional()
})

export const googleSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string().uuid(),
  endpoint_url: z.string().url(),
  model: z.string().optional(),
  max_tokens: z.number().int().positive().optional(),
  temperature: z.number().min(0).max(1).optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export const googleConfigSchema = z.discriminatedUnion('type', [
  googleCloudConfigSchema,
  googleVertexConfigSchema,
  googleSelfHostedConfigSchema
])

export const aiProviderEnterpriseConfigSchema = z.object({
  anthropic: anthropicConfigSchema.optional(),
  openai: openaiConfigSchema.optional(),
  google: googleConfigSchema.optional()
})

// Schema for setting AI provider with raw API key or secret_id
export const setAIProviderEnterpriseConfigSchema = z.union([
  anthropicCloudConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  anthropicSelfHostedConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  openaiCloudConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  openaiAzureConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  openaiSelfHostedConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  googleCloudConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  googleVertexConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  }),
  googleSelfHostedConfigSchema.extend({ api_key: z.string().min(1).optional() }).omit({ api_key_secret_id: true }).merge(
    z.object({ api_key_secret_id: z.string().uuid().optional() })
  ).refine(data => data.api_key || data.api_key_secret_id, {
    message: 'Either api_key or api_key_secret_id must be provided'
  })
])

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

export const updateTaskSchema = createTaskSchema.partial().extend({
  remote_status: z.enum(['opened', 'closed']).optional(),
  ai_evaluation_status: z.enum(['pending', 'queued', 'evaluating', 'completed', 'failed']).optional(),
  ai_evaluation_session_id: z.string().optional(),
  ai_evaluation_result: z.enum(['ready', 'needs_clarification']).optional(),
  ai_evaluation_simple_result: z.any().optional(),
  ai_evaluation_agentic_result: z.any().optional()
})

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
export const gitlabFileSpaceConfigSchema = z.object({
  repo: z.string(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export const githubFileSpaceConfigSchema = z.object({
  repo: z.string(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export const fileSpaceSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab'),
    config: gitlabFileSpaceConfigSchema,
    enabled: z.boolean(),
    created_at: z.string(),
    updated_at: z.string()
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    type: z.literal('github'),
    config: githubFileSpaceConfigSchema,
    enabled: z.boolean(),
    created_at: z.string(),
    updated_at: z.string()
  })
])

export const createFileSpaceSchema = z.discriminatedUnion('type', [
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('gitlab'),
    config: gitlabFileSpaceConfigSchema,
    enabled: z.boolean().optional()
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    type: z.literal('github'),
    config: githubFileSpaceConfigSchema,
    enabled: z.boolean().optional()
  })
])

export const updateFileSpaceSchema = z.union([
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    type: z.literal('gitlab').optional(),
    config: gitlabFileSpaceConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  }),
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    type: z.literal('github').optional(),
    config: githubFileSpaceConfigSchema.partial().optional(),
    enabled: z.boolean().optional()
  })
])

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
