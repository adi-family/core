// API Response types - dates are serialized as strings
// These types represent what we actually get from the API

type JSONValue = string | number | boolean | null | { [key: string]: JSONValue } | JSONValue[]

export type ApiProject = {
  id: string
  name: string
  enabled: boolean
  created_at: string
  updated_at: string
}

export type ApiSecret = {
  id: string
  project_id: string
  name: string
  value: string
  description: string | null
  created_at: string
  updated_at: string
}

export type ApiTaskSource = {
  id: string
  project_id: string
  name: string
  type: 'gitlab_issues' | 'github_issues' | 'jira'
  config: JSONValue
  enabled: boolean
  created_at: string
  updated_at: string
}

export type ApiFileSpace = {
  id: string
  project_id: string
  name: string
  type: 'gitlab' | 'github'
  config: JSONValue
  enabled: boolean
  created_at: string
  updated_at: string
}

export type ApiSession = {
  id: string
  task_id: string | null
  runner: string
  created_at: string
  updated_at: string
}

export type ApiMessage = {
  id: string
  session_id: string
  data: JSONValue
  created_at: string
}

export type ApiPipelineExecution = {
  id: string
  session_id: string
  worker_repository_id: string
  pipeline_id: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'canceled'
  last_status_update: string | null
  created_at: string
  updated_at: string
}

export type ApiPipelineArtifact = {
  id: string
  pipeline_execution_id: string
  artifact_type: 'merge_request' | 'issue' | 'branch' | 'commit' | 'text' | 'execution_result'
  reference_url: string
  metadata: JSONValue
  created_at: string
}

export type ApiGitlabIssue = {
  id: string
  iid?: number | null
  title: string
  updated_at: string
  metadata: {
    provider: 'gitlab'
    repo: string
    host?: string
    iid?: number
  }
}

export type ApiGithubIssue = {
  id: string
  iid?: number | null
  title: string
  updated_at: string
  metadata: {
    provider: 'github'
    repo: string
    host?: string
  }
}

export type ApiJiraIssue = {
  id: string
  title: string
  updated_at: string
  metadata: {
    provider: 'jira'
    host: string
    key: string
    project_key: string
  }
}

export type ApiTask = {
  id: string
  title: string
  description: string | null
  status: string
  project_id: string | null
  task_source_id: string
  file_space_id: string | null
  source_gitlab_issue: ApiGitlabIssue | null
  source_github_issue: ApiGithubIssue | null
  source_jira_issue: ApiJiraIssue | null
  created_at: string
  updated_at: string
}
