import { useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { client } from "@/lib/client"
import type { CreateProjectInput } from "../../../backend/types"

export function SetupProjectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState<CreateProjectInput>({
    name: "",
    type: "parent",
    config: {},
    enabled: true,
  })

  const handleSubmit = async (e: React.FormEvent) => {
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

            <div>
              <label
                htmlFor="type"
                className="block text-sm font-medium mb-2"
              >
                Project Type
              </label>
              <select
                id="type"
                value={formData.type}
                onChange={(e) =>
                  handleInputChange(
                    "type",
                    e.target.value as "gitlab" | "jira" | "parent"
                  )
                }
                className="w-full px-3 py-2 border rounded-md"
              >
                <option value="parent">Parent</option>
                <option value="gitlab">GitLab</option>
                <option value="jira">Jira</option>
              </select>
            </div>

            <div>
              <label
                htmlFor="config"
                className="block text-sm font-medium mb-2"
              >
                Configuration (JSON)
              </label>
              <textarea
                id="config"
                value={JSON.stringify(formData.config, null, 2)}
                onChange={(e) => {
                  try {
                    const config = JSON.parse(e.target.value)
                    handleInputChange("config", config)
                  } catch {
                    // Invalid JSON, don't update
                  }
                }}
                className="w-full px-3 py-2 border rounded-md font-mono text-sm min-h-[120px]"
              />
            </div>

            <div className="flex items-center space-x-2">
              <input
                id="enabled"
                type="checkbox"
                checked={formData.enabled}
                onChange={(e) => handleInputChange("enabled", e.target.checked)}
                className="w-4 h-4 rounded border-gray-300"
              />
              <label htmlFor="enabled" className="text-sm font-medium">
                Enabled
              </label>
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
