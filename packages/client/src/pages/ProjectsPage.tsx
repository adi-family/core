import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import { PageCard } from "@/components/PageCard"
import { PresenterTable } from "@/components/PresenterTable"
import { ProjectPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import { listProjectsConfig, updateProjectConfig } from "@adi/api-contracts"
import type { Project } from "../../../types"

export function ProjectsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const data = await client.run(listProjectsConfig)
        setProjects(data)
      } catch (error) {
        console.error("Error fetching projects:", error)
      } finally {
        setLoading(false)
      }
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
      await client.run(updateProjectConfig, {
        params: { id: project.id },
        body: { enabled: !project.enabled },
      })
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
    <AnimatedPageContainer>
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
    </AnimatedPageContainer>
  )
}
