import { type FormEvent, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { Button } from '@adi-simple/ui/button'
import { Select } from '@adi-simple/ui/select'
import { ProjectSelect } from '@adi-simple/ui/project-select'
import { SecretSelect } from "@/components/SecretSelect"
import { GitlabTaskSourceConfig } from "@/components/GitlabTaskSourceConfig"
import { JiraSecretAutocomplete } from '@adi-simple/ui/jira-secret-autocomplete'
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
  { id: 1, title: "PROJECT", description: "Select project" },
  { id: 2, title: "SOURCE TYPE", description: "Choose integration" },
  { id: 3, title: "CONFIGURATION", description: "Source settings" },
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

    // Auto-generate name if not set
    let taskSourceName = formData.name
    if (!taskSourceName) {
      if (formData.type === "gitlab_issues") {
        taskSourceName = `GitLab: ${gitlabConfig.repo}`
      } else if (formData.type === "github_issues") {
        taskSourceName = `GitHub: ${githubConfig.repo}`
      } else {
        taskSourceName = `Jira: ${jiraConfig.project_key}`
      }
    }

    try {
      let payload: CreateTaskSourceInput
      if (formData.type === "gitlab_issues") {
        payload = {
          project_id: formData.project_id,
          name: taskSourceName,
          type: formData.type,
          config: gitlabConfig,
          enabled: formData.enabled,
        }
      } else if (formData.type === "github_issues") {
        payload = {
          project_id: formData.project_id,
          name: taskSourceName,
          type: formData.type,
          config: githubConfig,
          enabled: formData.enabled,
        }
      } else {
        payload = {
          project_id: formData.project_id,
          name: taskSourceName,
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
        return formData.project_id !== ""
      case 2:
        return true
      case 3:
        if (formData.type === "gitlab_issues") {
          return gitlabConfig.repo !== "" && gitlabConfig.access_token_secret_id !== ""
        } else if (formData.type === "github_issues") {
          return githubConfig.repo !== ""
        } else {
          return jiraConfig.host !== "" && jiraConfig.project_key !== "" && jiraConfig.access_token_secret_id !== ""
        }
      default:
        return true
    }
  }

  const handleNext = () => {
    if (canProceedFromStep(currentStep)) {
      const nextStep = Math.min(currentStep + 1, STEPS.length)
      setCurrentStep(nextStep)
      setError(null)
    } else {
      setError("Please fill in all required fields before proceeding")
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  if (success) {
    return (
      <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-green-500 to-green-600 flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-white" />
            </div>
            <div className="text-lg font-medium mb-2 text-green-400 uppercase tracking-wide">
              TASK SOURCE CREATED SUCCESSFULLY
            </div>
            <p className="text-gray-400 text-xs uppercase tracking-wide">
              Redirecting to task sources list...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-slate-700/50 bg-slate-800/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle className="text-xl uppercase tracking-wide text-gray-100">
          CREATE TASK SOURCE
        </CardTitle>
        <CardDescription className="text-xs uppercase tracking-wide text-gray-400">
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
                          : "border-slate-600 bg-slate-700 text-gray-400"
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
                      <div className="text-xs text-gray-400">{step.description}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-24px] transition-all duration-200 ${
                        currentStep > step.id ? "bg-green-500" : "bg-slate-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg backdrop-blur-sm">
                {error}
              </div>
            )}

            {/* Step 1: Project Selection */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <ProjectSelect
                  client={client}
                  value={formData.project_id}
                  onChange={(projectId) => handleInputChange("project_id", projectId)}
                  required
                />
              </div>
            )}

            {/* Step 2: Source Type */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-2">
                  <Label htmlFor="type" className="text-xs uppercase tracking-wide text-gray-200">
                    TYPE
                  </Label>
                  <Select
                    id="type"
                    value={formData.type}
                    onChange={(e) => handleInputChange("type", e.target.value as TaskSourceType)}
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
                        ? "border-orange-500 bg-orange-500/20 shadow-md scale-[1.02]"
                        : "border-slate-600 bg-slate-700/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium uppercase tracking-wide mb-2 text-gray-100">GitLab</div>
                      <div className="text-xs text-gray-400">Issue tracking integration</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("type", "github_issues")}
                    className={`p-6 border-2 transition-all duration-200 hover:shadow-lg opacity-60 cursor-not-allowed ${
                      formData.type === "github_issues"
                        ? "border-purple-500 bg-purple-500/20 shadow-md scale-[1.02]"
                        : "border-slate-600 bg-slate-700/30"
                    }`}
                    disabled
                  >
                    <div className="text-center">
                      <div className="flex items-center justify-center gap-2 mb-2">
                        <div className="text-lg font-medium uppercase tracking-wide text-gray-100">GitHub</div>
                        <span className="text-xs font-medium px-2 py-1 bg-amber-500/20 text-amber-400 rounded uppercase tracking-wide">
                          Private Beta
                        </span>
                      </div>
                      <div className="text-xs text-gray-500">Available only in private beta</div>
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleInputChange("type", "jira")}
                    className={`p-6 border-2 transition-all duration-200 hover:shadow-lg ${
                      formData.type === "jira"
                        ? "border-blue-500 bg-blue-500/20 shadow-md scale-[1.02]"
                        : "border-slate-600 bg-slate-700/50"
                    }`}
                  >
                    <div className="text-center">
                      <div className="text-lg font-medium uppercase tracking-wide mb-2 text-gray-100">Jira</div>
                      <div className="text-xs text-gray-400">Issue tracking integration</div>
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
                  <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-700/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-gray-200">GITHUB CONFIGURATION</h3>

                    <div className="space-y-2">
                      <Label htmlFor="github_repo" className="text-xs uppercase tracking-wide text-gray-200">
                        REPOSITORY
                      </Label>
                      <Input
                        id="github_repo"
                        type="text"
                        value={githubConfig.repo}
                        onChange={(e) => handleGithubConfigChange("repo", e.target.value)}
                        required
                        placeholder="e.g., owner/repo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github_host" className="text-xs uppercase tracking-wide text-gray-200">
                        HOST (OPTIONAL)
                      </Label>
                      <Input
                        id="github_host"
                        type="text"
                        value={githubConfig.host || ""}
                        onChange={(e) => handleGithubConfigChange("host", e.target.value)}
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
                  <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-700/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-gray-200">JIRA CONFIGURATION</h3>

                    <div className="space-y-2">
                      <Label htmlFor="jira_host" className="text-xs uppercase tracking-wide text-gray-200">
                        HOST
                      </Label>
                      <Input
                        id="jira_host"
                        type="text"
                        value={jiraConfig.host}
                        onChange={(e) => handleJiraConfigChange("host", e.target.value)}
                        required
                        placeholder="e.g., https://your-domain.atlassian.net"
                      />
                    </div>

                    <JiraSecretAutocomplete
                      client={client}
                      projectId={formData.project_id}
                      host={jiraConfig.host}
                      value={jiraConfig.access_token_secret_id || null}
                      onChange={(secretId) => {
                        handleJiraConfigChange("access_token_secret_id", secretId || "")
                      }}
                      label="JIRA API TOKEN (REQUIRED)"
                      required={true}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="jira_project_key" className="text-xs uppercase tracking-wide text-gray-200">
                        PROJECT KEY
                      </Label>
                      <Input
                        id="jira_project_key"
                        type="text"
                        value={jiraConfig.project_key}
                        onChange={(e) => handleJiraConfigChange("project_key", e.target.value)}
                        required
                        placeholder="e.g., PROJ"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="jira_jql_filter" className="text-xs uppercase tracking-wide text-gray-200">
                        JQL FILTER (OPTIONAL)
                      </Label>
                      <Input
                        id="jira_jql_filter"
                        type="text"
                        value={jiraConfig.jql_filter || ""}
                        onChange={(e) => handleJiraConfigChange("jql_filter", e.target.value)}
                        placeholder="e.g., labels = DOIT AND status != Done"
                      />
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-4 border-t border-slate-700/50">
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
                  disabled={loading || !canProceedFromStep(currentStep)}
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
  )
}
