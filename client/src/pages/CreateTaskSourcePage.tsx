import { type FormEvent, useState, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { client } from "@/lib/client"
import type { CreateTaskSourceInput, Project } from "../../../types"

type TaskSourceType = 'gitlab_issues' | 'jira' | 'github_issues'

type GitlabIssuesConfig = {
  repo: string
  labels: string[]
  host?: string
  access_token?: string
}

type GithubIssuesConfig = {
  repo: string
  labels?: string[]
  host?: string
  access_token?: string
}

type JiraConfig = {
  project_key: string
  jql_filter?: string
  host: string
  access_token?: string
}

export function CreateTaskSourcePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)
  const [projects, setProjects] = useState<Project[]>([])
  const [loadingProjects, setLoadingProjects] = useState(true)

  const [formData, setFormData] = useState({
    project_id: "",
    name: "",
    type: "gitlab_issues" as TaskSourceType,
    enabled: true,
  })

  const [gitlabConfig, setGitlabConfig] = useState<GitlabIssuesConfig>({
    repo: "",
    labels: ["DOIT"],
    host: "https://gitlab.com",
    access_token: "",
  })

  const [githubConfig, setGithubConfig] = useState<GithubIssuesConfig>({
    repo: "",
    labels: [],
    host: "https://github.com",
    access_token: "",
  })

  const [jiraConfig, setJiraConfig] = useState<JiraConfig>({
    project_key: "",
    jql_filter: "",
    host: "",
    access_token: "",
  })

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await client.projects.$get()
        if (!res.ok) {
          console.error("Error fetching projects:", await res.text())
          setLoadingProjects(false)
          return
        }
        const data = await res.json()
        setProjects(data)
        setLoadingProjects(false)
      } catch (error) {
        console.error("Error fetching projects:", error)
        setLoadingProjects(false)
      }
    }

    fetchProjects().catch((error) => {
      console.error("Error fetching projects:", error)
      setLoadingProjects(false)
    })
  }, [])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      let config: unknown
      if (formData.type === "gitlab_issues") {
        config = gitlabConfig
      } else if (formData.type === "github_issues") {
        config = githubConfig
      } else {
        config = jiraConfig
      }

      const payload: CreateTaskSourceInput = {
        project_id: formData.project_id,
        name: formData.name,
        type: formData.type,
        config,
        enabled: formData.enabled,
      }

      const res = await client["task-sources"].$post({
        json: payload,
      })

      if (!res.ok) {
        const errorText = await res.text()
        setError(`Failed to create task source: ${errorText}`)
        setLoading(false)
        return
      }

      setSuccess(true)
      setLoading(false)

      setTimeout(() => {
        navigate("/task-sources")
      }, 1500)
    } catch {
      setError("Error creating task source")
      setLoading(false)
    }
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleGitlabConfigChange = (field: keyof GitlabIssuesConfig, value: string | string[]) => {
    setGitlabConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleGithubConfigChange = (field: keyof GithubIssuesConfig, value: string | string[]) => {
    setGithubConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleJiraConfigChange = (field: keyof JiraConfig, value: string) => {
    setJiraConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (success) {
    return (
      <div className="mx-auto p-6 max-w-7xl">
        <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-lg font-medium mb-2 text-green-600">
                ✓ TASK SOURCE CREATED SUCCESSFULLY
              </div>
              <p className="text-gray-600 text-xs uppercase tracking-wide">
                Redirecting to task sources list...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md">
        <CardHeader>
          <CardTitle className="text-xl uppercase tracking-wide bg-gradient-to-r from-gray-800 to-gray-900 bg-clip-text text-transparent">
            CREATE TASK SOURCE
          </CardTitle>
          <CardDescription className="text-xs uppercase tracking-wide">
            Configure a new issue tracking integration
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50/90 text-red-600 px-4 py-3 border border-red-200/60 backdrop-blur-sm text-sm">
                {error}
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="project_id" className="text-xs uppercase tracking-wide">
                PROJECT
              </Label>
              {loadingProjects ? (
                <div className="text-sm text-gray-600">Loading projects...</div>
              ) : (
                <Select
                  id="project_id"
                  value={formData.project_id}
                  onChange={(e) => handleInputChange("project_id", e.target.value)}
                  className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="name" className="text-xs uppercase tracking-wide">
                NAME
              </Label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
                placeholder="e.g., Project Issues"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="type" className="text-xs uppercase tracking-wide">
                TYPE
              </Label>
              <Select
                id="type"
                value={formData.type}
                onChange={(e) => handleInputChange("type", e.target.value as TaskSourceType)}
                className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                required
              >
                <option value="gitlab_issues">GitLab Issues</option>
                <option value="github_issues">GitHub Issues</option>
                <option value="jira">Jira</option>
              </Select>
            </div>

            {/* GitLab Issues Configuration */}
            {formData.type === "gitlab_issues" && (
              <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
                <h3 className="text-xs uppercase tracking-wide font-medium">GITLAB CONFIGURATION</h3>

                <div className="space-y-2">
                  <Label htmlFor="gitlab_repo" className="text-xs uppercase tracking-wide">
                    REPOSITORY
                  </Label>
                  <Input
                    id="gitlab_repo"
                    type="text"
                    value={gitlabConfig.repo}
                    onChange={(e) => handleGitlabConfigChange("repo", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    placeholder="e.g., group/project"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitlab_labels" className="text-xs uppercase tracking-wide">
                    LABELS (COMMA-SEPARATED)
                  </Label>
                  <Input
                    id="gitlab_labels"
                    type="text"
                    value={gitlabConfig.labels.join(", ")}
                    onChange={(e) => handleGitlabConfigChange("labels", e.target.value.split(",").map(l => l.trim()).filter(l => l))}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., DOIT, TODO"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide">
                    HOST (OPTIONAL)
                  </Label>
                  <Input
                    id="gitlab_host"
                    type="text"
                    value={gitlabConfig.host || ""}
                    onChange={(e) => handleGitlabConfigChange("host", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="https://gitlab.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="gitlab_access_token" className="text-xs uppercase tracking-wide">
                    ACCESS TOKEN {(gitlabConfig.host && gitlabConfig.host !== "https://gitlab.com") ? "(REQUIRED)" : "(OPTIONAL)"}
                  </Label>
                  <Input
                    id="gitlab_access_token"
                    type="password"
                    value={gitlabConfig.access_token || ""}
                    onChange={(e) => handleGitlabConfigChange("access_token", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono"
                    placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
                    required={gitlabConfig.host !== "" && gitlabConfig.host !== "https://gitlab.com"}
                  />
                  <p className="text-xs text-gray-600">
                    {(gitlabConfig.host && gitlabConfig.host !== "https://gitlab.com")
                      ? "Access token is required for self-hosted GitLab instances"
                      : "If not provided, gitlab.com/artificial-developer must be added to the project with read access to issues and ability to make changes"
                    }
                  </p>
                </div>
              </div>
            )}

            {/* GitHub Issues Configuration */}
            {formData.type === "github_issues" && (
              <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
                <h3 className="text-xs uppercase tracking-wide font-medium">GITHUB CONFIGURATION</h3>

                <div className="space-y-2">
                  <Label htmlFor="github_repo" className="text-xs uppercase tracking-wide">
                    REPOSITORY
                  </Label>
                  <Input
                    id="github_repo"
                    type="text"
                    value={githubConfig.repo}
                    onChange={(e) => handleGithubConfigChange("repo", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    placeholder="e.g., owner/repo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github_labels" className="text-xs uppercase tracking-wide">
                    LABELS (COMMA-SEPARATED, OPTIONAL)
                  </Label>
                  <Input
                    id="github_labels"
                    type="text"
                    value={githubConfig.labels?.join(", ") || ""}
                    onChange={(e) => handleGithubConfigChange("labels", e.target.value.split(",").map(l => l.trim()).filter(l => l))}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., bug, enhancement"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github_host" className="text-xs uppercase tracking-wide">
                    HOST (OPTIONAL)
                  </Label>
                  <Input
                    id="github_host"
                    type="text"
                    value={githubConfig.host || ""}
                    onChange={(e) => handleGithubConfigChange("host", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="https://github.com"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="github_access_token" className="text-xs uppercase tracking-wide">
                    ACCESS TOKEN (OPTIONAL)
                  </Label>
                  <Input
                    id="github_access_token"
                    type="password"
                    value={githubConfig.access_token || ""}
                    onChange={(e) => handleGithubConfigChange("access_token", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono"
                    placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                  />
                  <p className="text-xs text-gray-600">
                    If not provided, uses GITHUB_TOKEN environment variable
                  </p>
                </div>
              </div>
            )}

            {/* Jira Configuration */}
            {formData.type === "jira" && (
              <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
                <h3 className="text-xs uppercase tracking-wide font-medium">JIRA CONFIGURATION</h3>

                <div className="space-y-2">
                  <Label htmlFor="jira_host" className="text-xs uppercase tracking-wide">
                    HOST
                  </Label>
                  <Input
                    id="jira_host"
                    type="text"
                    value={jiraConfig.host}
                    onChange={(e) => handleJiraConfigChange("host", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    placeholder="e.g., https://your-domain.atlassian.net"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jira_project_key" className="text-xs uppercase tracking-wide">
                    PROJECT KEY
                  </Label>
                  <Input
                    id="jira_project_key"
                    type="text"
                    value={jiraConfig.project_key}
                    onChange={(e) => handleJiraConfigChange("project_key", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    required
                    placeholder="e.g., PROJ"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jira_jql_filter" className="text-xs uppercase tracking-wide">
                    JQL FILTER (OPTIONAL)
                  </Label>
                  <Input
                    id="jira_jql_filter"
                    type="text"
                    value={jiraConfig.jql_filter || ""}
                    onChange={(e) => handleJiraConfigChange("jql_filter", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                    placeholder="e.g., labels = DOIT AND status != Done"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="jira_access_token" className="text-xs uppercase tracking-wide">
                    ACCESS TOKEN (OPTIONAL)
                  </Label>
                  <Input
                    id="jira_access_token"
                    type="password"
                    value={jiraConfig.access_token || ""}
                    onChange={(e) => handleJiraConfigChange("access_token", e.target.value)}
                    className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 font-mono"
                    placeholder="API token or PAT"
                  />
                  <p className="text-xs text-gray-600">
                    If not provided, uses JIRA_TOKEN environment variable
                  </p>
                </div>
              </div>
            )}

            <div className="flex items-center space-x-2">
              <input
                id="enabled"
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange("enabled", e.target.checked)}
                className="w-4 h-4 border-gray-300"
              />
              <Label htmlFor="enabled" className="text-xs uppercase tracking-wide">
                ENABLED
              </Label>
            </div>

            <div className="flex gap-2 pt-4">
              <Button
                type="submit"
                disabled={loading}
                className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
              >
                {loading ? "CREATING..." : "CREATE TASK SOURCE"}
              </Button>
              <Button
                type="button"
                onClick={() => navigate("/task-sources")}
                variant="outline"
                className="uppercase tracking-wide"
              >
                CANCEL
              </Button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
