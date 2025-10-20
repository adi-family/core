import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { createAuthenticatedClient } from "@/lib/client"
import type { Project } from "../../../types"
import { GitlabConfiguration } from "@/components/GitlabConfiguration"

type TabType = "overview" | "task-sources" | "configuration"

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<TabType>("overview")

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
    // eslint-disable-next-line react-hooks/exhaustive-deps
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

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "task-sources", label: "TASK SOURCES" },
    { id: "configuration", label: "SOURCE SETTINGS" },
  ]

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

      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md">
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="text-xl uppercase tracking-wide bg-gradient-to-r from-gray-800 to-gray-900 bg-clip-text text-transparent">
                {project.name}
              </CardTitle>
              <CardDescription className="text-xs uppercase tracking-wide">
                Project Management
              </CardDescription>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleToggleEnabled}
                className={`px-4 py-2 text-sm font-medium uppercase tracking-wide transition-all duration-200 shadow-sm active:scale-95 ${
                  project.enabled
                    ? "bg-yellow-100/80 text-yellow-800 hover:bg-yellow-200/80"
                    : "bg-green-100/80 text-green-800 hover:bg-green-200/80"
                }`}
              >
                {project.enabled ? "Disable" : "Enable"}
              </button>
              <button
                onClick={handleDelete}
                className="px-4 py-2 bg-red-500/90 text-white text-sm font-medium uppercase tracking-wide hover:bg-red-600/90 shadow-sm active:scale-95 transition-all duration-200"
              >
                Delete
              </button>
            </div>
          </div>
        </CardHeader>

        {/* Tabs */}
        <div className="border-b border-gray-200/80 px-6">
          <div className="flex gap-4">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-3 text-xs uppercase tracking-wide font-medium transition-all duration-200 border-b-2 ${
                  activeTab === tab.id
                    ? "border-blue-500 text-blue-500"
                    : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="p-6">
          {activeTab === "overview" && (
            <div className="space-y-6">
              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  ID
                </label>
                <p className="text-lg font-mono mt-1">{project.id}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  Name
                </label>
                <p className="text-lg mt-1">{project.name}</p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  Status
                </label>
                <div className="mt-1">
                  <span
                    className={`inline-flex items-center px-3 py-1 text-sm font-medium uppercase tracking-wide backdrop-blur-sm ${
                      project.enabled
                        ? "bg-green-100/80 text-green-800 border border-green-200/60"
                        : "bg-gray-100/80 text-gray-800 border border-gray-200/60"
                    }`}
                  >
                    {project.enabled ? "Enabled" : "Disabled"}
                  </span>
                </div>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  Created At
                </label>
                <p className="text-lg mt-1">
                  {new Date(project.created_at).toLocaleString()}
                </p>
              </div>

              <div>
                <label className="text-xs uppercase tracking-wide text-gray-500">
                  Updated At
                </label>
                <p className="text-lg mt-1">
                  {new Date(project.updated_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          {activeTab === "task-sources" && (
            <div className="text-center py-8 text-gray-500">
              <p className="text-xs uppercase tracking-wide">Task sources management coming soon</p>
            </div>
          )}

          {activeTab === "configuration" && (
            <GitlabConfiguration projectId={project.id} />
          )}
        </CardContent>
      </Card>
    </div>
  )
}
