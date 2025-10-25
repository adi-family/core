
export type GitlabMetadata = {
  provider: 'gitlab'
  repo: string
  host?: string
  iid?: number
}

export type GithubMetadata = {
  provider: 'github'
  repo: string
  host?: string
}

export type JiraMetadata = {
  provider: 'jira'
  host: string
  key: string
  project_key: string
}

export type GitlabIssue = {
  id: string
  iid?: number | null
  title: string
  updated_at: string
  metadata: GitlabMetadata
}

export type GithubIssue = {
  id: string
  iid?: number | null
  title: string
  updated_at: string
  metadata: GithubMetadata
}

export type JiraIssue = {
  id: string
  title: string
  updated_at: string
  metadata: JiraMetadata
}

export type GitlabExecutorConfig = {
  host: string
  access_token_secret_id: string
  verified_at?: string
  user?: string
}

export type AnthropicCloudConfig = {
  type: 'cloud'
  api_key_secret_id: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export type AnthropicSelfHostedConfig = {
  type: 'self-hosted'
  api_key_secret_id: string
  endpoint_url: string
  model?: string
  max_tokens?: number
  temperature?: number
  additional_headers?: Record<string, string>
}

export type AnthropicConfig = AnthropicCloudConfig | AnthropicSelfHostedConfig

export type OpenAICloudConfig = {
  type: 'cloud'
  api_key_secret_id: string
  organization_id?: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export type OpenAIAzureConfig = {
  type: 'azure'
  api_key_secret_id: string
  endpoint_url: string
  deployment_name: string
  api_version: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export type OpenAISelfHostedConfig = {
  type: 'self-hosted'
  api_key_secret_id: string
  endpoint_url: string
  model?: string
  max_tokens?: number
  temperature?: number
  additional_headers?: Record<string, string>
}

export type OpenAIConfig = OpenAICloudConfig | OpenAIAzureConfig | OpenAISelfHostedConfig

export type GoogleCloudConfig = {
  type: 'cloud'
  api_key_secret_id: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export type GoogleVertexConfig = {
  type: 'vertex'
  api_key_secret_id: string
  project_id: string
  location: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export type GoogleSelfHostedConfig = {
  type: 'self-hosted'
  api_key_secret_id: string
  endpoint_url: string
  model?: string
  max_tokens?: number
  temperature?: number
  additional_headers?: Record<string, string>
}

export type GoogleConfig = GoogleCloudConfig | GoogleVertexConfig | GoogleSelfHostedConfig

export type AIProviderConfig = {
  anthropic?: AnthropicConfig
  openai?: OpenAIConfig
  google?: GoogleConfig
}

export type AIProviderValidationResult = {
  valid: boolean
  endpoint_reachable: boolean
  authentication_valid: boolean
  error?: string
  details?: Record<string, any>
  tested_at: string
}

export type Project = {
  id: string
  name: string
  enabled: boolean
  job_executor_gitlab: GitlabExecutorConfig | null
  ai_provider_configs: AIProviderConfig | null
  created_at: string
  updated_at: string
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: string
  remote_status: 'opened' | 'closed'
  project_id: string | null
  task_source_id: string
  file_space_id: string | null
  source_gitlab_issue: GitlabIssue | null
  source_github_issue: GithubIssue | null
  source_jira_issue: JiraIssue | null
  ai_evaluation_status: 'pending' | 'queued' | 'evaluating' | 'completed' | 'failed'
  ai_evaluation_result: 'ready' | 'needs_clarification' | null
  ai_evaluation_simple_result: {
    complexity?: number
    cross_service_communication?: number
    estimated_effort_hours?: number
    [key: string]: unknown
  } | null
  ai_evaluation_agentic_result: {
    report?: string
    verdict?: string
    can_implement?: boolean
    blockers?: string[]
    requirements?: string[]
    [key: string]: unknown
  } | null
  ai_evaluation_session_id: string | null
  ai_implementation_status: 'pending' | 'queued' | 'implementing' | 'completed' | 'failed'
  ai_implementation_session_id: string | null
  created_at: string
  updated_at: string
}

export type Session = {
  id: string
  task_id: string | null
  runner: string
  created_at: string
  updated_at: string
}

export type Message = {
  id: string
  session_id: string
  data: unknown
  created_at: string
}

export type CreateProjectInput = {
  name: string
  enabled?: boolean
}

export type UpdateProjectInput = Partial<CreateProjectInput>

export type CreateTaskInput = {
  title: string
  description?: string
  status: string
  remote_status?: 'opened' | 'closed'
  project_id?: string
  task_source_id?: string
  file_space_id?: string
  source_gitlab_issue?: GitlabIssue
  source_github_issue?: GithubIssue
  source_jira_issue?: JiraIssue
}

export type UpdateTaskInput = Partial<Omit<Task, 'id' | 'created_at' | 'updated_at'>>

export type CreateSessionInput = {
  task_id?: string
  runner: string
}

export type CreateMessageInput = {
  session_id: string
  data: unknown
}

export type GitlabFileSpaceConfig = {
  repo: string
  host?: string
  access_token_secret_id?: string
}

export type GithubFileSpaceConfig = {
  repo: string
  host?: string
  access_token_secret_id?: string
}

export type FileSpace = {
  id: string
  project_id: string
  name: string
  enabled: boolean
  created_at: string
  updated_at: string
} & (
  | { type: 'gitlab'; config: GitlabFileSpaceConfig }
  | { type: 'github'; config: GithubFileSpaceConfig }
)

export type CreateFileSpaceInput = {
  project_id: string
  name: string
  enabled?: boolean
} & (
  | { type: 'gitlab'; config: GitlabFileSpaceConfig }
  | { type: 'github'; config: GithubFileSpaceConfig }
)

export type UpdateFileSpaceInput =
  | Partial<{ project_id: string; name: string; enabled: boolean } & { type: 'gitlab'; config: GitlabFileSpaceConfig }>
  | Partial<{ project_id: string; name: string; enabled: boolean } & { type: 'github'; config: GithubFileSpaceConfig }>

export type TaskSource = {
  id: string;
  project_id: string;
  name: string;
  enabled: boolean;
  sync_status: 'pending' | 'queued' | 'syncing' | 'completed' | 'failed';
  last_synced_at: string | null;
  created_at: string;
  updated_at: string;
} & (
  | { type: 'gitlab_issues'; config: GitlabIssuesConfig }
  | { type: 'jira'; config: TaskSourceJiraConfig }
  | { type: 'github_issues'; config: GithubIssuesConfig }
  );

export type CreateTaskSourceInput = {
  project_id: string
  name: string
  enabled?: boolean
} & (
  | { type: 'gitlab_issues'; config: GitlabIssuesConfig }
  | { type: 'jira'; config: TaskSourceJiraConfig }
  | { type: 'github_issues'; config: GithubIssuesConfig }
  )

export type UpdateTaskSourceInput = Partial<CreateTaskSourceInput>

export type WorkerRepository = {
  id: string
  project_id: string
  source_gitlab: unknown
  current_version: string
  created_at: string
  updated_at: string
}

export type CreateWorkerRepositoryInput = {
  project_id: string
  source_gitlab: unknown
  current_version: string
}

export type UpdateWorkerRepositoryInput = Partial<Omit<CreateWorkerRepositoryInput, 'project_id'>>

export type PipelineExecution = {
  id: string
  session_id: string
  worker_repository_id: string
  pipeline_id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
  last_status_update: string | null
  created_at: string
  updated_at: string
}

export type CreatePipelineExecutionInput = {
  session_id: string
  worker_repository_id: string
  pipeline_id?: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
}

export type UpdatePipelineExecutionInput = {
  pipeline_id?: string
  status?: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
  last_status_update?: string
}

export type PipelineArtifact = {
  id: string
  pipeline_execution_id: string
  artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'execution_result' | 'text' | 'task_evaluation' | 'task_implementation'
  reference_url: string
  metadata: unknown | null
  created_at: string
}

export type CreatePipelineArtifactInput = {
  pipeline_execution_id: string
  artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'execution_result' | 'text' | 'task_evaluation' | 'task_implementation'
  reference_url: string
  metadata?: unknown
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }

// Worker Cache Types
export type WorkerCache = {
  id: number
  issue_id: string
  project_id: string
  last_processed_at: string
  status: string | null
  task_id: string | null
  processing_started_at: string | null
  processing_worker_id: string | null
  created_at: string
  updated_at: string
}

export type LockContext = {
  issueId: string
  workerId: string
  lockTimeoutSeconds?: number
}

export type SignalInfo = {
  issueId: string
  date: string
  taskId: string
}

export type Secret = {
  id: string
  project_id: string
  name: string
  value: string
  encrypted_value: string | null
  encryption_version: string | null
  is_encrypted: boolean
  description: string | null
  created_at: string
  updated_at: string
}

export type CreateSecretInput = {
  project_id: string
  name: string
  value: string
  description?: string
}

export type UpdateSecretInput = {
  value?: string
  description?: string
}

export type UserAccess = {
  id: string
  user_id: string
  entity_type: 'project' | 'task_source' | 'file_space' | 'secret' | 'task'
  entity_id: string
  role: 'owner' | 'admin' | 'developer' | 'viewer' | 'read' | 'write' | 'use'
  granted_by: string | null
  granted_at: string
  expires_at: string | null
  created_at: string
}

export type CreateUserAccessInput = {
  user_id: string
  entity_type: 'project' | 'task_source' | 'file_space' | 'secret' | 'task'
  entity_id: string
  role: 'owner' | 'admin' | 'developer' | 'viewer' | 'read' | 'write' | 'use'
  granted_by?: string
  granted_at?: string
  expires_at?: string
}

export type IssueMetadata = GitlabMetadata | GithubMetadata | JiraMetadata;

export type TaskSourceIssue = {
  id: string;
  iid?: number | null;
  title: string;
  description?: string;
  updatedAt: string;
  uniqueId: string;
  metadata: IssueMetadata;
  state?: 'opened' | 'closed';
};

export type GitlabIssuesConfig = {
  repo: string;
  labels: string[];
  host?: string;
  access_token_secret_id?: string;
};

export type GithubIssuesConfig = {
  repo: string;
  labels?: string[];
  host?: string;
  access_token_secret_id?: string;
};

export type TaskSourceJiraConfig = {
  project_key: string;
  jql_filter?: string;
  host: string;
  access_token_secret_id?: string;
};
