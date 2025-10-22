import {type FormEvent, useState, useMemo} from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { GitlabSecretAutocomplete } from "@/components/GitlabSecretAutocomplete"
import { createAuthenticatedClient } from "@/lib/client"
import type { CreateProjectInput, Secret } from "../../../types"

export function SetupProjectPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [formData, setFormData] = useState<CreateProjectInput>({
    name: "",
  })

  // Optional GitLab executor configuration
  const [configureExecutor, setConfigureExecutor] = useState(false)
  const [executorHost, setExecutorHost] = useState("https://gitlab.the-ihor.com")
  const [executorTokenSecretId, setExecutorTokenSecretId] = useState<string | null>(null)
  const [createdProjectId, setCreatedProjectId] = useState<string | null>(null)

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError(null)
    setLoading(true)

    try {
      const res = await client.projects.$post({
        json: formData,
      })

      if (!res.ok) {
        const errorText = await res.text()
        setError(`Failed to create project: ${errorText}`)
        setLoading(false)
        return
      }

      const project = await res.json()
      setCreatedProjectId(project.id)

      // If executor configuration is requested, configure it
      if (configureExecutor && executorHost && executorTokenSecretId) {
        try {
          const executorRes = await client.projects[":id"]["job-executor-gitlab"].$post({
            param: { id: project.id },
            json: { host: executorHost, access_token_secret_id: executorTokenSecretId },
          })

          if (!executorRes.ok) {
            const errorData = await executorRes.json()
            setError(`Project created but executor configuration failed: ${(errorData as { error?: string }).error || "Unknown error"}`)
            setLoading(false)
            return
          }
        } catch (execError) {
          setError(`Project created but executor configuration failed: ${execError instanceof Error ? execError.message : "Unknown error"}`)
          setLoading(false)
          return
        }
      }

      setSuccess(true)
      setLoading(false)

      setTimeout(() => {
        navigate("/projects")
      }, 1500)
    } catch {
      setError("Error creating project")
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
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-green-600 text-lg font-medium mb-2">
                Project created successfully!
              </div>
              <p className="text-muted-foreground">
                Redirecting to projects list...
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Setup New Project</CardTitle>
          <CardDescription>Create a new project in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label
                htmlFor="name"
                className="block text-sm font-medium mb-2"
              >
                Project Name
              </label>
              <input
                id="name"
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                className="w-full px-3 py-2 border rounded-md"
                required
              />
            </div>

            {/* Optional GitLab Executor Configuration */}
            <div className="border-t pt-6 mt-6">
              <div className="rounded-lg border border-gray-200 bg-white overflow-hidden">
                <div className="p-5 bg-gradient-to-r from-gray-50 to-white border-b">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center gap-3">
                        <input
                          id="configureExecutor"
                          type="checkbox"
                          checked={configureExecutor}
                          onChange={(e) => setConfigureExecutor(e.target.checked)}
                          className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary cursor-pointer"
                        />
                        <label htmlFor="configureExecutor" className="font-medium text-base cursor-pointer">
                          Custom GitLab Pipeline Executor
                        </label>
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-medium text-blue-700">
                          Optional
                        </span>
                      </div>
                      <p className="text-sm text-gray-600 mt-2 ml-8">
                        Configure a custom GitLab instance for AI pipeline execution. Recommended for GitLab Enterprise users.
                      </p>
                      {!configureExecutor && (
                        <p className="text-xs text-gray-500 mt-2 ml-8 flex items-center gap-1.5">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                          </svg>
                          If not configured, the default worker repository will be used
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                {configureExecutor && (
                  <div className="p-6 space-y-5 bg-gray-50/50">
                    <div className="bg-blue-50 border border-blue-100 rounded-lg p-4">
                      <div className="flex gap-3">
                        <svg className="w-5 h-5 text-blue-600 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                        </svg>
                        <div className="text-sm">
                          <p className="font-medium text-blue-900">Enterprise Configuration</p>
                          <p className="text-blue-700 mt-1">
                            This setup may take a few minutes to complete. You'll need a GitLab access token with API scope.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="bg-white rounded-lg border p-5 space-y-5">
                      <div>
                        <label
                          htmlFor="executorHost"
                          className="block text-sm font-medium text-gray-700 mb-2"
                        >
                          GitLab Host URL
                        </label>
                        <input
                          id="executorHost"
                          type="text"
                          value={executorHost}
                          onChange={(e) => setExecutorHost(e.target.value)}
                          className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-primary transition-colors"
                          placeholder="https://gitlab.your-company.com"
                          required={configureExecutor}
                        />
                        <p className="text-xs text-gray-500 mt-1.5">
                          Enter your GitLab instance URL (e.g., https://gitlab.com or your enterprise URL)
                        </p>
                      </div>

                      <GitlabSecretAutocomplete
                        projectId={createdProjectId || undefined}
                        host={executorHost}
                        value={executorTokenSecretId}
                        onChange={(secretId) => setExecutorTokenSecretId(secretId)}
                        onSecretCreated={(secret: Secret) => {
                          console.log("Secret created:", secret)
                          setExecutorTokenSecretId(secret.id)
                        }}
                        label="GitLab Access Token Secret"
                        required={configureExecutor}
                        requiredScopes={["api"]}
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2 pt-4">
              <button
                type="submit"
                disabled={loading}
                className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 disabled:opacity-50"
              >
                {loading ? "Creating..." : "Create Project"}
              </button>
              <button
                type="button"
                onClick={() => navigate("/projects")}
                className="px-4 py-2 border rounded hover:bg-accent"
              >
                Cancel
              </button>
            </div>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
