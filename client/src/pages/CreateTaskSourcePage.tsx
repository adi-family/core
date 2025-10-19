import { type FormEvent, useState } from "react"
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
import { ProjectSelect } from "@/components/ProjectSelect"
import { SecretSelect } from "@/components/SecretSelect"
import { client } from "@/lib/client"
import type { CreateTaskSourceInput } from "../../../types"

type TaskSourceType = 'gitlab_issues' | 'jira' | 'github_issues'

type GitlabIssuesConfig = {
  repo: string
  labels: string[]
  host?: string
  access_token_secret_id?: string
}

type GithubIssuesConfig = {
  repo: string
  labels?: string[]
  host?: string
  access_token_secret_id?: string
}

type JiraConfig = {
  project_key: string
  jql_filter?: string
  host: string
  access_token_secret_id?: string
}

export function CreateTaskSourcePage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

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
    access_token_secret_id: "",
  })

  const [githubConfig, setGithubConfig] = useState<GithubIssuesConfig>({
    repo: "",
    labels: [],
    host: "https://github.com",
    access_token_secret_id: "",
  })

  const [jiraConfig, setJiraConfig] = useState<JiraConfig>({
    project_key: "",
    jql_filter: "",
    host: "",
    access_token_secret_id: "",
  })

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

            <ProjectSelect
              value={formData.project_id}
              onChange={(projectId) => handleInputChange("project_id", projectId)}
              required
            />

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

                <SecretSelect
                  projectId={formData.project_id}
                  value={gitlabConfig.access_token_secret_id || ""}
                  onChange={(secretId) => handleGitlabConfigChange("access_token_secret_id", secretId)}
                  label={`ACCESS TOKEN SECRET ${(gitlabConfig.host && gitlabConfig.host !== "https://gitlab.com") ? "(REQUIRED)" : "(OPTIONAL)"}`}
                  placeholder="Select access token secret"
                  required={gitlabConfig.host !== "" && gitlabConfig.host !== "https://gitlab.com"}
                />
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

                <SecretSelect
                  projectId={formData.project_id}
                  value={githubConfig.access_token_secret_id || ""}
                  onChange={(secretId) => handleGithubConfigChange("access_token_secret_id", secretId)}
                  label="ACCESS TOKEN SECRET (OPTIONAL)"
                  placeholder="Select access token secret"
                  required={false}
                />
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

                <SecretSelect
                  projectId={formData.project_id}
                  value={jiraConfig.access_token_secret_id || ""}
                  onChange={(secretId) => handleJiraConfigChange("access_token_secret_id", secretId)}
                  label="ACCESS TOKEN SECRET (OPTIONAL)"
                  placeholder="Select access token secret"
                  required={false}
                />
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
