import { useEffect, useState, useMemo } from "react"
import { useNavigate } from "react-router-dom"
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
import { client } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { toast } from "sonner"
import type { TaskSource, Project } from "../../../types"

export function TaskSourcesPage() {
  const navigate = useNavigate()
  const { selectedProjectId } = useProject()
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const [taskSourcesRes, projectsRes] = await Promise.all([
      client["task-sources"].$get({ query: {} }),
      client.projects.$get()
    ])

    if (!taskSourcesRes.ok) {
      console.error("Error fetching task sources:", await taskSourcesRes.text())
      setLoading(false)
      return
    }

    if (!projectsRes.ok) {
      console.error("Error fetching projects:", await projectsRes.text())
      setLoading(false)
      return
    }

    const taskSourcesData = await taskSourcesRes.json()
    const projectsData = await projectsRes.json()

    setTaskSources(taskSourcesData)
    setProjects(projectsData)
    setLoading(false)
  }

  useEffect(() => {
    fetchData().catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [])

  const handleSync = async (taskSource: TaskSource) => {
    try {
      const res = await client["task-sources"][":id"].sync.$post({
        param: { id: taskSource.id }
      })

      if (!res.ok) {
        const error = await res.text()
        toast.error(`Failed to sync: ${error}`)
        return
      }

      toast.success(`Sync started for ${taskSource.name}`)
      // Refresh data after sync
      await fetchData()
    } catch (error) {
      console.error("Error syncing task source:", error)
      toast.error("Failed to start sync")
    }
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
