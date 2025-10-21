import { type FormEvent, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
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
import { GitlabTaskSourceConfig } from "@/components/GitlabTaskSourceConfig"
import { createAuthenticatedClient } from "@/lib/client"
import type { CreateTaskSourceInput } from "../../../types"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"

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

type Step = {
  id: number
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 1, title: "BASIC INFO", description: "Name and project" },
  { id: 2, title: "SOURCE TYPE", description: "Choose integration" },
  { id: 3, title: "CONFIGURATION", description: "Source settings" },
  { id: 4, title: "REVIEW", description: "Confirm details" },
]

export function TaskSourceMultistageForm() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [currentStep, setCurrentStep] = useState(1)
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
      let payload: CreateTaskSourceInput
      if (formData.type === "gitlab_issues") {
        payload = {
          project_id: formData.project_id,
          name: formData.name,
          type: formData.type,
          config: gitlabConfig,
          enabled: formData.enabled,
        }
      } else if (formData.type === "github_issues") {
        payload = {
          project_id: formData.project_id,
          name: formData.name,
          type: formData.type,
          config: githubConfig,
          enabled: formData.enabled,
        }
      } else {
        payload = {
          project_id: formData.project_id,
          name: formData.name,
          type: formData.type,
          config: jiraConfig,
          enabled: formData.enabled,
        }
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

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.project_id !== "" && formData.name !== ""
      case 2:
        return true
      case 3:
        if (formData.type === "gitlab_issues") {
          return gitlabConfig.repo !== "" && gitlabConfig.access_token_secret_id !== ""
        } else if (formData.type === "github_issues") {
          return githubConfig.repo !== ""
        } else {
          return jiraConfig.host !== "" && jiraConfig.project_key !== ""
        }
      default:
        return true
    }
  }

  const handleNext = () => {
    if (canProceedFromStep(currentStep)) {
      setCurrentStep((prev) => Math.min(prev + 1, STEPS.length))
      setError(null)
    } else {
      setError("Please fill in all required fields before proceeding")
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  const getCurrentConfig = () => {
    if (formData.type === "gitlab_issues") return gitlabConfig
    if (formData.type === "github_issues") return githubConfig
    return jiraConfig
  }

  if (success) {
    return (
      <div className="mx-auto p-6 max-w-7xl">
        <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md hover:shadow-lg transition-all duration-300">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <div className="text-lg font-medium mb-2 bg-gradient-to-r from-green-600 to-green-700 bg-clip-text text-transparent uppercase tracking-wide">
                TASK SOURCE CREATED SUCCESSFULLY
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
          {/* Progress Steps */}
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {STEPS.map((step, index) => (
                <div key={step.id} className="flex items-center flex-1">
                  <div className="flex flex-col items-center flex-1">
                    <div
                      className={`w-10 h-10 flex items-center justify-center border-2 transition-all duration-200 ${
                        currentStep === step.id
                          ? "border-blue-500 bg-blue-500 text-white shadow-md scale-110"
                          : currentStep > step.id
                          ? "border-green-500 bg-green-500 text-white"
                          : "border-gray-300 bg-white text-gray-400"
                      }`}
                    >
                      {currentStep > step.id ? (
                        <Check className="w-5 h-5" />
                      ) : (
                        <span className="text-sm font-medium">{step.id}</span>
                      )}
                    </div>
                    <div className="mt-2 text-center">
                      <div
                        className={`text-xs uppercase tracking-wide font-medium ${
                          currentStep === step.id
                            ? "text-blue-500"
                            : currentStep > step.id
                            ? "text-green-500"
                            : "text-gray-400"
                        }`}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-gray-500">{step.description}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-24px] transition-all duration-200 ${
                        currentStep > step.id ? "bg-green-500" : "bg-gray-300"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-50/90 text-red-600 px-4 py-3 border border-red-200/60 backdrop-blur-sm text-sm">
                {error}
              </div>
            )}

            {/* Step 1: Basic Info */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
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
              </div>
            )}

            {/* Step 2: Source Type */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
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

                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                  <button
                    type="button"
                    onClick={() => handleInputChange("type", "gitlab_issues")}
                    className={`p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                      formData.type === "gitlab_issues"
                        ? "border-orange-500 bg-orange-50/50 shadow-md scale-[1.02]"
                        : "border-gray-200 bg-white/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium uppercase tracking-wide mb-2">GitLab</div>
                      <div className="text-xs text-gray-600">Issue tracking integration</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("type", "github_issues")}
                    className={`p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                      formData.type === "github_issues"
                        ? "border-purple-500 bg-purple-50/50 shadow-md scale-[1.02]"
                        : "border-gray-200 bg-white/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium uppercase tracking-wide mb-2">GitHub</div>
                      <div className="text-xs text-gray-600">Issue tracking integration</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("type", "jira")}
                    className={`p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                      formData.type === "jira"
                        ? "border-blue-500 bg-blue-50/50 shadow-md scale-[1.02]"
                        : "border-gray-200 bg-white/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium uppercase tracking-wide mb-2">Jira</div>
                      <div className="text-xs text-gray-600">Issue tracking integration</div>
                    </div>
                  </button>
                </div>
              </div>
            )}

            {/* Step 3: Configuration */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                {/* GitLab Issues Configuration */}
                {formData.type === "gitlab_issues" && (
                  <GitlabTaskSourceConfig
                    projectId={formData.project_id}
                    config={gitlabConfig}
                    onChange={(field, value) => handleGitlabConfigChange(field, value)}
                  />
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
              </div>
            )}

            {/* Step 4: Review */}
            {currentStep === 4 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="bg-gradient-to-br from-gray-50 to-white p-6 border border-gray-200/60 space-y-4">
                  <h3 className="text-xs uppercase tracking-wide font-medium border-b border-gray-200 pb-2">
                    TASK SOURCE DETAILS
                  </h3>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">NAME</div>
                      <div className="font-medium">{formData.name}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">TYPE</div>
                      <div className="font-medium">{formData.type.replace(/_/g, " ").toUpperCase()}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">STATUS</div>
                      <div className="font-medium">{formData.enabled ? "ENABLED" : "DISABLED"}</div>
                    </div>
                    <div>
                      <div className="text-xs uppercase tracking-wide text-gray-500">PROJECT ID</div>
                      <div className="font-mono text-sm">{formData.project_id.substring(0, 8)}...</div>
                    </div>
                  </div>

                  <div className="border-t border-gray-200 pt-4 mt-4">
                    <h4 className="text-xs uppercase tracking-wide font-medium mb-3">CONFIGURATION</h4>
                    <div className="bg-white/90 p-4 font-mono text-xs border border-gray-200/60">
                      <pre>{JSON.stringify(getCurrentConfig(), null, 2)}</pre>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-4 border-t border-gray-200">
              <Button
                type="button"
                onClick={handleBack}
                disabled={currentStep === 1}
                variant="outline"
                className="uppercase tracking-wide"
              >
                <ChevronLeft className="w-4 h-4 mr-1" />
                BACK
              </Button>

              {currentStep < STEPS.length ? (
                <Button
                  type="button"
                  onClick={handleNext}
                  disabled={!canProceedFromStep(currentStep)}
                  className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
                >
                  NEXT
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading}
                  className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
                >
                  {loading ? "CREATING..." : "CREATE TASK SOURCE"}
                  <Check className="w-4 h-4 ml-1" />
                </Button>
              )}

              <Button
                type="button"
                onClick={() => navigate("/task-sources")}
                variant="outline"
                className="uppercase tracking-wide ml-auto"
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
