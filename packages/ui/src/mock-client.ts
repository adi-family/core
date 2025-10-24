import type { Secret, ApiClient } from './gitlab-secret-autocomplete'
import type { Project, ProjectApiClient } from './project-select'

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
      const data = await json
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
