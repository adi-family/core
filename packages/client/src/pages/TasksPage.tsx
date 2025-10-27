import { useEffect, useState } from "react"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Select } from '@adi-simple/ui/select'
import { Label } from '@adi-simple/ui/label'
import { TaskRow } from "@/components/TaskRow"
import { client } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { navigateTo } from "@/utils/navigation"
import { useProject } from "@/contexts/ProjectContext"
import { getComputedMetrics } from '@adi-simple/shared/task-scoring'
import type { Task, TaskSource, Project } from "../../../types"

type SortOption = 'created_desc' | 'created_asc' | 'quick_win_desc' | 'quick_win_asc' | 'complexity_asc' | 'complexity_desc'

export function TasksPage() {
  const { selectedProjectId } = useProject()
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskSourceId, setSelectedTaskSourceId] = useState<string>("")
  const [sortBy, setSortBy] = useState<SortOption>('quick_win_desc')
  const [filterEvaluated, setFilterEvaluated] = useState<boolean>(false)

  const fetchData = async () => {
    setLoading(true)
    const [tasksRes, taskSourcesRes, projectsRes] = await Promise.all([
      client.tasks.$get(),
      client["task-sources"].$get({
        query: {}
      }),
      client.projects.$get()
    ])

    if (!tasksRes.ok) {
      console.error("Error fetching tasks:", await tasksRes.text())
      setLoading(false)
      return
    }

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

    const tasksData = await tasksRes.json()
    const taskSourcesData = await taskSourcesRes.json()
    const projectsData = await projectsRes.json()

    if (!Array.isArray(tasksData)) {
      console.error("Invalid API response: expected array of tasks")
      setLoading(false)
      return
    }

    setTasks(tasksData)
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

  // Reset task source filter when project changes
  useEffect(() => {
    setSelectedTaskSourceId("")
  }, [selectedProjectId])

  // Filter task sources by selected project
  const projectTaskSources = selectedProjectId
    ? taskSources.filter(ts => ts.project_id === selectedProjectId)
    : taskSources

  // Filter tasks by selected project and optionally by task source
  let filteredTasks = tasks.filter(task => {
    // Filter by project
    if (selectedProjectId && task.project_id !== selectedProjectId) {
      return false
    }
    // Filter by task source if selected
    if (selectedTaskSourceId && task.task_source_id !== selectedTaskSourceId) {
      return false
    }
    // Filter by evaluated status
    if (filterEvaluated && !task.ai_evaluation_simple_result) {
      return false
    }
    return true
  })

  // Sort tasks
  filteredTasks = [...filteredTasks].sort((a, b) => {
    if (sortBy === 'created_desc') {
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    }
    if (sortBy === 'created_asc') {
      return new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    }
    if (sortBy === 'quick_win_desc' || sortBy === 'quick_win_asc') {
      const aMetrics = a.ai_evaluation_simple_result ? getComputedMetrics(a.ai_evaluation_simple_result) : null
      const bMetrics = b.ai_evaluation_simple_result ? getComputedMetrics(b.ai_evaluation_simple_result) : null
      const aScore = aMetrics?.quick_win_score ?? -1
      const bScore = bMetrics?.quick_win_score ?? -1
      return sortBy === 'quick_win_desc' ? bScore - aScore : aScore - bScore
    }
    if (sortBy === 'complexity_asc' || sortBy === 'complexity_desc') {
      const aComplexity = a.ai_evaluation_simple_result?.complexity_score ?? 999
      const bComplexity = b.ai_evaluation_simple_result?.complexity_score ?? 999
      return sortBy === 'complexity_asc' ? aComplexity - bComplexity : bComplexity - aComplexity
    }
    return 0
  })

  return (
    <AnimatedPageContainer>
      <Card className={`bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:shadow-blue-500/10 hover:border-slate-600/60 ${designTokens.animations.hover} ${designTokens.animations.fadeIn} rounded-2xl`}>
        <CardHeader className={`bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`}>
          <CardTitle className={`${designTokens.text.cardTitle} text-white`}>Tasks</CardTitle>
          <CardDescription className={`${designTokens.text.cardDescription} text-gray-200`}>View all tasks in the system</CardDescription>
        </CardHeader>
        <CardContent className={`${designTokens.spacing.cardPadding} text-gray-100`}>
          <div className="mb-6 grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="taskSourceFilter" className="block mb-2">
                Filter by Task Source
              </Label>
              <Select
                id="taskSourceFilter"
                value={selectedTaskSourceId}
                onChange={(e) => setSelectedTaskSourceId(e.target.value)}
              >
                <option value="">All Task Sources</option>
                {projectTaskSources.map((taskSource) => (
                  <option key={taskSource.id} value={taskSource.id}>
                    {taskSource.name} ({taskSource.type})
                  </option>
                ))}
              </Select>
            </div>

            <div>
              <Label htmlFor="sortBy" className="block mb-2">
                Sort By
              </Label>
              <Select
                id="sortBy"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as SortOption)}
              >
                <option value="quick_win_desc">Quick Win Score (High to Low)</option>
                <option value="quick_win_asc">Quick Win Score (Low to High)</option>
                <option value="complexity_asc">Complexity (Low to High)</option>
                <option value="complexity_desc">Complexity (High to Low)</option>
                <option value="created_desc">Created Date (Newest First)</option>
                <option value="created_asc">Created Date (Oldest First)</option>
              </Select>
            </div>

            <div>
              <Label htmlFor="filterEvaluated" className="block mb-2">
                Filter
              </Label>
              <Select
                id="filterEvaluated"
                value={filterEvaluated ? "evaluated" : "all"}
                onChange={(e) => setFilterEvaluated(e.target.value === "evaluated")}
              >
                <option value="all">All Tasks</option>
                <option value="evaluated">Only Evaluated</option>
              </Select>
            </div>
          </div>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">Loading tasks...</div>
            </div>
          ) : filteredTasks.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">No tasks found</div>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredTasks.map((task) => {
                const taskSource = taskSources.find((ts) => ts.id === task.task_source_id)
                const project = projects.find((p) => p.id === task.project_id)
                return (
                  <TaskRow
                    key={task.id}
                    task={task}
                    taskSource={taskSource}
                    project={project}
                    onViewDetails={() => navigateTo(`/tasks/${task.id}`)}
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
