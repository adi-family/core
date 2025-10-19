import {type FormEvent, useState} from "react"
import { useNavigate } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { client } from "@/lib/client"
import type { CreateProjectInput } from "../../../types"

export function SetupProjectPage() {
  const navigate = useNavigate()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const [formData, setFormData] = useState<CreateProjectInput>({
    name: "",
    enabled: true,
  })

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
