import { z } from 'zod'

export const gitlabMetadataSchema = z.object({
  provider: z.literal('gitlab'),
  repo: z.string(),
  host: z.string().optional(),
  iid: z.number().optional()
})

export type GitlabMetadata = z.infer<typeof gitlabMetadataSchema>

export const githubMetadataSchema = z.object({
  provider: z.literal('github'),
  repo: z.string(),
  host: z.string().optional()
})

export type GithubMetadata = z.infer<typeof githubMetadataSchema>

export const jiraMetadataSchema = z.object({
  provider: z.literal('jira'),
  host: z.string(),
  key: z.string(),
  project_key: z.string()
})

export type JiraMetadata = z.infer<typeof jiraMetadataSchema>

export const gitlabIssueSchema = z.object({
  id: z.string(),
  iid: z.number().nullable().optional(),
  title: z.string(),
  updated_at: z.string(),
  metadata: gitlabMetadataSchema
})

export type GitlabIssue = z.infer<typeof gitlabIssueSchema>

export const githubIssueSchema = z.object({
  id: z.string(),
  iid: z.number().nullable().optional(),
  title: z.string(),
  updated_at: z.string(),
  metadata: githubMetadataSchema
})

export type GithubIssue = z.infer<typeof githubIssueSchema>

export const jiraIssueSchema = z.object({
  id: z.string(),
  title: z.string(),
  updated_at: z.string(),
  metadata: jiraMetadataSchema
})

export type JiraIssue = z.infer<typeof jiraIssueSchema>

export const gitlabExecutorConfigSchema = z.object({
  host: z.string(),
  access_token_secret_id: z.string(),
  verified_at: z.string().optional(),
  user: z.string().optional()
})

export type GitlabExecutorConfig = z.infer<typeof gitlabExecutorConfigSchema>

export const anthropicCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

export type AnthropicCloudConfig = z.infer<typeof anthropicCloudConfigSchema>

export const anthropicSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export type AnthropicSelfHostedConfig = z.infer<typeof anthropicSelfHostedConfigSchema>

export const anthropicConfigSchema = z.discriminatedUnion('type', [
  anthropicCloudConfigSchema,
  anthropicSelfHostedConfigSchema
])

export type AnthropicConfig = z.infer<typeof anthropicConfigSchema>

export const openAICloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  organization_id: z.string().optional(),
  model: z.string().optional()
})

export type OpenAICloudConfig = z.infer<typeof openAICloudConfigSchema>

export const openAIAzureConfigSchema = z.object({
  type: z.literal('azure'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  deployment_name: z.string(),
  api_version: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

export type OpenAIAzureConfig = z.infer<typeof openAIAzureConfigSchema>

export const openAISelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export type OpenAISelfHostedConfig = z.infer<typeof openAISelfHostedConfigSchema>

export const openAIConfigSchema = z.discriminatedUnion('type', [
  openAICloudConfigSchema,
  openAIAzureConfigSchema,
  openAISelfHostedConfigSchema
])

export type OpenAIConfig = z.infer<typeof openAIConfigSchema>

export const googleCloudConfigSchema = z.object({
  type: z.literal('cloud'),
  api_key_secret_id: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

export type GoogleCloudConfig = z.infer<typeof googleCloudConfigSchema>

export const googleVertexConfigSchema = z.object({
  type: z.literal('vertex'),
  api_key_secret_id: z.string(),
  project_id: z.string(),
  location: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional()
})

export type GoogleVertexConfig = z.infer<typeof googleVertexConfigSchema>

export const googleSelfHostedConfigSchema = z.object({
  type: z.literal('self-hosted'),
  api_key_secret_id: z.string(),
  endpoint_url: z.string(),
  model: z.string().optional(),
  max_tokens: z.number().optional(),
  temperature: z.number().optional(),
  additional_headers: z.record(z.string(), z.string()).optional()
})

export type GoogleSelfHostedConfig = z.infer<typeof googleSelfHostedConfigSchema>

export const googleConfigSchema = z.discriminatedUnion('type', [
  googleCloudConfigSchema,
  googleVertexConfigSchema,
  googleSelfHostedConfigSchema
])

export type GoogleConfig = z.infer<typeof googleConfigSchema>

export const aiProviderConfigSchema = z.object({
  anthropic: anthropicConfigSchema.optional(),
  openai: openAIConfigSchema.optional(),
  google: googleConfigSchema.optional()
})

export type AIProviderConfig = z.infer<typeof aiProviderConfigSchema>

export const aiProviderValidationResultSchema = z.object({
  valid: z.boolean(),
  endpoint_reachable: z.boolean(),
  authentication_valid: z.boolean(),
  error: z.string().optional(),
  details: z.record(z.string(), z.any()).optional(),
  tested_at: z.string()
})

export type AIProviderValidationResult = z.infer<typeof aiProviderValidationResultSchema>

export const projectSchema = z.object({
  id: z.string(),
  name: z.string(),
  enabled: z.boolean(),
  job_executor_gitlab: gitlabExecutorConfigSchema.nullable(),
  ai_provider_configs: aiProviderConfigSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string(),
  last_synced_at: z.string().nullable()
})

export type Project = z.infer<typeof projectSchema>

export const aiCapabilityCriteriaSchema = z.object({
  cannot_determine_what_to_implement: z.boolean(),
  has_contradictory_requirements: z.boolean(),
  requires_undefined_integration: z.boolean(),
  requires_human_subjective_choice: z.boolean(),
  requires_missing_information: z.boolean(),
  integration_has_no_documentation: z.boolean(),
  requires_proprietary_knowledge: z.boolean(),
  requires_advanced_domain_expertise: z.boolean(),
  cannot_test_without_credentials: z.boolean(),
  cannot_test_without_paid_account: z.boolean(),
  cannot_test_without_hardware: z.boolean(),
  requires_production_access_to_test: z.boolean(),
  should_verify_visually: z.boolean(),
  should_verify_ux_flow: z.boolean(),
  should_verify_performance: z.boolean(),
  should_verify_security: z.boolean(),
  should_verify_accessibility: z.boolean(),
  high_risk_breaking_change: z.boolean(),
  requires_manual_testing: z.boolean()
})

export type AICapabilityCriteria = z.infer<typeof aiCapabilityCriteriaSchema>

export const simpleEvaluationResultSchema = z.object({
  should_evaluate: z.boolean(),
  clarity_score: z.number(),
  has_acceptance_criteria: z.boolean(),
  auto_reject_reason: z.string().nullable(),
  ai_capability: aiCapabilityCriteriaSchema,
  blockers_summary: z.array(z.string()),
  verification_summary: z.array(z.string()),
  risk_summary: z.array(z.string()),
  complexity_score: z.number(),
  effort_estimate: z.enum(['xs', 's', 'm', 'l', 'xl']),
  risk_level: z.enum(['low', 'medium', 'high']),
  task_type: z.enum(['bug_fix', 'feature', 'refactor', 'docs', 'test', 'config', 'other']),
  estimated_impact: z.enum(['low', 'medium', 'high']),
  estimated_effort: z.enum(['low', 'medium', 'high'])
})

export type SimpleEvaluationResult = z.infer<typeof simpleEvaluationResultSchema>

// Manual task metadata schema
export const manualTaskMetadataSchema = z.object({
  created_via: z.enum(['ui', 'api']),
  custom_properties: z.record(z.string(), z.unknown()).optional()
})

export type ManualTaskMetadata = z.infer<typeof manualTaskMetadataSchema>

export const taskSchema = z.object({
  id: z.string(),
  title: z.string(),
  description: z.string().nullable(),
  status: z.string(),
  remote_status: z.enum(['opened', 'closed']),
  project_id: z.string().nullable(),
  task_source_id: z.string(),
  source_gitlab_issue: gitlabIssueSchema.nullable(),
  source_github_issue: githubIssueSchema.nullable(),
  source_jira_issue: jiraIssueSchema.nullable(),
  ai_evaluation_simple_status: z.enum(['not_started', 'queued', 'evaluating', 'completed', 'failed']).nullable(),
  ai_evaluation_advanced_status: z.enum(['not_started', 'queued', 'evaluating', 'completed', 'failed']).nullable(),
  ai_evaluation_simple_verdict: z.enum(['ready', 'needs_clarification']).nullable(),
  ai_evaluation_advanced_verdict: z.enum(['ready', 'needs_clarification']).nullable(),
  ai_evaluation_simple_result: simpleEvaluationResultSchema.nullable(),
  ai_evaluation_agentic_result: z.object({
    report: z.string().optional(),
    verdict: z.string().optional(),
    can_implement: z.boolean().optional(),
    blockers: z.array(z.string()).optional(),
    requirements: z.array(z.string()).optional(),
    confidence: z.number().optional(),
    missing_information: z.array(z.string()).optional(),
    risks: z.array(z.string()).optional(),
    agent_instructions: z.object({
      required_context_files: z.array(z.string()).optional(),
      suggested_steps: z.array(z.string()).optional(),
      follow_patterns_from: z.array(z.string()).optional()
    }).optional()
  }).catchall(z.unknown()).nullable(),
  ai_evaluation_session_id: z.string().nullable(),
  ai_implementation_status: z.enum(['pending', 'queued', 'implementing', 'completed', 'failed']).nullable(),
  ai_implementation_session_id: z.string().nullable(),
  created_by_user_id: z.string().nullable(),
  manual_task_metadata: manualTaskMetadataSchema.nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export type Task = z.infer<typeof taskSchema>

export const sessionSchema = z.object({
  id: z.string(),
  task_id: z.string().nullable(),
  runner: z.string(),
  created_at: z.string(),
  updated_at: z.string()
})

export type Session = z.infer<typeof sessionSchema>

export const messageSchema = z.object({
  id: z.string(),
  session_id: z.string(),
  data: z.unknown(),
  created_at: z.string()
})

export type Message = z.infer<typeof messageSchema>

export const createProjectInputSchema = z.object({
  name: z.string(),
  enabled: z.boolean().optional()
})

export type CreateProjectInput = z.infer<typeof createProjectInputSchema>

export const updateProjectInputSchema = createProjectInputSchema.partial()

export type UpdateProjectInput = z.infer<typeof updateProjectInputSchema>

export const createTaskInputSchema = z.object({
  title: z.string(),
  description: z.string().optional(),
  status: z.string(),
  remote_status: z.enum(['opened', 'closed']).optional(),
  project_id: z.string().optional(),
  task_source_id: z.string().optional(),
  source_gitlab_issue: gitlabIssueSchema.optional(),
  source_github_issue: githubIssueSchema.optional(),
  source_jira_issue: jiraIssueSchema.optional(),
  created_by_user_id: z.string().optional(),
  manual_task_metadata: manualTaskMetadataSchema.optional()
})

export type CreateTaskInput = z.infer<typeof createTaskInputSchema>

export const updateTaskInputSchema = taskSchema.omit({ id: true, created_at: true, updated_at: true }).partial()

export type UpdateTaskInput = z.infer<typeof updateTaskInputSchema>

export const createSessionInputSchema = z.object({
  task_id: z.string().optional(),
  runner: z.string()
})

export type CreateSessionInput = z.infer<typeof createSessionInputSchema>

export const createMessageInputSchema = z.object({
  session_id: z.string(),
  data: z.unknown()
})

export type CreateMessageInput = z.infer<typeof createMessageInputSchema>

export const gitlabFileSpaceConfigSchema = z.object({
  repo: z.string(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export type GitlabFileSpaceConfig = z.infer<typeof gitlabFileSpaceConfigSchema>

export const githubFileSpaceConfigSchema = z.object({
  repo: z.string(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export type GithubFileSpaceConfig = z.infer<typeof githubFileSpaceConfigSchema>

export const fileSpaceSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    default_branch: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('gitlab'),
    config: gitlabFileSpaceConfigSchema
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    default_branch: z.string().optional(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('github'),
    config: githubFileSpaceConfigSchema
  })
])

export type FileSpace = z.infer<typeof fileSpaceSchema>

export const createFileSpaceInputSchema = z.discriminatedUnion('type', [
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    default_branch: z.string().optional(),
    type: z.literal('gitlab'),
    config: gitlabFileSpaceConfigSchema
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    default_branch: z.string().optional(),
    type: z.literal('github'),
    config: githubFileSpaceConfigSchema
  })
])

export type CreateFileSpaceInput = z.infer<typeof createFileSpaceInputSchema>

export const updateFileSpaceInputSchema = z.union([
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    default_branch: z.string().optional(),
    type: z.literal('gitlab').optional(),
    config: gitlabFileSpaceConfigSchema.optional()
  }).partial(),
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    default_branch: z.string().optional(),
    type: z.literal('github').optional(),
    config: githubFileSpaceConfigSchema.optional()
  }).partial()
])

export type UpdateFileSpaceInput = z.infer<typeof updateFileSpaceInputSchema>

export const gitlabIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export type GitlabIssuesConfig = z.infer<typeof gitlabIssuesConfigSchema>

export const githubIssuesConfigSchema = z.object({
  repo: z.string(),
  labels: z.array(z.string()).optional(),
  host: z.string().optional(),
  access_token_secret_id: z.string().optional()
})

export type GithubIssuesConfig = z.infer<typeof githubIssuesConfigSchema>

export const manualTaskSourceConfigSchema = z.object({})

export type ManualTaskSourceConfig = z.infer<typeof manualTaskSourceConfigSchema>

export const taskSourceJiraConfigSchema = z.object({
  project_key: z.string().optional(),
  jql_filter: z.string().optional(),
  host: z.string(),
  access_token_secret_id: z.string().optional(),
  cloud_id: z.string().optional()
})

export type TaskSourceJiraConfig = z.infer<typeof taskSourceJiraConfigSchema>

export const taskSourceSchema = z.discriminatedUnion('type', [
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('jira'),
    config: taskSourceJiraConfigSchema
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('github_issues'),
    config: githubIssuesConfigSchema
  }),
  z.object({
    id: z.string(),
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean(),
    sync_status: z.enum(['pending', 'queued', 'syncing', 'completed', 'failed']),
    last_synced_at: z.string().nullable(),
    created_at: z.string(),
    updated_at: z.string(),
    type: z.literal('manual'),
    config: manualTaskSourceConfigSchema
  })
])

export type TaskSource = z.infer<typeof taskSourceSchema>

export const taskSourceConfigSchema = z.union([
  gitlabIssuesConfigSchema,
  taskSourceJiraConfigSchema,
  githubIssuesConfigSchema,
  manualTaskSourceConfigSchema
])

export type TaskSourceConfig = z.infer<typeof taskSourceConfigSchema>

export const createTaskSourceInputSchema = z.discriminatedUnion('type', [
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    type: z.literal('gitlab_issues'),
    config: gitlabIssuesConfigSchema
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    type: z.literal('jira'),
    config: taskSourceJiraConfigSchema
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    type: z.literal('github_issues'),
    config: githubIssuesConfigSchema
  }),
  z.object({
    project_id: z.string(),
    name: z.string(),
    enabled: z.boolean().optional(),
    type: z.literal('manual'),
    config: manualTaskSourceConfigSchema
  })
])

export type CreateTaskSourceInput = z.infer<typeof createTaskSourceInputSchema>

export const updateTaskSourceInputSchema = z.union([
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.literal('gitlab_issues').optional(),
    config: gitlabIssuesConfigSchema.optional()
  }),
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.literal('jira').optional(),
    config: taskSourceJiraConfigSchema.optional()
  }),
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.literal('github_issues').optional(),
    config: githubIssuesConfigSchema.optional()
  }),
  z.object({
    project_id: z.string().optional(),
    name: z.string().optional(),
    enabled: z.boolean().optional(),
    type: z.literal('manual').optional(),
    config: manualTaskSourceConfigSchema.optional()
  })
])

export type UpdateTaskSourceInput = z.infer<typeof updateTaskSourceInputSchema>

export const workerRepositorySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  source_gitlab: z.unknown(),
  current_version: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export type WorkerRepository = z.infer<typeof workerRepositorySchema>

export const createWorkerRepositoryInputSchema = z.object({
  project_id: z.string(),
  source_gitlab: z.unknown(),
  current_version: z.string()
})

export type CreateWorkerRepositoryInput = z.infer<typeof createWorkerRepositoryInputSchema>

export const updateWorkerRepositoryInputSchema = createWorkerRepositoryInputSchema.omit({ project_id: true }).partial()

export type UpdateWorkerRepositoryInput = z.infer<typeof updateWorkerRepositoryInputSchema>

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

export type PipelineExecution = z.infer<typeof pipelineExecutionSchema>

export const createPipelineExecutionInputSchema = z.object({
  session_id: z.string(),
  worker_repository_id: z.string(),
  pipeline_id: z.string().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled'])
})

export type CreatePipelineExecutionInput = z.infer<typeof createPipelineExecutionInputSchema>

export const updatePipelineExecutionInputSchema = z.object({
  pipeline_id: z.string().optional(),
  status: z.enum(['pending', 'running', 'success', 'failed', 'canceled']).optional(),
  last_status_update: z.string().optional()
})

export type UpdatePipelineExecutionInput = z.infer<typeof updatePipelineExecutionInputSchema>

export const pipelineArtifactSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
  reference_url: z.string(),
  metadata: z.unknown().nullable(),
  created_at: z.string()
})

export type PipelineArtifact = z.infer<typeof pipelineArtifactSchema>

export const createPipelineArtifactInputSchema = z.object({
  pipeline_execution_id: z.string(),
  artifact_type: z.enum(['merge_request', 'issue', 'branch', 'commit', 'execution_result', 'text', 'task_evaluation', 'task_implementation']),
  reference_url: z.string(),
  metadata: z.unknown().optional()
})

export type CreatePipelineArtifactInput = z.infer<typeof createPipelineArtifactInputSchema>

export const resultSchema = <T extends z.ZodTypeAny>(dataSchema: T) =>
  z.union([
    z.object({ ok: z.literal(true), data: dataSchema }),
    z.object({ ok: z.literal(false), error: z.string() })
  ])

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

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

export type WorkerCache = z.infer<typeof workerCacheSchema>

export const lockContextSchema = z.object({
  issueId: z.string(),
  workerId: z.string(),
  lockTimeoutSeconds: z.number().optional()
})

export type LockContext = z.infer<typeof lockContextSchema>

export const signalInfoSchema = z.object({
  issueId: z.string(),
  date: z.string(),
  taskId: z.string()
})

export type SignalInfo = z.infer<typeof signalInfoSchema>

export const secretSchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  value: z.string(),
  encrypted_value: z.string().nullable(),
  encryption_version: z.string().nullable(),
  is_encrypted: z.boolean(),
  description: z.string().nullable(),
  oauth_provider: z.string().nullable(),
  token_type: z.enum(['api', 'oauth']).nullable(),
  refresh_token: z.string().nullable(),
  expires_at: z.string().nullable(),
  scopes: z.string().nullable(),
  created_at: z.string(),
  updated_at: z.string()
})

export type Secret = z.infer<typeof secretSchema>

export const createSecretInputSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  value: z.string(),
  description: z.string().optional(),
  oauth_provider: z.string().optional(),
  token_type: z.enum(['api', 'oauth']).optional(),
  refresh_token: z.string().optional(),
  expires_at: z.string().optional(),
  scopes: z.string().optional()
})

export type CreateSecretInput = z.infer<typeof createSecretInputSchema>

export const updateSecretInputSchema = z.object({
  value: z.string().optional(),
  description: z.string().optional(),
  refresh_token: z.string().optional(),
  expires_at: z.string().optional(),
  scopes: z.string().optional()
})

export type UpdateSecretInput = z.infer<typeof updateSecretInputSchema>

export const userAccessSchema = z.object({
  id: z.string(),
  user_id: z.string(),
  entity_type: z.enum(['project', 'task_source', 'file_space', 'secret', 'task']),
  entity_id: z.string(),
  role: z.enum(['owner', 'admin', 'developer', 'viewer', 'read', 'write', 'use']),
  granted_by: z.string().nullable(),
  granted_at: z.string(),
  expires_at: z.string().nullable(),
  created_at: z.string()
})

export type UserAccess = z.infer<typeof userAccessSchema>

export const createUserAccessInputSchema = z.object({
  user_id: z.string(),
  entity_type: z.enum(['project', 'task_source', 'file_space', 'secret', 'task']),
  entity_id: z.string(),
  role: z.enum(['owner', 'admin', 'developer', 'viewer', 'read', 'write', 'use']),
  granted_by: z.string().optional(),
  granted_at: z.string().optional(),
  expires_at: z.string().optional()
})

export type CreateUserAccessInput = z.infer<typeof createUserAccessInputSchema>

export const issueMetadataSchema = z.union([
  gitlabMetadataSchema,
  githubMetadataSchema,
  jiraMetadataSchema
])

export type IssueMetadata = z.infer<typeof issueMetadataSchema>

export const taskSourceIssueSchema = z.object({
  id: z.string(),
  iid: z.number().nullable().optional(),
  title: z.string(),
  description: z.string().optional(),
  updatedAt: z.string(),
  uniqueId: z.string(),
  metadata: issueMetadataSchema,
  state: z.enum(['opened', 'closed']).optional()
})

export type TaskSourceIssue = z.infer<typeof taskSourceIssueSchema>

export const apiUsageMetricSchema = z.object({
  id: z.string(),
  pipeline_execution_id: z.string().nullable(),
  session_id: z.string().nullable(),
  task_id: z.string().nullable(),
  provider: z.string(),
  model: z.string(),
  goal: z.string(),
  operation_phase: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  ci_duration_seconds: z.number().nullable(),
  iteration_number: z.number().nullable(),
  metadata: z.any().nullable(),
  created_at: z.date()
})

export type ApiUsageMetric = z.infer<typeof apiUsageMetricSchema>

export const createApiUsageMetricInputSchema = z.object({
  pipeline_execution_id: z.string().nullable().optional(),
  session_id: z.string().nullable().optional(),
  task_id: z.string().nullable().optional(),
  provider: z.string(),
  model: z.string(),
  goal: z.string(),
  phase: z.string(),
  input_tokens: z.number(),
  output_tokens: z.number(),
  cache_creation_input_tokens: z.number(),
  cache_read_input_tokens: z.number(),
  ci_duration_seconds: z.number().nullable().optional(),
  iteration_number: z.number().nullable().optional(),
  metadata: z.any().nullable().optional()
})

export type CreateApiUsageMetricInput = z.infer<typeof createApiUsageMetricInputSchema>

export const aggregatedUsageMetricSchema = z.object({
  provider: z.string(),
  goal: z.string(),
  operation_phase: z.string(),
  date: z.date(),
  total_tokens: z.string(),
  input_tokens: z.string(),
  output_tokens: z.string(),
  cache_creation_tokens: z.string(),
  cache_read_tokens: z.string(),
  total_ci_duration: z.string(),
  api_calls: z.string()
})

export type AggregatedUsageMetric = z.infer<typeof aggregatedUsageMetricSchema>

export const usageMetricsFiltersSchema = z.object({
  start_date: z.string().optional(),
  end_date: z.string().optional(),
  provider: z.string().optional(),
  goal: z.string().optional()
})

export type UsageMetricsFilters = z.infer<typeof usageMetricsFiltersSchema>

export const apiKeyPermissionsSchema = z.object({
  pipeline_execute: z.boolean().optional(),
  read_project: z.boolean().optional(),
  write_project: z.boolean().optional(),
  read_tasks: z.boolean().optional(),
  write_tasks: z.boolean().optional()
})

export type ApiKeyPermissions = z.infer<typeof apiKeyPermissionsSchema>

export const apiKeySchema = z.object({
  id: z.string(),
  project_id: z.string(),
  name: z.string(),
  key_hash: z.string(),
  key_prefix: z.string(),
  permissions: apiKeyPermissionsSchema,
  last_used_at: z.string().nullable(),
  expires_at: z.string().nullable(),
  revoked_at: z.string().nullable(),
  created_by: z.string(),
  created_at: z.string(),
  updated_at: z.string()
})

export type ApiKey = z.infer<typeof apiKeySchema>

export const apiKeyWithSecretSchema = apiKeySchema.extend({
  key: z.string()
})

export type ApiKeyWithSecret = z.infer<typeof apiKeyWithSecretSchema>

export const createApiKeyInputSchema = z.object({
  project_id: z.string(),
  name: z.string(),
  permissions: apiKeyPermissionsSchema.optional(),
  expires_at: z.string().nullable().optional()
})

export type CreateApiKeyInput = z.infer<typeof createApiKeyInputSchema>

export const updateApiKeyInputSchema = z.object({
  name: z.string().optional(),
  permissions: apiKeyPermissionsSchema.optional()
})

export type UpdateApiKeyInput = z.infer<typeof updateApiKeyInputSchema>
