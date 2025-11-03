import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
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
import { listTaskSourcesConfig, listProjectsConfig } from "@adi/api-contracts"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import type { TaskSource, Project } from "../../../types"

export function TaskSourcesPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [taskSourcesData, projectsData] = await Promise.all([
        client.run(listTaskSourcesConfig, { query: {} }),
        client.run(listProjectsConfig)
      ])

      setTaskSources(taskSourcesData)
      setProjects(projectsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData().catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [])

  const handleSync = async (taskSource: TaskSource) => {
    // TODO: Sync endpoint not yet migrated to @adi-family/http contracts
    // Need to add syncTaskSourceConfig to @adi/api-contracts/task-sources.ts
    toast.error("Sync endpoint not yet implemented")
    console.warn("Sync endpoint needs migration to @adi-family/http", taskSource)

    // Original implementation (commented out until contract is added):
    // try {
    //   await client.run(syncTaskSourceConfig, { params: { id: taskSource.id } })
    //   toast.success(`Sync started for ${taskSource.name}`)
    //   await fetchData()
    // } catch (error) {
    //   console.error("Error syncing task source:", error)
    //   toast.error("Failed to start sync")
    // }
  }

  // Filter task sources by selected project
  const filteredTaskSources = useMemo(() => {
    if (!selectedProjectId) {
      return taskSources
    }
    return taskSources.filter(ts => ts.project_id === selectedProjectId)
  }, [taskSources, selectedProjectId])

  return (
    <AnimatedPageContainer>
      <Card className={`bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:shadow-blue-500/10 hover:border-slate-600/60 ${designTokens.animations.hover} ${designTokens.animations.fadeIn} rounded-2xl`}>
        <CardHeader className={`bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`}>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className={`${designTokens.text.cardTitle} text-white`}>
                Task Sources
              </CardTitle>
              <CardDescription className={`${designTokens.text.cardDescription} text-gray-200`}>
                Manage issue tracking integrations for projects
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate("/create-task-source")}
              className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              Create Task Source
            </Button>
          </div>
        </CardHeader>
        <CardContent className={`${designTokens.spacing.cardPadding} text-gray-100`}>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">Loading task sources...</div>
            </div>
          ) : filteredTaskSources.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">No task sources found</div>
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
        </CardContent>
      </Card>
    </AnimatedPageContainer>
  )
}
