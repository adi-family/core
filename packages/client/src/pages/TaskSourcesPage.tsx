import { useEffect, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
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
    <AnimatedPageContainer>
      <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default} rounded-lg`}>
        <CardHeader className={`${designTokens.spacing.cardHeader} ${designTokens.borders.bottom}`}>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className={designTokens.text.h2}>
                Task Sources
              </CardTitle>
              <CardDescription className={`${designTokens.text.bodySecondary} mt-1`}>
                Manage issue tracking integrations for projects
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate("/create-task-source")}
              className={`${designTokens.colors.accent.primary} hover:${designTokens.colors.accent.hover} ${designTokens.colors.text.primary} px-4 py-2 rounded-lg transition-colors`}
            >
              Create Task Source
            </Button>
          </div>
        </CardHeader>
        <CardContent className={designTokens.spacing.cardPadding}>
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
            <div className={designTokens.spacing.section}>
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
        </CardContent>
      </Card>
    </AnimatedPageContainer>
  )
}
