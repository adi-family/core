import {type FormEvent, useState, useMemo} from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Button } from '@adi-simple/ui/button'
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
      <div className="mx-auto">
        <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-green-600 font-medium">
                Project created
              </div>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-accent-teal to-accent-cyan text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">New Project</CardTitle>
          <CardDescription className="text-gray-300">Add a new project</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-destructive/15 text-destructive px-4 py-3 rounded">
                {error}
              </div>
            )}

            <div>
              <label htmlFor="name" className="block text-sm font-medium mb-1">
                Name
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

            <div className="pt-4 mt-4">
              <div className="flex items-center gap-2 mb-3">
                <input
                  id="configureExecutor"
                  type="checkbox"
                  checked={configureExecutor}
                  onChange={(e) => setConfigureExecutor(e.target.checked)}
                  className="w-4 h-4"
                />
                <label htmlFor="configureExecutor" className="text-sm font-medium cursor-pointer">
                  Custom GitLab Executor
                </label>
              </div>

              {configureExecutor && (
                <div className="ml-6 space-y-3 border-l-2 pl-4">
                  <div>
                    <label htmlFor="executorHost" className="block text-sm font-medium mb-1">
                      Host
                    </label>
                    <input
                      id="executorHost"
                      type="text"
                      value={executorHost}
                      onChange={(e) => setExecutorHost(e.target.value)}
                      className="w-full px-3 py-2 border rounded-md"
                      placeholder="https://gitlab.com"
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
                    label="Access Token"
                    required={configureExecutor}
                    requiredScopes={["api"]}
                  />
                </div>
              )}
            </div>

            <div className="flex gap-2 pt-4">
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
        </CardContent>
      </Card>
    </div>
  )
}
