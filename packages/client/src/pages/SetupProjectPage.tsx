import { type FormEvent, useState, useMemo, useEffect } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import { PageCard } from "@/components/PageCard"
import { Button } from '@adi-simple/ui/button'
import { Input } from '@adi-simple/ui/input'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { createAuthenticatedClient } from "@/lib/client"
import { useExpertMode } from "@/contexts/ExpertModeContext"
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'
import { createProjectConfig, createProjectGitLabExecutorConfig } from '@adi/api-contracts'
import type { CreateProjectInput, Secret } from "@adi-simple/types"

export function SetupProjectPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const { expertMode } = useExpertMode()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [formData, setFormData] = useState<CreateProjectInput>({
    name: "",
  })

  // Optional GitLab executor configuration
  const [configureExecutor, setConfigureExecutor] = useState(false)
  const [executorHost, setExecutorHost] = useState<string>(DEFAULT_HOSTS.gitlab)
  const [executorHostUnlocked, setExecutorHostUnlocked] = useState(false)
  const [executorTokenSecretId, setExecutorTokenSecretId] = useState<string | null>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  // Automatically disable executor configuration when expert mode is turned off
  useEffect(() => {
    if (!expertMode && configureExecutor) {
      setConfigureExecutor(false)
    }
  }, [expertMode, configureExecutor])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const project = await client.run(createProjectConfig, { body: formData })
      setCreatedProjectId(project.id)

      // If executor configuration is requested, configure it
      if (configureExecutor && executorHost && executorTokenSecretId) {
        try {
          await client.run(createProjectGitLabExecutorConfig, {
            params: { id: project.id },
            body: { host: executorHost, access_token_secret_id: executorTokenSecretId },
          })
        } catch (execError) {
          setError(`Project created but executor configuration failed: ${execError instanceof Error ? execError.message : "Unknown error"}`)
          setLoading(false)
          return
        }
      }

      setSuccess(true)
      setLoading(false)
      navigate(`/create-task-source`)
    } catch (err) {
      setError(`Error creating project: ${err instanceof Error ? err.message : "Unknown error"}`)
      setLoading(false)
    }
  }

  const handleInputChange = (
    field: keyof CreateProjectInput,
    value: string | boolean | unknown
  ) => {
    setFormData((prev) => ({
      ...prev,
      [field]: value,
    }))
  }

  if (success) {
    return (
      <AnimatedPageContainer>
        <PageCard title="Success" description="Your project has been created">
          <div className="text-center py-8">
            <div className="text-neutral-300 font-medium text-lg">
              Project created successfully
            </div>
          </div>
        </PageCard>
      </AnimatedPageContainer>
    )
  }

  return (
    <AnimatedPageContainer>
      <PageCard
        title="New Project"
        description="Add a new project"
      >
        <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-neutral-700/10 border border-neutral-700/30 text-neutral-500 px-4 py-3 rounded-lg backdrop-blur-sm">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-2 text-neutral-200">
                Name
              </label>
              <Input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                required
              />
            </div>

            <div className="pt-4 mt-4 border-t border-neutral-700/50">
              <div className="flex items-center gap-2 mb-1 pt-4">
                <input
                  id="configureExecutor"
                  type="checkbox"
                  checked={configureExecutor}
                  onChange={(e) => setConfigureExecutor(e.target.checked)}
                  disabled={!expertMode}
                  className="w-4 h-4 rounded border-neutral-600 bg-neutral-700 text-neutral-500 focus:ring-neutral-500 focus:ring-offset-neutral-900 disabled:opacity-50 disabled:cursor-not-allowed"
                />
                <label htmlFor="configureExecutor" className={`text-sm font-medium ${expertMode ? 'cursor-pointer' : 'cursor-not-allowed'} text-neutral-200`}>
                  Custom pipeline executor
                </label>
              </div>
              {!expertMode && (
                <p className="text-xs text-neutral-500 ml-6 mb-2">
                  Available only in expert mode
                </p>
              )}

              {configureExecutor && (
                <div className="ml-6 space-y-3 border-l-2 border-neutral-500/30 pl-4">
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <label htmlFor="executorHost" className="block text-sm font-medium text-neutral-200">
                        Host
                      </label>
                      {!executorHostUnlocked && (
                        <button
                          type="button"
                          onClick={() => setExecutorHostUnlocked(true)}
                          className="text-xs text-neutral-400 hover:text-neutral-300 hover:underline"
                        >
                          Customize GitLab URL
                        </button>
                      )}
                    </div>
                    <Input
                      id="executorHost"
                      type="text"
                      value={executorHost}
                      onChange={(e) => setExecutorHost(e.target.value)}
                      disabled={!executorHostUnlocked}
                      placeholder={DEFAULT_HOSTS.gitlab}
                      required={configureExecutor}
                      className="disabled:opacity-60 disabled:cursor-not-allowed"
                    />
                  </div>

                  <GitlabSecretAutocomplete
                    client={client}
                    projectId={createdProjectId || undefined}
                    host={executorHost}
                    value={executorTokenSecretId}
                    onChange={(secretId) => setExecutorTokenSecretId(secretId)}
                    onSecretCreated={(secret: Secret) => {
                      console.log("Secret created:", secret)
                      setExecutorTokenSecretId(secret.id)
                    }}
                    label="Access Token"
                    required={configureExecutor}
                    requiredScopes={["api"]}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-6 border-t border-neutral-700/50 mt-6">
              <Button
                type="submit"
                disabled={loading}
              >
                {loading ? "Creating..." : "Create"}
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={() => navigate("/projects")}
              >
                Cancel
              </Button>
            </div>
          </form>
      </PageCard>
    </AnimatedPageContainer>
  )
}
