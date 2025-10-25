import type { Secret, ApiClient } from './gitlab-secret-autocomplete'
import type { Project, ProjectApiClient } from './project-select'
import type {
  TaskSource,
  FileSpace,
  Task,
  Session,
  WorkerRepository,
  PipelineExecution
} from '@adi-simple/types'

// Mock data
const mockProjects: Project[] = [
  { id: "1", name: "Web Application", created_at: "2024-01-01", updated_at: "2024-01-15" },
  { id: "2", name: "Mobile App", created_at: "2024-01-05", updated_at: "2024-01-20" },
  { id: "3", name: "API Service", created_at: "2024-01-10", updated_at: "2024-01-18" },
  { id: "4", name: "Documentation Site", created_at: "2024-01-12", updated_at: "2024-01-22" },
]

const mockSecrets: Secret[] = [
  {
    id: "secret-1",
    project_id: "1",
    name: "gitlab-token-prod",
    value: "glpat-xxxxxxxxxxxxxxxxxxxx",
    created_at: "2024-01-01",
    updated_at: "2024-01-15"
  },
  {
    id: "secret-2",
    project_id: "1",
    name: "gitlab-token-staging",
    value: "glpat-yyyyyyyyyyyyyyyyyyyy",
    created_at: "2024-01-02",
    updated_at: "2024-01-16"
  },
  {
    id: "secret-3",
    project_id: "2",
    name: "gitlab-api-key",
    value: "glpat-zzzzzzzzzzzzzzzzzzzz",
    created_at: "2024-01-03",
    updated_at: "2024-01-17"
  },
  {
    id: "secret-4",
    project_id: "3",
    name: "github-token",
    value: "ghp_xxxxxxxxxxxxxxxxxxxx",
    created_at: "2024-01-04",
    updated_at: "2024-01-18"
  },
]

const mockTaskSources: TaskSource[] = [
  {
    id: "ts-1",
    project_id: "1",
    name: "Web App GitLab Issues",
    type: "gitlab_issues",
    enabled: true,
    sync_status: "completed",
    last_synced_at: "2024-01-20T10:30:00Z",
    config: {
      repo: "company/web-app",
      labels: ["bug", "enhancement"],
      host: "https://gitlab.com",
      access_token_secret_id: "secret-1"
    },
    created_at: "2024-01-01",
    updated_at: "2024-01-20"
  },
  {
    id: "ts-2",
    project_id: "2",
    name: "Mobile App Jira",
    type: "jira",
    enabled: true,
    sync_status: "completed",
    last_synced_at: "2024-01-21T14:00:00Z",
    config: {
      project_key: "MOB",
      jql_filter: "project = MOB AND status != Done",
      host: "https://company.atlassian.net",
      access_token_secret_id: "secret-3"
    },
    created_at: "2024-01-05",
    updated_at: "2024-01-21"
  },
  {
    id: "ts-3",
    project_id: "3",
    name: "API Service GitHub Issues",
    type: "github_issues",
    enabled: true,
    sync_status: "syncing",
    last_synced_at: "2024-01-19T08:00:00Z",
    config: {
      repo: "company/api-service",
      labels: ["bug", "feature"],
      host: "https://github.com",
      access_token_secret_id: "secret-4"
    },
    created_at: "2024-01-10",
    updated_at: "2024-01-22"
  },
  {
    id: "ts-4",
    project_id: "1",
    name: "Web App GitHub Backup",
    type: "github_issues",
    enabled: false,
    sync_status: "failed",
    last_synced_at: null,
    config: {
      repo: "company/web-app-backup",
      labels: ["critical"],
      host: "https://github.com"
    },
    created_at: "2024-01-15",
    updated_at: "2024-01-15"
  },
]

const mockFileSpaces: FileSpace[] = [
  {
    id: "fs-1",
    project_id: "1",
    name: "Web App Repository",
    type: "gitlab",
    config: {
      repo: "company/web-app",
      host: "https://gitlab.com",
      access_token_secret_id: "secret-1"
    },
    enabled: true,
    created_at: "2024-01-01",
    updated_at: "2024-01-15"
  },
  {
    id: "fs-2",
    project_id: "2",
    name: "Mobile App Repo",
    type: "gitlab",
    config: {
      repo: "company/mobile-app",
      host: "https://gitlab.com",
      access_token_secret_id: "secret-3"
    },
    enabled: true,
    created_at: "2024-01-05",
    updated_at: "2024-01-20"
  },
  {
    id: "fs-3",
    project_id: "3",
    name: "API Service GitHub",
    type: "github",
    config: {
      repo: "company/api-service",
      host: "https://github.com",
      access_token_secret_id: "secret-4"
    },
    enabled: true,
    created_at: "2024-01-10",
    updated_at: "2024-01-18"
  },
  {
    id: "fs-4",
    project_id: "4",
    name: "Docs Repository",
    type: "github",
    config: {
      repo: "company/documentation",
      host: "https://github.com"
    },
    enabled: false,
    created_at: "2024-01-12",
    updated_at: "2024-01-22"
  },
]

const mockTasks: Task[] = [
  {
    id: "task-1",
    title: "Fix authentication bug in login flow",
    description: "Users are experiencing intermittent authentication failures",
    status: "open",
    remote_status: "opened",
    project_id: "1",
    task_source_id: "ts-1",
    file_space_id: "fs-1",
    ai_evaluation_result: null,
    ai_evaluation_simple_result: null,
    ai_evaluation_agentic_result: null,
    source_gitlab_issue: {
      id: "gl-101",
      iid: 42,
      title: "Fix authentication bug in login flow",
      updated_at: "2024-01-20T10:30:00Z",
      metadata: {
        provider: "gitlab",
        repo: "company/web-app",
        host: "https://gitlab.com",
        iid: 42
      }
    },
    source_github_issue: null,
    source_jira_issue: null,
    ai_evaluation_status: "completed",
    ai_evaluation_session_id: "session-1",
    ai_implementation_status: "pending",
    ai_implementation_session_id: null,
    created_at: "2024-01-15",
    updated_at: "2024-01-20"
  },
  {
    id: "task-2",
    title: "Implement dark mode for mobile app",
    description: "Add dark mode support across all screens",
    status: "in_progress",
    remote_status: "opened",
    project_id: "2",
    task_source_id: "ts-2",
    file_space_id: "fs-2",
    ai_evaluation_result: null,
    ai_evaluation_simple_result: null,
    ai_evaluation_agentic_result: null,
    source_gitlab_issue: null,
    source_github_issue: null,
    source_jira_issue: {
      id: "jira-MOB-123",
      title: "Implement dark mode for mobile app",
      updated_at: "2024-01-21T14:00:00Z",
      metadata: {
        provider: "jira",
        host: "https://company.atlassian.net",
        key: "MOB-123",
        project_key: "MOB"
      }
    },
    ai_evaluation_status: "evaluating",
    ai_evaluation_session_id: "session-2",
    ai_implementation_status: "pending",
    ai_implementation_session_id: null,
    created_at: "2024-01-18",
    updated_at: "2024-01-22"
  },
  {
    id: "task-3",
    title: "Optimize API response time",
    description: "API endpoints are slow, need optimization",
    status: "open",
    remote_status: "opened",
    project_id: "3",
    task_source_id: "ts-3",
    file_space_id: "fs-3",
    ai_evaluation_result: null,
    ai_evaluation_simple_result: null,
    ai_evaluation_agentic_result: null,
    source_gitlab_issue: null,
    source_github_issue: {
      id: "gh-456",
      iid: 78,
      title: "Optimize API response time",
      updated_at: "2024-01-22T08:00:00Z",
      metadata: {
        provider: "github",
        repo: "company/api-service",
        host: "https://github.com"
      }
    },
    source_jira_issue: null,
    ai_evaluation_status: "pending",
    ai_evaluation_session_id: null,
    ai_implementation_status: "pending",
    ai_implementation_session_id: null,
    created_at: "2024-01-20",
    updated_at: "2024-01-22"
  },
  {
    id: "task-4",
    title: "Update documentation for new API endpoints",
    description: null,
    status: "done",
    remote_status: "closed",
    project_id: "4",
    task_source_id: "ts-1",
    file_space_id: "fs-4",
    ai_evaluation_result: null,
    ai_evaluation_simple_result: null,
    ai_evaluation_agentic_result: null,
    source_gitlab_issue: {
      id: "gl-102",
      iid: 43,
      title: "Update documentation for new API endpoints",
      updated_at: "2024-01-19T16:00:00Z",
      metadata: {
        provider: "gitlab",
        repo: "company/web-app",
        host: "https://gitlab.com",
        iid: 43
      }
    },
    source_github_issue: null,
    source_jira_issue: null,
    ai_evaluation_status: "completed",
    ai_evaluation_session_id: "session-3",
    ai_implementation_status: "pending",
    ai_implementation_session_id: null,
    created_at: "2024-01-12",
    updated_at: "2024-01-19"
  },
]

const mockSessions: Session[] = [
  {
    id: "session-1",
    task_id: "task-1",
    runner: "claude-3-opus",
    created_at: "2024-01-16T09:00:00Z",
    updated_at: "2024-01-20T11:30:00Z"
  },
  {
    id: "session-2",
    task_id: "task-2",
    runner: "gpt-4-turbo",
    created_at: "2024-01-19T14:00:00Z",
    updated_at: "2024-01-22T10:00:00Z"
  },
  {
    id: "session-3",
    task_id: "task-4",
    runner: "claude-3-sonnet",
    created_at: "2024-01-13T10:00:00Z",
    updated_at: "2024-01-19T16:30:00Z"
  },
  {
    id: "session-4",
    task_id: null,
    runner: "gemini-pro",
    created_at: "2024-01-22T08:00:00Z",
    updated_at: "2024-01-22T08:00:00Z"
  },
]

const mockWorkerRepositories: WorkerRepository[] = [
  {
    id: "wr-1",
    project_id: "1",
    source_gitlab: {
      repo: "company/web-app-worker",
      host: "https://gitlab.com",
      access_token_secret_id: "secret-1"
    },
    current_version: "v1.2.3",
    created_at: "2024-01-01",
    updated_at: "2024-01-20"
  },
  {
    id: "wr-2",
    project_id: "2",
    source_gitlab: {
      repo: "company/mobile-worker",
      host: "https://gitlab.com",
      access_token_secret_id: "secret-3"
    },
    current_version: "v2.0.1",
    created_at: "2024-01-05",
    updated_at: "2024-01-21"
  },
  {
    id: "wr-3",
    project_id: "3",
    source_gitlab: {
      repo: "company/api-worker",
      host: "https://gitlab.com",
      access_token_secret_id: "secret-1"
    },
    current_version: "v1.5.0",
    created_at: "2024-01-10",
    updated_at: "2024-01-18"
  },
]

const mockPipelineExecutions: PipelineExecution[] = [
  {
    id: "pe-1",
    session_id: "session-1",
    worker_repository_id: "wr-1",
    pipeline_id: "12345",
    status: "success",
    last_status_update: "2024-01-20T11:30:00Z",
    created_at: "2024-01-20T10:00:00Z",
    updated_at: "2024-01-20T11:30:00Z"
  },
  {
    id: "pe-2",
    session_id: "session-2",
    worker_repository_id: "wr-2",
    pipeline_id: "12346",
    status: "running",
    last_status_update: "2024-01-22T10:00:00Z",
    created_at: "2024-01-22T09:00:00Z",
    updated_at: "2024-01-22T10:00:00Z"
  },
  {
    id: "pe-3",
    session_id: "session-3",
    worker_repository_id: "wr-3",
    pipeline_id: "12347",
    status: "success",
    last_status_update: "2024-01-19T16:30:00Z",
    created_at: "2024-01-19T15:00:00Z",
    updated_at: "2024-01-19T16:30:00Z"
  },
  {
    id: "pe-4",
    session_id: "session-1",
    worker_repository_id: "wr-1",
    pipeline_id: "12348",
    status: "failed",
    last_status_update: "2024-01-18T12:00:00Z",
    created_at: "2024-01-18T11:00:00Z",
    updated_at: "2024-01-18T12:00:00Z"
  },
]

// Mock API client for secrets
export const mockApiClient: ApiClient = {
  secrets: {
    $get: async () => {
      return new Response(JSON.stringify(mockSecrets), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-project": {
      ":projectId": {
        $get: async ({ param }: any) => {
          const filtered = mockSecrets.filter(s => s.project_id === param.projectId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    },
    $post: async ({ json }: any) => {
      const data = await json()
      const newSecret: Secret = {
        id: `secret-${Date.now()}`,
        project_id: data.projectId || "1",
        name: data.name,
        value: data.value,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString()
      }
      mockSecrets.push(newSecret)
      return new Response(JSON.stringify(newSecret), {
        status: 201,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

// Mock API client for projects
export const mockProjectClient: ProjectApiClient = {
  projects: {
    $get: async () => {
      return new Response(JSON.stringify(mockProjects), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    }
  }
}

// API client types for new entities
export type TaskSourceApiClient = {
  "task-sources": {
    $get: () => Promise<Response>
    "by-project": {
      ":projectId": {
        $get: ({ param }: { param: { projectId: string } }) => Promise<Response>
      }
    }
  }
}

export type FileSpaceApiClient = {
  "file-spaces": {
    $get: () => Promise<Response>
    "by-project": {
      ":projectId": {
        $get: ({ param }: { param: { projectId: string } }) => Promise<Response>
      }
    }
  }
}

export type TaskApiClient = {
  tasks: {
    $get: () => Promise<Response>
    "by-project": {
      ":projectId": {
        $get: ({ param }: { param: { projectId: string } }) => Promise<Response>
      }
    }
    "by-task-source": {
      ":taskSourceId": {
        $get: ({ param }: { param: { taskSourceId: string } }) => Promise<Response>
      }
    }
  }
}

export type SessionApiClient = {
  sessions: {
    $get: () => Promise<Response>
    "by-task": {
      ":taskId": {
        $get: ({ param }: { param: { taskId: string } }) => Promise<Response>
      }
    }
  }
}

export type WorkerRepositoryApiClient = {
  "worker-repositories": {
    $get: () => Promise<Response>
    "by-project": {
      ":projectId": {
        $get: ({ param }: { param: { projectId: string } }) => Promise<Response>
      }
    }
  }
}

export type PipelineExecutionApiClient = {
  "pipeline-executions": {
    $get: () => Promise<Response>
    "by-session": {
      ":sessionId": {
        $get: ({ param }: { param: { sessionId: string } }) => Promise<Response>
      }
    }
    "by-worker-repository": {
      ":workerRepositoryId": {
        $get: ({ param }: { param: { workerRepositoryId: string } }) => Promise<Response>
      }
    }
  }
}

// Mock API client for task sources
export const mockTaskSourceClient: TaskSourceApiClient = {
  "task-sources": {
    $get: async () => {
      return new Response(JSON.stringify(mockTaskSources), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-project": {
      ":projectId": {
        $get: async ({ param }: any) => {
          const filtered = mockTaskSources.filter(ts => ts.project_id === param.projectId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

// Mock API client for file spaces
export const mockFileSpaceClient: FileSpaceApiClient = {
  "file-spaces": {
    $get: async () => {
      return new Response(JSON.stringify(mockFileSpaces), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-project": {
      ":projectId": {
        $get: async ({ param }: any) => {
          const filtered = mockFileSpaces.filter(fs => fs.project_id === param.projectId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

// Mock API client for tasks
export const mockTaskClient: TaskApiClient = {
  tasks: {
    $get: async () => {
      return new Response(JSON.stringify(mockTasks), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-project": {
      ":projectId": {
        $get: async ({ param }: any) => {
          const filtered = mockTasks.filter(t => t.project_id === param.projectId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    },
    "by-task-source": {
      ":taskSourceId": {
        $get: async ({ param }: any) => {
          const filtered = mockTasks.filter(t => t.task_source_id === param.taskSourceId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

// Mock API client for sessions
export const mockSessionClient: SessionApiClient = {
  sessions: {
    $get: async () => {
      return new Response(JSON.stringify(mockSessions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-task": {
      ":taskId": {
        $get: async ({ param }: any) => {
          const filtered = mockSessions.filter(s => s.task_id === param.taskId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

// Mock API client for worker repositories
export const mockWorkerRepositoryClient: WorkerRepositoryApiClient = {
  "worker-repositories": {
    $get: async () => {
      return new Response(JSON.stringify(mockWorkerRepositories), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-project": {
      ":projectId": {
        $get: async ({ param }: any) => {
          const filtered = mockWorkerRepositories.filter(wr => wr.project_id === param.projectId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}

// Mock API client for pipeline executions
export const mockPipelineExecutionClient: PipelineExecutionApiClient = {
  "pipeline-executions": {
    $get: async () => {
      return new Response(JSON.stringify(mockPipelineExecutions), {
        status: 200,
        headers: { 'Content-Type': 'application/json' }
      })
    },
    "by-session": {
      ":sessionId": {
        $get: async ({ param }: any) => {
          const filtered = mockPipelineExecutions.filter(pe => pe.session_id === param.sessionId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    },
    "by-worker-repository": {
      ":workerRepositoryId": {
        $get: async ({ param }: any) => {
          const filtered = mockPipelineExecutions.filter(pe => pe.worker_repository_id === param.workerRepositoryId)
          return new Response(JSON.stringify(filtered), {
            status: 200,
            headers: { 'Content-Type': 'application/json' }
          })
        }
      }
    }
  }
}
