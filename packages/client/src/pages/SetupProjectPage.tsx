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
            <div className="border-t pt-4 mt-4">
              <div className="flex items-center space-x-2 mb-4">
                <input
                  id="configureExecutor"
                  type="checkbox"
                  checked={configureExecutor}
                  onChange={(e) => setConfigureExecutor(e.target.checked)}
                  className="w-4 h-4 rounded border-gray-300"
                />
                <label htmlFor="configureExecutor" className="text-sm font-medium">
                  Configure Custom GitLab Pipeline Executor (Optional)
                </label>
              </div>
              <p className="text-xs text-muted-foreground ml-6">
                Useful for GitLab Enterprise users. Configuration may require additional time.
              </p>

              {configureExecutor && (
                <div className="space-y-4 p-4 bg-gray-50 rounded border mt-4">
                  <p className="text-xs text-muted-foreground">
                    Configure a custom GitLab instance for pipeline execution. If not set, the project will use the default worker repository executor.
                  </p>
                  <div>
                    <label
                      htmlFor="executorHost"
                      className="block text-sm font-medium mb-2"
                    >
                      GitLab Host
                    </label>
                    <input
                      id="executorHost"
                      type="text"
                      value={executorHost}
                      onChange={(e) => setExecutorHost(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="https://gitlab.the-ihor.com"
                      required={configureExecutor}
                    />
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
              )}
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
