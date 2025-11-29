import { type FormEvent, useState, useMemo, useCallback } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@adi-simple/ui/card'
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { GitlabRepositoryMultiSelect } from '@adi-simple/ui/gitlab-repository-multiselect'
import { JiraSecretAutocomplete } from '@adi-simple/ui/jira-secret-autocomplete'
import { GitHubOAuthButton } from '@adi-simple/ui/github-oauth-button'
import { GitLabIcon } from '@adi-simple/ui/gitlab-icon'
import { GitHubIcon } from '@adi-simple/ui/github-icon'
import { JiraIcon } from '@adi-simple/ui/jira-icon'
import { createAuthenticatedClient } from "@/lib/client"
import { createProjectConfig } from '@adi/api-contracts'
import { createTaskSourceConfig } from '@adi/api-contracts/task-sources'
import { createFileSpaceConfig } from '@adi/api-contracts/file-spaces'
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'
import { GitlabTaskSourceConfig } from "@/components/GitlabTaskSourceConfig"
import { useProject } from "@/contexts/ProjectContext"
import { refreshProjects } from "@/stores/projects"
import { Button, CardSelectButton, TextLinkButton } from "@/components/buttons"
import { ChevronRight, ChevronLeft, Check, FolderPlus, Database, Code, Rocket, PenLine, Layers } from "lucide-react"
import type { CreateProjectInput, CreateTaskSourceInput, CreateFileSpaceInput, GitlabFileSpaceConfig as GitlabFileSpaceConfigType } from "@adi-simple/types"

type TaskSourceType = 'gitlab_issues' | 'jira' | 'github_issues' | 'manual' | 'skip'
type FileSpaceType = 'gitlab' | 'github' | 'skip'

interface Step {
  id: number
  title: string
  description: string
  icon: typeof FolderPlus
}

const STEPS: Step[] = [
  { id: 1, title: "PROJECT", description: "Name your project", icon: FolderPlus },
  { id: 2, title: "TASK SOURCE", description: "Where tasks come from", icon: Database },
  { id: 3, title: "CODE SOURCE", description: "Where code lives", icon: Code },
]

interface GitlabIssuesConfig {
  repo: string
  labels: string[]
  host: string
  access_token_secret_id: string
}

interface JiraConfig {
  project_key: string
  jql_filter: string
  host: string
  access_token_secret_id: string
  cloud_id?: string
}

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : `http://localhost:${import.meta.env.VITE_SERVER_PORT || '5174'}`

export function SetupFlowPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { setSelectedProjectId } = useProject()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  // Project state
  const [projectName, setProjectName] = useState("")
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  // Task source state
  const [taskSourceType, setTaskSourceType] = useState<TaskSourceType | null>(null)
  const [gitlabTaskConfig, setGitlabTaskConfig] = useState<GitlabIssuesConfig>({
    repo: "",
    labels: ["DOIT"],
    host: DEFAULT_HOSTS.gitlab,
    access_token_secret_id: "",
  })
  const [jiraConfig, setJiraConfig] = useState<JiraConfig>({
    project_key: "",
    jql_filter: "",
    host: "",
    access_token_secret_id: "",
  })

  // File space state
  const [fileSpaceType, setFileSpaceType] = useState<FileSpaceType | null>(null)
  const [gitlabFileConfig, setGitlabFileConfig] = useState<GitlabFileSpaceConfigType>({
    repo: "",
    host: DEFAULT_HOSTS.gitlab,
    access_token_secret_id: "",
  })
  const [githubFileConfig, setGithubFileConfig] = useState({
    repo: "",
    host: DEFAULT_HOSTS.github,
    access_token_secret_id: "",
  })
  const [githubConnected, setGithubConnected] = useState(false)
  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([])

  const createProject = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const payload: CreateProjectInput = { name: projectName }
      const project = await client.run(createProjectConfig, { body: payload })
      setCreatedProjectId(project.id)
      setSelectedProjectId(project.id)
      await refreshProjects(client)
      return project.id
    } catch (err) {
      setError(`Failed to create project: ${err instanceof Error ? err.message : "Unknown error"}`)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client, projectName, setSelectedProjectId])

  const createTaskSource = useCallback(async (projectId: string) => {
    if (taskSourceType === 'skip' || !taskSourceType) return

    setLoading(true)
    setError(null)
    try {
      let payload: CreateTaskSourceInput
      if (taskSourceType === 'gitlab_issues') {
        payload = {
          project_id: projectId,
          name: `GitLab: ${gitlabTaskConfig.repo}`,
          type: 'gitlab_issues',
          config: gitlabTaskConfig,
          enabled: true,
          auto_evaluate: true,
        }
      } else if (taskSourceType === 'jira') {
        payload = {
          project_id: projectId,
          name: `Jira: ${jiraConfig.project_key || jiraConfig.host}`,
          type: 'jira',
          config: jiraConfig,
          enabled: true,
          auto_evaluate: true,
        }
      } else {
        return
      }

      await client.run(createTaskSourceConfig, { body: payload })
    } catch (err) {
      setError(`Failed to create task source: ${err instanceof Error ? err.message : "Unknown error"}`)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client, taskSourceType, gitlabTaskConfig, jiraConfig])

  const createFileSpace = useCallback(async (projectId: string) => {
    if (fileSpaceType === 'skip' || !fileSpaceType) return

    setLoading(true)
    setError(null)
    try {
      if (fileSpaceType === 'gitlab') {
        const promises = selectedRepositories.map(async (repo) => {
          const payload: CreateFileSpaceInput = {
            project_id: projectId,
            name: `GitLab: ${repo}`,
            type: 'gitlab',
            config: { ...gitlabFileConfig, repo },
            enabled: true,
          }
          return client.run(createFileSpaceConfig, { body: payload })
        })
        await Promise.all(promises)
      } else if (fileSpaceType === 'github') {
        const payload: CreateFileSpaceInput = {
          project_id: projectId,
          name: `GitHub: ${githubFileConfig.repo}`,
          type: 'github',
          config: githubFileConfig,
          enabled: true,
        }
        await client.run(createFileSpaceConfig, { body: payload })
      }
    } catch (err) {
      setError(`Failed to create file space: ${err instanceof Error ? err.message : "Unknown error"}`)
      throw err
    } finally {
      setLoading(false)
    }
  }, [client, fileSpaceType, gitlabFileConfig, githubFileConfig, selectedRepositories])

  const handleNext = async () => {
    setError(null)

    if (currentStep === 1) {
      if (!projectName.trim()) {
        setError("Please enter a project name")
        return
      }
      try {
        await createProject()
        setCurrentStep(2)
      } catch {
        // Error already set
      }
    } else if (currentStep === 2) {
      if (!taskSourceType) {
        setError("Please select a task source type or skip")
        return
      }
      // Manual and skip don't require task source creation
      if (taskSourceType !== 'skip' && taskSourceType !== 'manual') {
        if (taskSourceType === 'gitlab_issues' && (!gitlabTaskConfig.repo || !gitlabTaskConfig.access_token_secret_id)) {
          setError("Please complete the GitLab configuration")
          return
        }
        if (taskSourceType === 'jira' && (!jiraConfig.host || !jiraConfig.access_token_secret_id)) {
          setError("Please complete the Jira configuration")
          return
        }
        if (!createdProjectId) {
          setError("Project ID not found. Please go back and create a project first.")
          return
        }
        try {
          await createTaskSource(createdProjectId)
        } catch {
          return
        }
      }
      setCurrentStep(3)
    } else if (currentStep === 3) {
      if (!fileSpaceType) {
        setError("Please select a code source type or skip")
        return
      }
      if (fileSpaceType !== 'skip') {
        if (fileSpaceType === 'gitlab' && selectedRepositories.length === 0) {
          setError("Please select at least one repository")
          return
        }
        if (fileSpaceType === 'github' && !githubConnected) {
          setError("Please connect your GitHub account first")
          return
        }
        if (fileSpaceType === 'github' && !githubFileConfig.repo) {
          setError("Please enter a repository")
          return
        }
        if (!createdProjectId) {
          setError("Project ID not found. Please go back and create a project first.")
          return
        }
        try {
          await createFileSpace(createdProjectId)
        } catch {
          return
        }
      }
      setSuccess(true)
      setTimeout(() => navigate("/"), 1500)
    }
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  const handleSkipStep = () => {
    if (currentStep === 2) {
      setTaskSourceType('skip')
      setCurrentStep(3)
    } else if (currentStep === 3) {
      setFileSpaceType('skip')
      setSuccess(true)
      setTimeout(() => navigate("/"), 1500)
    }
  }

  const handleGitlabTaskConfigChange = (field: keyof GitlabIssuesConfig, value: string | string[]) => {
    setGitlabTaskConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleJiraConfigChange = (field: keyof JiraConfig, value: string) => {
    setJiraConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleGitlabFileConfigChange = (field: keyof GitlabFileSpaceConfigType, value: string) => {
    setGitlabFileConfig((prev) => ({ ...prev, [field]: value }))
  }

  const handleGithubFileConfigChange = (field: 'repo' | 'host' | 'access_token_secret_id', value: string) => {
    setGithubFileConfig((prev) => ({ ...prev, [field]: value }))
  }

  if (success) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
        <Card className="w-full max-w-2xl bg-neutral-800/50 border-neutral-700/50">
          <CardContent className="pt-6">
            <div className="text-center py-12">
              <div className="mx-auto w-20 h-20 bg-green-500/20 rounded-full flex items-center justify-center mb-6">
                <Rocket className="w-10 h-10 text-green-400" />
              </div>
              <h2 className="text-2xl font-bold text-white mb-2">You're All Set!</h2>
              <p className="text-neutral-400">
                Your project is ready. Redirecting to dashboard...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-neutral-900 flex items-center justify-center p-6">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Welcome to ADI</h1>
          <p className="text-neutral-400">Let's set up your first project</p>
        </div>

        <Card className="bg-neutral-800/50 border-neutral-700/50">
          <CardHeader>
            <CardTitle className="text-xl uppercase tracking-wide text-neutral-100">
              PROJECT SETUP
            </CardTitle>
            <CardDescription className="text-xs uppercase tracking-wide text-neutral-400">
              Step {currentStep} of {STEPS.length}
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
                        className={`w-12 h-12 flex items-center justify-center border-2 rounded-lg transition-all duration-200 ${
                          currentStep === step.id
                            ? "border-neutral-400 bg-neutral-600 text-white shadow-lg scale-110"
                            : currentStep > step.id
                            ? "border-green-500 bg-green-500/20 text-green-400"
                            : "border-neutral-600 bg-neutral-800 text-neutral-500"
                        }`}
                      >
                        {currentStep > step.id ? (
                          <Check className="w-6 h-6" />
                        ) : (
                          <step.icon className="w-5 h-5" />
                        )}
                      </div>
                      <div className="mt-2 text-center">
                        <div
                          className={`text-xs uppercase tracking-wide font-medium ${
                            currentStep === step.id
                              ? "text-white"
                              : currentStep > step.id
                              ? "text-green-400"
                              : "text-neutral-500"
                          }`}
                        >
                          {step.title}
                        </div>
                        <div className="text-xs text-neutral-500">{step.description}</div>
                      </div>
                    </div>
                    {index < STEPS.length - 1 && (
                      <div
                        className={`flex-1 h-0.5 mx-2 mt-[-24px] transition-all duration-200 ${
                          currentStep > step.id ? "bg-green-500" : "bg-neutral-700"
                        }`}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            <form onSubmit={(e: FormEvent) => { e.preventDefault(); handleNext() }} className="space-y-6">
              {error && (
                <div className="bg-red-500/10 border border-red-500/30 text-red-400 px-4 py-3 rounded-lg">
                  {error}
                </div>
              )}

              {/* Step 1: Project Name */}
              {currentStep === 1 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">Name Your Project</h3>
                    <p className="text-sm text-neutral-400">
                      Choose a name that describes your project or team
                    </p>
                  </div>

                  <div className="max-w-md mx-auto">
                    <Label htmlFor="projectName" className="text-sm font-medium text-neutral-200 mb-2 block">
                      Project Name
                    </Label>
                    <Input
                      id="projectName"
                      type="text"
                      value={projectName}
                      onChange={(e) => setProjectName(e.target.value)}
                      placeholder="e.g., My Awesome App"
                      className="text-lg"
                      autoFocus
                    />
                  </div>
                </div>
              )}

              {/* Step 2: Task Source */}
              {currentStep === 2 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">Where Do Your Tasks Come From?</h3>
                    <p className="text-sm text-neutral-400">
                      Connect your issue tracker to sync tasks automatically
                    </p>
                  </div>

                  {!taskSourceType || taskSourceType === 'skip' || taskSourceType === 'manual' ? (
                    <div className="flex flex-col gap-2 max-w-lg mx-auto">
                      <CardSelectButton
                        icon={PenLine}
                        title="Manual"
                        description="Create tasks directly on the platform"
                        onClick={() => {
                          setTaskSourceType('manual')
                          setCurrentStep(3)
                        }}
                      />

                      <CardSelectButton
                        icon={GitLabIcon}
                        title="GitLab"
                        description="Sync issues from GitLab"
                        onClick={() => setTaskSourceType('gitlab_issues')}
                      />

                      <CardSelectButton
                        icon={JiraIcon}
                        title="Jira"
                        description="Sync tickets from Jira"
                        onClick={() => setTaskSourceType('jira')}
                      />

                      <CardSelectButton
                        icon={GitHubIcon}
                        title="GitHub"
                        description="Sync issues from GitHub"
                        badge="Soon"
                        disabled
                      />

                      <CardSelectButton
                        icon={Layers}
                        title="Linear"
                        description="Sync issues from Linear"
                        badge="Soon"
                        disabled
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {taskSourceType === 'gitlab_issues' && <GitLabIcon className="w-5 h-5" />}
                          {taskSourceType === 'jira' && <JiraIcon className="w-5 h-5" />}
                          <span className="text-sm font-medium text-neutral-200 uppercase">
                            {taskSourceType === 'gitlab_issues' ? 'GitLab' : 'Jira'} Configuration
                          </span>
                        </div>
                        <TextLinkButton onClick={() => setTaskSourceType(null)}>
                          Change source
                        </TextLinkButton>
                      </div>

                      {taskSourceType === 'gitlab_issues' && (
                        <GitlabTaskSourceConfig
                          projectId={createdProjectId || ""}
                          config={gitlabTaskConfig}
                          onChange={(field, value) => handleGitlabTaskConfigChange(field, value)}
                        />
                      )}

                      {taskSourceType === 'jira' && (
                        <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 rounded-lg">
                          <div className="space-y-2">
                            <Label htmlFor="jira_host" className="text-xs uppercase tracking-wide text-neutral-200">
                              Host {jiraConfig.cloud_id && "(Auto-filled from OAuth)"}
                            </Label>
                            <Input
                              id="jira_host"
                              type="text"
                              value={jiraConfig.host}
                              onChange={(e) => handleJiraConfigChange("host", e.target.value)}
                              placeholder="e.g., https://your-domain.atlassian.net"
                              readOnly={!!jiraConfig.cloud_id}
                            />
                          </div>

                          <JiraSecretAutocomplete
                            client={client}
                            projectId={createdProjectId || ""}
                            host={jiraConfig.host}
                            value={jiraConfig.access_token_secret_id || null}
                            onChange={(secretId) => handleJiraConfigChange("access_token_secret_id", secretId || "")}
                            onCloudIdChange={(cloudId) => handleJiraConfigChange("cloud_id", cloudId)}
                            onSiteSelected={(siteUrl, cloudId) => {
                              handleJiraConfigChange("host", siteUrl)
                              handleJiraConfigChange("cloud_id", cloudId)
                            }}
                            label="Jira API Token"
                            required
                            enableOAuth
                            apiBaseUrl={API_URL}
                          />

                          <div className="space-y-2">
                            <Label htmlFor="jira_jql" className="text-xs uppercase tracking-wide text-neutral-200">
                              JQL Filter (Optional)
                            </Label>
                            <Input
                              id="jira_jql"
                              type="text"
                              value={jiraConfig.jql_filter}
                              onChange={(e) => handleJiraConfigChange("jql_filter", e.target.value)}
                              placeholder="e.g., project = MYPROJ AND resolution = Unresolved"
                            />
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Step 3: Code Source (File Space) */}
              {currentStep === 3 && (
                <div className="space-y-6 animate-fadeIn">
                  <div className="text-center mb-6">
                    <h3 className="text-xl font-semibold text-white mb-2">Where Does Your Code Live?</h3>
                    <p className="text-sm text-neutral-400">
                      Connect your repositories to enable code changes
                    </p>
                  </div>

                  {!fileSpaceType || fileSpaceType === 'skip' ? (
                    <div className="flex flex-col gap-2 max-w-lg mx-auto">
                      <CardSelectButton
                        icon={GitLabIcon}
                        title="GitLab"
                        description="Connect GitLab repositories"
                        onClick={() => setFileSpaceType('gitlab')}
                      />

                      <CardSelectButton
                        icon={GitHubIcon}
                        title="GitHub"
                        description="Connect GitHub repositories"
                        onClick={() => setFileSpaceType('github')}
                      />
                    </div>
                  ) : (
                    <div className="space-y-4">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                          {fileSpaceType === 'gitlab' && <GitLabIcon className="w-5 h-5" />}
                          {fileSpaceType === 'github' && <GitHubIcon className="w-5 h-5" />}
                          <span className="text-sm font-medium text-neutral-200 uppercase">
                            {fileSpaceType === 'gitlab' ? 'GitLab' : 'GitHub'} Configuration
                          </span>
                        </div>
                        <TextLinkButton onClick={() => setFileSpaceType(null)}>
                          Change source
                        </TextLinkButton>
                      </div>

                      {fileSpaceType === 'gitlab' && (
                        <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 rounded-lg">
                          <div className="space-y-2">
                            <div className="flex items-center justify-between">
                              <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide text-neutral-300">
                                GitLab Host
                              </Label>
                              {gitlabFileConfig.host === DEFAULT_HOSTS.gitlab && (
                                <TextLinkButton onClick={() => handleGitlabFileConfigChange("host", "")}>
                                  Customize GitLab URL
                                </TextLinkButton>
                              )}
                            </div>
                            <Input
                              id="gitlab_host"
                              type="text"
                              value={gitlabFileConfig.host}
                              onChange={(e) => handleGitlabFileConfigChange("host", e.target.value)}
                              disabled={gitlabFileConfig.host === DEFAULT_HOSTS.gitlab}
                              placeholder={DEFAULT_HOSTS.gitlab}
                            />
                          </div>

                          <GitlabSecretAutocomplete
                            client={client}
                            projectId={createdProjectId || undefined}
                            host={gitlabFileConfig.host || DEFAULT_HOSTS.gitlab}
                            value={gitlabFileConfig.access_token_secret_id || null}
                            onChange={(secretId) => handleGitlabFileConfigChange("access_token_secret_id", secretId || "")}
                            label={gitlabFileConfig.host === DEFAULT_HOSTS.gitlab
                              ? "GitLab Access Token (Optional - uses default if not set)"
                              : "GitLab Access Token (requires: api, write_repository scopes)"
                            }
                            requiredScopes={["api", "write_repository"]}
                            required={false}
                            apiBaseUrl={API_URL}
                          />

                          {gitlabFileConfig.access_token_secret_id && (
                            <GitlabRepositoryMultiSelect
                              client={client}
                              host={gitlabFileConfig.host || DEFAULT_HOSTS.gitlab}
                              secretId={gitlabFileConfig.access_token_secret_id || ""}
                              value={selectedRepositories}
                              onChange={setSelectedRepositories}
                              required
                            />
                          )}

                          {!gitlabFileConfig.access_token_secret_id && (
                            <div className="space-y-2">
                              <Label htmlFor="gitlab_repo" className="text-xs uppercase tracking-wide text-neutral-300">
                                Repository (format: owner/repo)
                              </Label>
                              <Input
                                id="gitlab_repo"
                                type="text"
                                value={selectedRepositories[0] || ""}
                                onChange={(e) => setSelectedRepositories(e.target.value ? [e.target.value] : [])}
                                placeholder="e.g., myorg/myrepo"
                              />
                            </div>
                          )}
                        </div>
                      )}

                      {fileSpaceType === 'github' && (
                        <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-700/30 rounded-lg">
                          {!githubConnected ? (
                            <div className="space-y-4">
                              <p className="text-sm text-neutral-400">
                                Connect your GitHub account to access your repositories
                              </p>
                              <GitHubOAuthButton
                                projectId={createdProjectId || ""}
                                client={client}
                                onSuccess={(result) => {
                                  handleGithubFileConfigChange("access_token_secret_id", result.secretId)
                                  setGithubConnected(true)
                                }}
                                onError={(error) => setError(error)}
                              />
                            </div>
                          ) : (
                            <>
                              <div className="flex items-center gap-2 text-sm text-green-400 mb-4">
                                <GitHubIcon className="w-4 h-4" />
                                <span>Connected to GitHub</span>
                              </div>

                              <div className="space-y-2">
                                <Label htmlFor="github_repo" className="text-xs uppercase tracking-wide text-neutral-300">
                                  Repository (format: owner/repo)
                                </Label>
                                <Input
                                  id="github_repo"
                                  type="text"
                                  value={githubFileConfig.repo}
                                  onChange={(e) => handleGithubFileConfigChange("repo", e.target.value)}
                                  placeholder="e.g., myorg/myrepo"
                                  required
                                />
                              </div>

                              <div className="space-y-2">
                                <div className="flex items-center justify-between">
                                  <Label htmlFor="github_host" className="text-xs uppercase tracking-wide text-neutral-300">
                                    GitHub Host (Optional)
                                  </Label>
                                  {githubFileConfig.host === DEFAULT_HOSTS.github && (
                                    <TextLinkButton onClick={() => handleGithubFileConfigChange("host", "")}>
                                      Use GitHub Enterprise
                                    </TextLinkButton>
                                  )}
                                </div>
                                <Input
                                  id="github_host"
                                  type="text"
                                  value={githubFileConfig.host}
                                  onChange={(e) => handleGithubFileConfigChange("host", e.target.value)}
                                  disabled={githubFileConfig.host === DEFAULT_HOSTS.github}
                                  placeholder={DEFAULT_HOSTS.github}
                                />
                              </div>
                            </>
                          )}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* Navigation Buttons */}
              <div className="flex gap-2 pt-6 border-t border-neutral-700/50">
                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleBack}
                    variant="outline"
                    disabled={loading}
                  >
                    <ChevronLeft className="w-4 h-4 mr-1" />
                    Back
                  </Button>
                )}

                {currentStep > 1 && (
                  <Button
                    type="button"
                    onClick={handleSkipStep}
                    variant="ghost"
                    disabled={loading}
                  >
                    Skip This Step
                  </Button>
                )}

                <div className="flex-1" />

                <Button
                  type="submit"
                  disabled={loading || (currentStep === 1 && !projectName.trim())}
                  className="bg-neutral-600 hover:bg-neutral-500"
                >
                  {loading ? (
                    "Processing..."
                  ) : currentStep === STEPS.length ? (
                    <>
                      Finish Setup
                      <Check className="w-4 h-4 ml-1" />
                    </>
                  ) : (
                    <>
                      Continue
                      <ChevronRight className="w-4 h-4 ml-1" />
                    </>
                  )}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
