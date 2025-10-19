import { useEffect, useState } from "react"
import { useParams, useNavigate } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { client } from "@/lib/client"
import type { Project } from "../../../types"

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) {
        setError("No project ID provided")
        setLoading(false)
        return
      }

      try {
        const res = await client.projects[":id"].$get({
          param: { id },
        })

        if (!res.ok) {
          const errorData = await res.json()
          setError(errorData.error || "Failed to fetch project")
          setLoading(false)
          return
        }

        const data = await res.json()
        setProject(data)
        setLoading(false)
      } catch {
        setError("Error fetching project")
        setLoading(false)
      }
    }

    fetchProject()
  }, [id])

  const handleDelete = async () => {
    if (!id || !confirm("Are you sure you want to delete this project?")) {
      return
    }

    try {
      const res = await client.projects[":id"].$delete({
        param: { id },
      })

      if (!res.ok) {
        alert("Failed to delete project")
        return
      }

      navigate("/projects")
    } catch {
      alert("Error deleting project")
    }
  }

  const handleToggleEnabled = async () => {
    if (!id || !project) return

    try {
      const res = await client.projects[":id"].$put({
        param: { id },
        json: { enabled: !project.enabled },
      })

      if (!res.ok) {
        alert("Failed to update project")
        return
      }

      const updatedProject = await res.json()
      setProject(updatedProject)
    } catch {
      alert("Error updating project")
    }
  }

  if (loading) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4">Loading...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4 text-destructive">{error}</div>
            <div className="text-center pt-4">
              <button
                onClick={() => navigate("/projects")}
                className="px-4 py-2 border rounded hover:bg-accent"
              >
                Back to Projects
              </button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (!project) {
    return (
      <div className="container mx-auto py-10">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4">Project not found</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="container mx-auto py-10">
      <div className="mb-4">
        <button
          onClick={() => navigate("/projects")}
          className="text-sm text-muted-foreground hover:text-foreground"
        >
          ← Back to Projects
        </button>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{project.name}</CardTitle>
              <CardDescription>Project Details</CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggleEnabled}
                className={`px-4 py-2 rounded text-sm font-medium ${
                  project.enabled
                    ? "bg-yellow-100 text-yellow-800 hover:bg-yellow-200"
                    : "bg-green-100 text-green-800 hover:bg-green-200"
                }`}
              >
                {project.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-destructive text-destructive-foreground rounded text-sm font-medium hover:bg-destructive/90"
              >
                Delete
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <label className="text-sm font-medium text-muted-foreground">
              ID
            </label>
            <p className="text-lg font-mono">{project.id}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Name
            </label>
            <p className="text-lg">{project.name}</p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Status
            </label>
            <div className="mt-1">
              <span
                className={`inline-flex items-center rounded-full px-3 py-1 text-sm font-medium ring-1 ring-inset ${
                  project.enabled
                    ? "bg-green-100 text-green-800 ring-green-500/10"
                    : "bg-gray-100 text-gray-800 ring-gray-500/10"
                }`}
              >
                {project.enabled ? "Enabled" : "Disabled"}
              </span>
            </div>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Created At
            </label>
            <p className="text-lg">
              {new Date(project.created_at).toLocaleString()}
            </p>
          </div>

          <div>
            <label className="text-sm font-medium text-muted-foreground">
              Updated At
            </label>
            <p className="text-lg">
              {new Date(project.updated_at).toLocaleString()}
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
