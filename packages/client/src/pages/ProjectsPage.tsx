import { useEffect, useState } from "react"
import { PageCard } from "@/components/PageCard"
import { PresenterTable } from "@/components/PresenterTable"
import { ProjectPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Project } from "../../../types"

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      const res = await client.projects.$get()
      if (!res.ok) {
        console.error("Error fetching projects:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setProjects(data)
      setLoading(false)
    }

    fetchProjects().catch((error) => {
      console.error("Error fetching projects:", error)
      setLoading(false)
    })
  }, [])

  const handleToggleEnabled = async (project: Project) => {
    setTogglingProjectId(project.id)

    // Optimistic update
    setProjects((prev) =>
      prev.map((p) =>
        p.id === project.id ? { ...p, enabled: !p.enabled } : p
      )
    )

    try {
      const res = await client.projects[":id"].$patch({
        param: { id: project.id },
        json: { enabled: !project.enabled },
      })

      if (!res.ok) {
        // Revert on error
        setProjects((prev) =>
          prev.map((p) =>
            p.id === project.id ? { ...p, enabled: project.enabled } : p
          )
        )
        console.error("Error toggling project:", await res.text())
      }
    } catch (error) {
      // Revert on error
      setProjects((prev) =>
        prev.map((p) =>
          p.id === project.id ? { ...p, enabled: project.enabled } : p
        )
      )
      console.error("Error toggling project:", error)
    } finally {
      setTogglingProjectId(null)
    }
  }

  return (
    <div className="mx-auto">
      <PageCard
        title="Projects"
        description="Manage all projects in the system"
      >
        <PresenterTable
          presenter={ProjectPresenter}
          items={projects}
          loading={loading}
          emptyMessage="No projects found"
          buildPresenter={(project) =>
            new ProjectPresenter(project, handleToggleEnabled, togglingProjectId)
          }
        />
      </PageCard>
    </div>
  )
}
