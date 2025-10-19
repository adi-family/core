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
  updated_at: Date
  metadata: GitlabMetadata
}

export type GithubIssue = {
  id: string
  iid?: number | null
  title: string
  updated_at: Date
  metadata: GithubMetadata
}

export type JiraIssue = {
  id: string
  title: string
  updated_at: Date
  metadata: JiraMetadata
}

export type Project = {
  id: string
  name: string
  enabled: boolean
  created_at: Date
  updated_at: Date
}

export type Task = {
  id: string
  title: string
  description: string | null
  status: string
  project_id: string | null
  task_source_id: string
  source_gitlab_issue: GitlabIssue | null
  source_github_issue: GithubIssue | null
  source_jira_issue: JiraIssue | null
  created_at: Date
  updated_at: Date
}

export type Session = {
  id: string
  task_id: string | null
  runner: string
  created_at: Date
  updated_at: Date
}

export type Message = {
  id: string
  session_id: string
  data: unknown
  created_at: Date
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
  project_id?: string
  source_gitlab_issue?: GitlabIssue
  source_github_issue?: GithubIssue
  source_jira_issue?: JiraIssue
}

export type UpdateTaskInput = Partial<CreateTaskInput>

export type CreateSessionInput = {
  task_id?: string
  runner: string
}

export type CreateMessageInput = {
  session_id: string
  data: unknown
}

export type FileSpace = {
  id: string
  project_id: string
  name: string
  type: 'gitlab' | 'github'
  config: unknown
  enabled: boolean
  created_at: Date
  updated_at: Date
}

export type CreateFileSpaceInput = {
  project_id: string
  name: string
  type: 'gitlab' | 'github'
  config: unknown
  enabled?: boolean
}

export type UpdateFileSpaceInput = Partial<CreateFileSpaceInput>

export type TaskSource = {
  id: string
  project_id: string
  name: string
  type: 'gitlab_issues' | 'jira' | 'github_issues'
  config: unknown
  enabled: boolean
  created_at: Date
  updated_at: Date
}

export type CreateTaskSourceInput = {
  project_id: string
  name: string
  type: 'gitlab_issues' | 'jira' | 'github_issues'
  config: unknown
  enabled?: boolean
}

export type UpdateTaskSourceInput = Partial<CreateTaskSourceInput>

export type WorkerRepository = {
  id: string
  project_id: string
  source_gitlab: unknown
  current_version: string
  created_at: Date
  updated_at: Date
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
  last_status_update: Date | null
  created_at: Date
  updated_at: Date
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
  last_status_update?: Date
}

export type PipelineArtifact = {
  id: string
  pipeline_execution_id: string
  artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'execution_result' | 'text'
  reference_url: string
  metadata: unknown | null
  created_at: Date
}

export type CreatePipelineArtifactInput = {
  pipeline_execution_id: string
  artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'execution_result' | 'text'
  reference_url: string
  metadata?: unknown
}

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
