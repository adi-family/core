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
import { ProjectSelect } from '@adi-simple/ui/project-select'
import { SecretSelect } from "@/components/SecretSelect"
import { GitlabTaskSourceConfig } from "@/components/GitlabTaskSourceConfig"
import { JiraSecretAutocomplete } from '@adi-simple/ui/jira-secret-autocomplete'
import { GitLabIcon } from '@adi-simple/ui/gitlab-icon'
import { GitHubIcon } from '@adi-simple/ui/github-icon'
import { JiraIcon } from '@adi-simple/ui/jira-icon'
import { createAuthenticatedClient } from "@/lib/client"
import type { CreateTaskSourceInput } from "../../../types"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'
import { Button, LargeCardSelectButton } from './buttons'

type TaskSourceType = 'gitlab_issues' | 'jira' | 'github_issues'

interface GitlabIssuesConfig {
  repo: string
  labels: string[]
  host?: string
  access_token_secret_id?: string
}

interface GithubIssuesConfig {
  repo: string
  labels?: string[]
  host?: string
  access_token_secret_id?: string
}

interface JiraConfig {
  project_key?: string
  jql_filter?: string
  host: string
  access_token_secret_id?: string
  cloud_id?: string
}

interface Step {
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
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState({
    project_id: "",
    name: "",
    type: "gitlab_issues" as TaskSourceType,
    enabled: true,
    auto_evaluate: true,
  })

  const [gitlabConfig, setGitlabConfig] = useState<GitlabIssuesConfig>({
    repo: "",
    labels: ["DOIT"],
    host: DEFAULT_HOSTS.gitlab,
    access_token_secret_id: "",
  })

  const [githubConfig, setGithubConfig] = useState<GithubIssuesConfig>({
    repo: "",
    labels: [],
    host: DEFAULT_HOSTS.github,
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
          type: 'gitlab_issues',
          config: gitlabConfig,
          enabled: formData.enabled,
          auto_evaluate: formData.auto_evaluate,
        }
      } else if (formData.type === "github_issues") {
        payload = {
          project_id: formData.project_id,
          name: taskSourceName,
          type: 'github_issues',
          config: githubConfig,
          enabled: formData.enabled,
          auto_evaluate: formData.auto_evaluate,
        }
      } else {
        payload = {
          project_id: formData.project_id,
          name: taskSourceName,
          type: 'jira',
          config: jiraConfig,
          enabled: formData.enabled,
          auto_evaluate: formData.auto_evaluate,
        }
      }

      const { createTaskSourceConfig } = await import('@adi/api-contracts/task-sources')
      await client.run(createTaskSourceConfig, {
        body: payload,
      })

      setSuccess(true)
      setLoading(false)

      setTimeout(() => {
        navigate("/file-spaces")
      }, 1500)
    } catch (error) {
      console.error("Error creating task source:", error)
      setError(`Error creating task source: ${error instanceof Error ? error.message : 'Unknown error'}`)
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

  const canProceedFromStep = (step: number, overrideProjectId?: string): boolean => {
    switch (step) {
      case 1: {
        const projectId = overrideProjectId ?? formData.project_id
        return projectId !== ""
      }
      case 2:
        return true
      case 3:
        if (formData.type === "gitlab_issues") {
          return gitlabConfig.repo !== "" && gitlabConfig.access_token_secret_id !== ""
        } else if (formData.type === "github_issues") {
          return githubConfig.repo !== ""
        } else {
          return jiraConfig.host !== "" && jiraConfig.access_token_secret_id !== ""
        }
      default:
        return true
    }
  }

  const handleNext = (overrideProjectId?: string) => {
    if (canProceedFromStep(currentStep, overrideProjectId)) {
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
      <Card className="border-neutral-700/50 bg-neutral-800/50 backdrop-blur-sm shadow-md hover:shadow-lg transition-all duration-300">
        <CardContent className="pt-6">
          <div className="text-center py-8">
            <div className="mx-auto w-16 h-16 bg-gradient-to-br from-neutral-400 to-neutral-500 flex items-center justify-center mb-4">
              <Check className="w-10 h-10 text-white" />
            </div>
            <div className="text-lg font-medium mb-2 text-neutral-300 uppercase tracking-wide">
              TASK SOURCE CREATED SUCCESSFULLY
            </div>
            <p className="text-neutral-400 text-xs uppercase tracking-wide">
              Redirecting to task sources list...
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="border-neutral-700/50 bg-neutral-800/50 backdrop-blur-sm shadow-md">
      <CardHeader>
        <CardTitle className="text-xl uppercase tracking-wide text-neutral-100">
          CREATE TASK SOURCE
        </CardTitle>
        <CardDescription className="text-xs uppercase tracking-wide text-neutral-400">
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
                          ? "border-neutral-500 bg-neutral-500 text-white shadow-md scale-110"
                          : currentStep > step.id
                          ? "border-neutral-400 bg-neutral-400 text-white"
                          : "border-neutral-600 bg-neutral-700 text-neutral-400"
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
                            ? "text-neutral-500"
                            : currentStep > step.id
                            ? "text-neutral-300"
                            : "text-neutral-400"
                        }`}
                      >
                        {step.title}
                      </div>
                      <div className="text-xs text-neutral-400">{step.description}</div>
                    </div>
                  </div>
                  {index < STEPS.length - 1 && (
                    <div
                      className={`flex-1 h-0.5 mx-2 mt-[-24px] transition-all duration-200 ${
                        currentStep > step.id ? "bg-neutral-400" : "bg-neutral-600"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-neutral-700/10 border border-neutral-700/30 text-neutral-400 px-4 py-3 rounded-lg backdrop-blur-sm">
                {error}
              </div>
            )}

            {/* Step 1: Project Selection */}
            {currentStep === 1 && (
              <div className="space-y-6 animate-fadeIn">
                <ProjectSelect
                  client={client}
                  value={formData.project_id}
                  onChange={(projectId) => {
                    handleInputChange("project_id", projectId)
                    // Auto-advance to next step after selecting project
                    // Pass projectId directly since state hasn't updated yet
                    setTimeout(() => handleNext(projectId), 100)
                  }}
                  required
                />
              </div>
            )}

            {/* Step 2: Source Type */}
            {currentStep === 2 && (
              <div className="space-y-8 animate-fadeIn">
                <div className="text-center space-y-2">
                  <h3 className="text-2xl font-bold text-neutral-100">Choose Your Integration</h3>
                  <p className="text-sm text-neutral-400">Select a platform to sync your tasks and issues</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <LargeCardSelectButton
                    icon={GitLabIcon}
                    title="GitLab"
                    description="Sync issues and merge requests from GitLab repositories"
                    onClick={() => {
                      handleInputChange("type", "gitlab_issues")
                      handleNext()
                    }}
                  />

                  <LargeCardSelectButton
                    icon={GitHubIcon}
                    title="GitHub"
                    description="Sync issues and pull requests from GitHub repositories"
                    badge="Beta"
                    disabled
                  />

                  <LargeCardSelectButton
                    icon={JiraIcon}
                    title="Jira"
                    description="Sync tickets and epics from Jira projects"
                    onClick={() => {
                      handleInputChange("type", "jira")
                      handleNext()
                    }}
                  />
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
                  <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-200">GITHUB CONFIGURATION</h3>

                    <div className="space-y-2">
                      <Label htmlFor="github_repo" className="text-xs uppercase tracking-wide text-neutral-200">
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
                      <Label htmlFor="github_host" className="text-xs uppercase tracking-wide text-neutral-200">
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
                      client={client}
                      required={false}
                    />
                  </div>
                )}

                {/* Jira Configuration */}
                {formData.type === "jira" && (
                  <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-200">JIRA CONFIGURATION</h3>

                    <div className="space-y-2">
                      <Label htmlFor="jira_host" className="text-xs uppercase tracking-wide text-neutral-200">
                        HOST {jiraConfig.cloud_id && "(AUTO-FILLED FROM OAUTH)"}
                      </Label>
                      <Input
                        id="jira_host"
                        type="text"
                        value={jiraConfig.host}
                        onChange={(e) => handleJiraConfigChange("host", e.target.value)}
                        required
                        placeholder="e.g., https://your-domain.atlassian.net"
                        readOnly={!!jiraConfig.cloud_id}
                        className={jiraConfig.cloud_id ? "bg-neutral-700/50 cursor-not-allowed" : ""}
                      />
                      {jiraConfig.cloud_id && (
                        <p className="text-xs text-neutral-400">
                          ✓ Host auto-filled from selected Jira site via OAuth
                        </p>
                      )}
                    </div>

                    <JiraSecretAutocomplete
                      client={client}
                      projectId={formData.project_id}
                      host={jiraConfig.host}
                      value={jiraConfig.access_token_secret_id || null}
                      onChange={(secretId) => {
                        handleJiraConfigChange("access_token_secret_id", secretId || "")
                      }}
                      onCloudIdChange={(cloudId) => {
                        handleJiraConfigChange("cloud_id", cloudId)
                      }}
                      onSiteSelected={(siteUrl, cloudId) => {
                        handleJiraConfigChange("host", siteUrl)
                        handleJiraConfigChange("cloud_id", cloudId)
                      }}
                      label="JIRA API TOKEN (REQUIRED)"
                      required={true}
                      enableOAuth={true}
                      apiBaseUrl={API_BASE_URL}
                    />

                    <div className="space-y-2">
                      <Label htmlFor="jira_jql_filter" className="text-xs uppercase tracking-wide text-neutral-200">
                        JQL FILTER (OPTIONAL)
                      </Label>
                      <Input
                        id="jira_jql_filter"
                        type="text"
                        value={jiraConfig.jql_filter || ""}
                        onChange={(e) => handleJiraConfigChange("jql_filter", e.target.value)}
                        placeholder="e.g., project = MYPROJ AND resolution = Unresolved"
                      />
                      <p className="text-xs text-neutral-400">
                        Custom JQL query. Leave empty to use default: "resolution = Unresolved"
                      </p>
                    </div>
                  </div>
                )}

                {/* Auto-evaluate setting - common for all source types */}
                <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 backdrop-blur-sm rounded-lg">
                  <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-200">EVALUATION SETTINGS</h3>

                  <div className="flex items-start space-x-3">
                    <input
                      type="checkbox"
                      id="auto_evaluate"
                      checked={formData.auto_evaluate}
                      onChange={(e) => handleInputChange("auto_evaluate", e.target.checked)}
                      className="mt-1 h-4 w-4 rounded border-neutral-600 bg-neutral-700 text-neutral-500 focus:ring-neutral-500 focus:ring-offset-neutral-800"
                    />
                    <div className="flex-1">
                      <Label htmlFor="auto_evaluate" className="text-sm font-medium text-neutral-200 cursor-pointer">
                        Automatically evaluate new tasks with AI
                      </Label>
                      <p className="text-xs text-neutral-400 mt-1">
                        When enabled, tasks synced from this source will automatically be queued for AI evaluation.
                        Disable this to manually control evaluation and reduce AI costs for high-volume sources.
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-4 border-t border-neutral-700/50">
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
                  onClick={() => handleNext()}
                  disabled={!canProceedFromStep(currentStep)}
                  className="bg-neutral-600 hover:bg-neutral-500 text-white uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
                >
                  NEXT
                  <ChevronRight className="w-4 h-4 ml-1" />
                </Button>
              ) : (
                <Button
                  type="submit"
                  disabled={loading || !canProceedFromStep(currentStep)}
                  className="bg-neutral-600 hover:bg-neutral-500 text-white uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
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
