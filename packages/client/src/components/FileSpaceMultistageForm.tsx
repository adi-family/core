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
import { GitLabIcon } from '@adi-simple/ui/gitlab-icon'
import { GitHubIcon } from '@adi-simple/ui/github-icon'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { GitlabRepositoryMultiSelect } from '@adi-simple/ui/gitlab-repository-multiselect'
import { createAuthenticatedClient } from "@/lib/client"
import type { CreateFileSpaceInput, GitlabFileSpaceConfig as GitlabFileSpaceConfigType, GithubFileSpaceConfig } from "../../../types"
import { ChevronRight, ChevronLeft, Check } from "lucide-react"
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'
import { createFileSpaceConfig } from '@adi/api-contracts/file-spaces'
import { Button, CardSelectButton, TextLinkButton } from './buttons'

type FileSpaceType = 'gitlab' | 'github'

interface Step {
  id: number
  title: string
  description: string
}

const STEPS: Step[] = [
  { id: 1, title: "PROJECT", description: "Select project" },
  { id: 2, title: "TYPE", description: "Choose repository type" },
  { id: 3, title: "CONFIGURATION", description: "Repository settings" },
]

const API_URL = import.meta.env.VITE_API_URL
  ? import.meta.env.VITE_API_URL
  : `http://localhost:${import.meta.env.VITE_SERVER_PORT || '5174'}`

export function FileSpaceMultistageForm() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [currentStep, setCurrentStep] = useState(1)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState<{
    project_id: string
    name: string
    type: FileSpaceType | ""
    enabled: boolean
    default_branch: string
  }>({
    project_id: "",
    name: "",
    type: "",
    enabled: true,
    default_branch: "",
  })

  const [gitlabConfig, setGitlabConfig] = useState<GitlabFileSpaceConfigType>({
    repo: "",
    host: DEFAULT_HOSTS.gitlab,
    access_token_secret_id: "",
  })

  const [selectedRepositories, setSelectedRepositories] = useState<string[]>([])

  const [githubConfig, setGithubConfig] = useState<GithubFileSpaceConfig>({
    repo: "",
    host: DEFAULT_HOSTS.github,
    access_token_secret_id: "",
  })

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)

    // Add timeout to ensure all state updates are complete before submission
    setTimeout(async () => {
      setLoading(true)

      try {
        if (formData.type === "gitlab") {
          // Create multiple file spaces for each selected repository
          const promises = selectedRepositories.map(async (repo) => {
            const fileSpaceName = formData.name || `GitLab: ${repo}`
            const payload: CreateFileSpaceInput = {
              project_id: formData.project_id,
              name: fileSpaceName,
              type: 'gitlab',
              config: {
                ...gitlabConfig,
                repo,
              },
              enabled: formData.enabled,
              ...(formData.default_branch && { default_branch: formData.default_branch }),
            }

            return client.run(createFileSpaceConfig, {
              body: payload,
            })
          })

          await Promise.all(promises)
        } else if (formData.type === "github") {
          // GitHub single repository creation
          const fileSpaceName = formData.name || `GitHub: ${githubConfig.repo}`
          const payload: CreateFileSpaceInput = {
            project_id: formData.project_id,
            name: fileSpaceName,
            type: 'github',
            config: githubConfig,
            enabled: formData.enabled,
            ...(formData.default_branch && { default_branch: formData.default_branch }),
          }

          await client.run(createFileSpaceConfig, {
            body: payload,
          })
        }

        setSuccess(true)
        setLoading(false)

        setTimeout(() => {
          navigate("/file-spaces")
        }, 1500)
      } catch {
        setError("Error creating file space")
        setLoading(false)
      }
    }, 100)
  }

  const handleInputChange = (field: string, value: string | boolean) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
    // Clear error when user makes changes
    if (error) {
      setError(null)
    }
  }

  const handleGitlabConfigChange = (field: keyof GitlabFileSpaceConfigType, value: string) => {
    setGitlabConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const handleGithubConfigChange = (field: keyof GithubFileSpaceConfig, value: string) => {
    setGithubConfig((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  const canProceedFromStep = (step: number): boolean => {
    switch (step) {
      case 1:
        return formData.project_id !== ""
      case 2:
        return formData.type !== ""
      case 3:
        if (formData.type === "gitlab") {
          return selectedRepositories.length > 0
        } else if (formData.type === "github") {
          return githubConfig.repo !== ""
        }
        return false
      default:
        return true
    }
  }

  const handleNext = () => {
    // Add a small delay to ensure state updates are complete
    setTimeout(() => {
      if (canProceedFromStep(currentStep)) {
        const nextStep = Math.min(currentStep + 1, STEPS.length)
        setCurrentStep(nextStep)
        setError(null)
      } else {
        if (currentStep === 1 && !formData.project_id) {
          setError("Please select a project before proceeding")
        } else if (currentStep === 3) {
          if (formData.type === "gitlab" && selectedRepositories.length === 0) {
            setError("Please select at least one repository")
          } else if (formData.type === "github" && !githubConfig.repo) {
            setError("Please enter a repository")
          } else {
            setError("Please fill in all required fields before proceeding")
          }
        } else {
          setError("Please fill in all required fields before proceeding")
        }
      }
    }, 100)
  }

  const handleBack = () => {
    setCurrentStep((prev) => Math.max(prev - 1, 1))
    setError(null)
  }

  if (success) {
    return (
      <div className="mx-auto p-6 max-w-7xl">
        <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50 shadow-2xl hover:shadow-neutral-500/10 hover:border-neutral-600/60 transition-all duration-300 rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="mx-auto w-16 h-16 bg-neutral-500 rounded-xl flex items-center justify-center mb-4">
                <Check className="w-10 h-10 text-white" />
              </div>
              <div className="text-lg font-medium mb-2 text-neutral-300 uppercase tracking-wide">
                {selectedRepositories.length > 1
                  ? `${selectedRepositories.length} FILE SPACES CREATED SUCCESSFULLY`
                  : 'FILE SPACE CREATED SUCCESSFULLY'
                }
              </div>
              <p className="text-neutral-400 text-xs uppercase tracking-wide">
                Redirecting to file spaces list...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card className="bg-neutral-800/40 backdrop-blur-xl border border-neutral-700/50 shadow-2xl rounded-2xl">
        <CardHeader className="bg-neutral-600 text-white rounded-t-2xl">
          <CardTitle className="text-xl uppercase tracking-wide text-white">
            CREATE FILE SPACE
          </CardTitle>
          <CardDescription className="text-xs uppercase tracking-wide text-neutral-200">
            Configure a new repository file space
          </CardDescription>
        </CardHeader>
        <CardContent className="pt-8">
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
                          : "border-neutral-600 bg-neutral-800 text-neutral-400"
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
                        currentStep > step.id ? "bg-neutral-400" : "bg-neutral-700"
                      }`}
                    />
                  )}
                </div>
              ))}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {error && (
              <div className="bg-neutral-900/20 text-neutral-400 px-4 py-3 rounded-lg border border-neutral-700/50 backdrop-blur-sm text-sm">
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
                    // Auto-advance to next step after project selection
                    setTimeout(() => {
                      setCurrentStep(2)
                      setError(null)
                    }, 300)
                  }}
                  required
                />
              </div>
            )}

            {/* Step 2: Type */}
            {currentStep === 2 && (
              <div className="space-y-6 animate-fadeIn">
                <div className="space-y-1 mb-4">
                  <div className="text-xs uppercase tracking-wide text-neutral-300 font-medium">REPOSITORY TYPE</div>
                  <p className="text-xs text-neutral-400">Select your repository provider</p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <CardSelectButton
                    icon={formData.type === "gitlab" ? Check : GitLabIcon}
                    title="GitLab"
                    description="Connect your GitLab repositories"
                    selected={formData.type === "gitlab"}
                    onClick={() => {
                      handleInputChange("type", "gitlab")
                      setTimeout(() => {
                        setCurrentStep(3)
                        setError(null)
                      }, 300)
                    }}
                  />

                  <CardSelectButton
                    icon={GitHubIcon}
                    title="GitHub"
                    description="Available in future release"
                    badge="Soon"
                    disabled
                  />
                </div>
              </div>
            )}

            {/* Step 3: Configuration */}
            {currentStep === 3 && (
              <div className="space-y-6 animate-fadeIn">
                {/* GitLab Configuration */}
                {formData.type === "gitlab" && (
                  <div className="space-y-4 p-4 rounded-xl border border-neutral-700/60 bg-neutral-900/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-300">GITLAB FILE SPACE CONFIGURATION</h3>

                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide text-neutral-300">
                          GITLAB HOST
                        </Label>
                        {gitlabConfig.host === DEFAULT_HOSTS.gitlab && (
                          <TextLinkButton onClick={() => handleGitlabConfigChange("host", "")}>
                            Customize GitLab URL
                          </TextLinkButton>
                        )}
                      </div>
                      <Input
                        id="gitlab_host"
                        type="text"
                        value={gitlabConfig.host}
                        onChange={(e) => handleGitlabConfigChange("host", e.target.value)}
                        disabled={gitlabConfig.host === DEFAULT_HOSTS.gitlab}
                        className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed"
                        placeholder={DEFAULT_HOSTS.gitlab}
                      />
                    </div>

                    <GitlabSecretAutocomplete
                      client={client}
                      projectId={formData.project_id || undefined}
                      host={gitlabConfig.host || DEFAULT_HOSTS.gitlab}
                      value={gitlabConfig.access_token_secret_id || null}
                      onChange={(secretId) => {
                        handleGitlabConfigChange("access_token_secret_id", secretId || "")
                      }}
                      label={gitlabConfig.host === DEFAULT_HOSTS.gitlab ? "GITLAB ACCESS TOKEN (OPTIONAL - uses default if not set)" : "GITLAB ACCESS TOKEN (requires: api, write_repository scopes)"}
                      requiredScopes={["api", "write_repository"]}
                      required={false}
                      apiBaseUrl={API_URL}
                    />

                    {gitlabConfig.access_token_secret_id && (
                      <GitlabRepositoryMultiSelect
                        client={client}
                        host={gitlabConfig.host || DEFAULT_HOSTS.gitlab}
                        secretId={gitlabConfig.access_token_secret_id || ""}
                        value={selectedRepositories}
                        onChange={setSelectedRepositories}
                        required={true}
                      />
                    )}

                    {!gitlabConfig.access_token_secret_id && (
                      <div className="space-y-2">
                        <Label htmlFor="gitlab_repo" className="text-xs uppercase tracking-wide text-neutral-300">
                          REPOSITORY (format: owner/repo)
                        </Label>
                        <Input
                          id="gitlab_repo"
                          type="text"
                          value={selectedRepositories[0] || ""}
                          onChange={(e) => setSelectedRepositories(e.target.value ? [e.target.value] : [])}
                          className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                          placeholder="e.g., myorg/myrepo"
                          required
                        />
                      </div>
                    )}

                    <div className="space-y-2">
                      <Label htmlFor="default_branch" className="text-xs uppercase tracking-wide text-neutral-300">
                        DEFAULT BRANCH FOR MERGE REQUESTS (OPTIONAL)
                      </Label>
                      <Input
                        id="default_branch"
                        type="text"
                        value={formData.default_branch}
                        onChange={(e) => handleInputChange("default_branch", e.target.value)}
                        className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                        placeholder="e.g., main, master, develop (leave empty for repo default)"
                      />
                      <p className="text-xs text-neutral-400">
                        If not set, the repository's default branch will be used
                      </p>
                    </div>
                  </div>
                )}

                {/* GitHub Configuration */}
                {formData.type === "github" && (
                  <div className="space-y-4 p-4 rounded-xl border border-neutral-700/60 bg-neutral-900/30 backdrop-blur-sm">
                    <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-300">GITHUB CONFIGURATION</h3>

                    <div className="space-y-2">
                      <Label htmlFor="github_repo" className="text-xs uppercase tracking-wide text-neutral-300">
                        REPOSITORY
                      </Label>
                      <Input
                        id="github_repo"
                        type="text"
                        value={githubConfig.repo}
                        onChange={(e) => handleGithubConfigChange("repo", e.target.value)}
                        className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                        required
                        placeholder="e.g., owner/repo"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="github_host" className="text-xs uppercase tracking-wide text-neutral-300">
                        HOST (OPTIONAL)
                      </Label>
                      <Input
                        id="github_host"
                        type="text"
                        value={githubConfig.host || ""}
                        onChange={(e) => handleGithubConfigChange("host", e.target.value)}
                        className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                        placeholder="https://github.com"
                      />
                    </div>

                    <div className="space-y-2">
                      <Label htmlFor="default_branch" className="text-xs uppercase tracking-wide text-neutral-300">
                        DEFAULT BRANCH FOR MERGE REQUESTS (OPTIONAL)
                      </Label>
                      <Input
                        id="default_branch"
                        type="text"
                        value={formData.default_branch}
                        onChange={(e) => handleInputChange("default_branch", e.target.value)}
                        className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
                        placeholder="e.g., main, master, develop (leave empty for repo default)"
                      />
                      <p className="text-xs text-neutral-400">
                        If not set, the repository's default branch will be used
                      </p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Navigation Buttons */}
            <div className="flex gap-2 pt-4 border-t border-neutral-700">
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
                  {loading
                    ? "CREATING..."
                    : formData.type === "gitlab" && selectedRepositories.length > 1
                    ? `CREATE ${selectedRepositories.length} FILE SPACES`
                    : "CREATE FILE SPACE"
                  }
                  <Check className="w-4 h-4 ml-1" />
                </Button>
              )}

              <Button
                type="button"
                onClick={() => navigate("/file-spaces")}
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
