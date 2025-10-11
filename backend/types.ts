// Database types matching schema

export type Project = {
  id: string
  name: string
  type: 'gitlab' | 'jira' | 'parent'
  config: unknown
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
  source_gitlab_issue: unknown | null
  source_github_issue: unknown | null
  source_jira_issue: unknown | null
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

// Request/Response types

export type CreateProjectInput = {
  name: string
  type: 'gitlab' | 'jira' | 'parent'
  config: unknown
  enabled?: boolean
}

export type UpdateProjectInput = Partial<CreateProjectInput>

export type CreateTaskInput = {
  title: string
  description?: string
  status: string
  project_id?: string
  source_gitlab_issue?: unknown
  source_github_issue?: unknown
  source_jira_issue?: unknown
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

// Result type for error handling

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
