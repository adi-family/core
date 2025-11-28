import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { PresenterTable } from "@/components/PresenterTable"
import { ProjectPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import { projectsStore, fetchProjects, toggleProjectEnabled } from "@/stores/projects"
import { designTokens } from "@/theme/tokens"
import type { Project } from "../../../types"
import { Folder } from "lucide-react"

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
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Folder className="h-8 w-8 text-white" />
          <h1 className={designTokens.text.mode}>Projects</h1>
        </div>
        <p className={designTokens.text.bodySecondary}>
          Manage all projects in the system
        </p>
      </div>

      {/* Content */}
      <div className={designTokens.cards.default}>
        <div className="p-6">
          <PresenterTable
            presenter={ProjectPresenter}
            items={projects as Project[]}
            loading={loading}
            emptyMessage="No projects found"
            buildPresenter={(project) =>
              new ProjectPresenter(project, handleToggleEnabled, togglingProjectId)
            }
          />
        </div>
      </div>
    </div>
  )
}
