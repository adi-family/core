import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { Button } from '@adi-simple/ui/button'
import { TaskSourceRow } from "@/components/TaskSourceRow"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import type { TaskSource } from "../../../types"
import {
  projectsStore,
  fetchProjects,
  taskSourcesStore,
  fetchTaskSources,
  getTaskSourcesByProject,
  syncTaskSource
} from "@/stores"
import { ListChecks } from "lucide-react"

export function TaskSourcesPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { taskSources, loading } = useSnapshot(taskSourcesStore)
  const { projects } = useSnapshot(projectsStore)

  useEffect(() => {
    const fetchData = async () => {
      try {
        await Promise.all([
          fetchTaskSources(client, { force: true }),
          fetchProjects(client)
        ])
      } catch (error) {
        console.error('Error fetching data:', error)
        toast.error('Failed to load data')
      }
    }
    fetchData()
  }, [client])

  const handleSync = async (taskSource: TaskSource) => {
    try {
      await syncTaskSource(client, taskSource.id)
      toast.success(`Sync started for ${taskSource.name}`)
    } catch (error) {
      console.error("Error syncing task source:", error)
      toast.error("Failed to start sync")
    }
  }

  // Filter task sources by selected project
  const filteredTaskSources = useMemo(() =>
    getTaskSourcesByProject(selectedProjectId), [selectedProjectId, taskSources]
  )

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3 mb-2">
              <ListChecks className="h-8 w-8 text-white" />
              <h1 className={designTokens.text.mode}>Task Sources</h1>
            </div>
            <p className={designTokens.text.bodySecondary}>
              Manage issue tracking integrations for projects
            </p>
          </div>
          <Button
            onClick={() => navigate("/create-task-source")}
            className={designTokens.buttons.primary}
          >
            Create Task Source
          </Button>
        </div>
      </div>

      {/* Content */}
      <div className={designTokens.cards.default}>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className={designTokens.text.bodySecondary}>Loading task sources...</div>
            </div>
          ) : filteredTaskSources.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-12 gap-4">
              <div className={designTokens.text.bodySecondary}>No task sources found</div>
              {selectedProjectId && taskSources.length > 0 && (
                <div className={designTokens.text.caption}>
                  {taskSources.length} task source(s) available in other projects
                </div>
              )}
              {taskSources.length === 0 && (
                <div className={designTokens.text.caption}>
                  Click "Create Task Source" to add your first integration
                </div>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTaskSources.map((taskSource) => {
                const project = projects.find((p) => p.id === taskSource.project_id)
                return (
                  <TaskSourceRow
                    key={taskSource.id}
                    taskSource={taskSource}
                    project={project}
                    onSync={handleSync}
                  />
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
