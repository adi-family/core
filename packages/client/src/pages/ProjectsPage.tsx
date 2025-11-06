import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import { PageCard } from "@/components/PageCard"
import { PresenterTable } from "@/components/PresenterTable"
import { ProjectPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import { projectsStore, fetchProjects, toggleProjectEnabled } from "@/stores/projects"
import type { Project } from "../../../types"

export function ProjectsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { projects, loading } = useSnapshot(projectsStore)
  const [togglingProjectId, setTogglingProjectId] = useState<string | null>(null)

  useEffect(() => {
    fetchProjects(client)
  }, [client])

  const handleToggleEnabled = async (project: Project) => {
    setTogglingProjectId(project.id)

    try {
      await toggleProjectEnabled(client, project.id)
    } catch (error) {
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
