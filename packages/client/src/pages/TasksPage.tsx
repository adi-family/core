import { useEffect, useState, useRef, useCallback } from "react"
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
import { toast } from "sonner"
import type { Task, TaskSource, Project } from "../../../types"

type SortOption = 'created_desc' | 'created_asc' | 'quick_win_desc' | 'quick_win_asc' | 'complexity_asc' | 'complexity_desc'

export function TasksPage() {
  const { selectedProjectId } = useProject()
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [selectedTaskSourceId, setSelectedTaskSourceId] = useState<string>("")
  const [sortBy, setSortBy] = useState<SortOption>('quick_win_desc')
  const [filterEvaluated, setFilterEvaluated] = useState<boolean>(false)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(true)
  const [totalCount, setTotalCount] = useState(0)
  const observerTarget = useRef<HTMLDivElement>(null)

  const fetchData = useCallback(async (pageNum: number = 1, append: boolean = false) => {
    if (append) {
      setLoadingMore(true)
    } else {
      setLoading(true)
    }

    // Build query parameters for server-side filtering and sorting
    const queryParams: Record<string, string> = {
      page: String(pageNum),
      per_page: '20'
    }
    if (selectedProjectId) {
      queryParams.project_id = selectedProjectId
    }
    if (selectedTaskSourceId) {
      queryParams.task_source_id = selectedTaskSourceId
    }
    if (filterEvaluated) {
      queryParams.evaluated_only = 'true'
    }
    if (sortBy) {
      queryParams.sort_by = sortBy
    }

    const fetchPromises = [
      client.tasks.$get({ query: queryParams })
    ]

    // Only fetch task sources and projects on initial load
    if (!append) {
      fetchPromises.push(
        client["task-sources"].$get({ query: {} }),
        client.projects.$get()
      )
    }

    const responses = await Promise.all(fetchPromises)
    const [tasksRes, taskSourcesRes, projectsRes] = responses

    if (!tasksRes.ok) {
      console.error("Error fetching tasks:", await tasksRes.text())
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (!append && taskSourcesRes && !taskSourcesRes.ok) {
      console.error("Error fetching task sources:", await taskSourcesRes.text())
      setLoading(false)
      return
    }

    if (!append && projectsRes && !projectsRes.ok) {
      console.error("Error fetching projects:", await projectsRes.text())
      setLoading(false)
      return
    }

    const tasksData = await tasksRes.json()
    const taskSourcesData = !append && taskSourcesRes ? await taskSourcesRes.json() : null
    const projectsData = !append && projectsRes ? await projectsRes.json() : null

    // Handle both old array format and new paginated format for backwards compatibility
    const newTasks = Array.isArray(tasksData) ? tasksData : tasksData.data
    const pagination = Array.isArray(tasksData) ? null : tasksData.pagination

    if (!Array.isArray(newTasks)) {
      console.error("Invalid API response: expected array of tasks or paginated response")
      setLoading(false)
      setLoadingMore(false)
      return
    }

    if (append) {
      setTasks(prev => [...prev, ...newTasks])
    } else {
      setTasks(newTasks)
      if (taskSourcesData) setTaskSources(taskSourcesData)
      if (projectsData) setProjects(projectsData)
    }

    // Update pagination state
    if (pagination) {
      setTotalCount(pagination.total)
      setHasMore(pagination.page < pagination.total_pages)
    } else {
      // Fallback if no pagination data
      setHasMore(newTasks.length === 20)
    }

    setLoading(false)
    setLoadingMore(false)
  }, [selectedProjectId, selectedTaskSourceId, filterEvaluated, sortBy])

  const loadMore = useCallback(() => {
    if (!loadingMore && hasMore && !loading) {
      const nextPage = page + 1
      setPage(nextPage)
      fetchData(nextPage, true)
    }
  }, [loadingMore, hasMore, loading, page, fetchData])

  // Intersection Observer for infinite scroll
  useEffect(() => {
    const observer = new IntersectionObserver(
      entries => {
        if (entries[0].isIntersecting) {
          loadMore()
        }
      },
      { threshold: 0.1 }
    )

    const currentTarget = observerTarget.current
    if (currentTarget) {
      observer.observe(currentTarget)
    }

    return () => {
      if (currentTarget) {
        observer.unobserve(currentTarget)
      }
    }
  }, [loadMore])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
    setHasMore(true)
    fetchData(1, false).catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [selectedProjectId, selectedTaskSourceId, filterEvaluated, sortBy, fetchData])

  const handleStartImplementation = async (task: Task) => {
    try {
      const response = await client.tasks[':id'].implement.$post({
        param: { id: task.id }
      })

      if (!response.ok) {
        const error = await response.text()
        toast.error(`Failed to start implementation: ${error}`)
        return
      }

      toast.success('Implementation started successfully')
      // Refresh the task list to show updated status
      await fetchData(1, false)
    } catch (error) {
      console.error("Error starting implementation:", error)
      toast.error('Failed to start implementation')
    }
  }

  const handleEvaluate = async (task: Task) => {
    try {
      const response = await client.tasks[':id'].evaluate.$post({
        param: { id: task.id }
      })

      if (!response.ok) {
        const error = await response.text()
        toast.error(`Failed to start evaluation: ${error}`)
        return
      }

      toast.success('Evaluation started successfully')
      // Refresh the task list to show updated status
      await fetchData(1, false)
    } catch (error) {
      console.error("Error starting evaluation:", error)
      toast.error('Failed to start evaluation')
    }
  }

  // Reset task source filter when project changes
  useEffect(() => {
    setSelectedTaskSourceId("")
  }, [selectedProjectId])

  // Filter task sources by selected project
  const projectTaskSources = selectedProjectId
    ? taskSources.filter(ts => ts.project_id === selectedProjectId)
    : taskSources

  // Tasks are already filtered and sorted on the server-side
  // No need for client-side filtering/sorting anymore
  const filteredTasks = tasks

  return (
    <AnimatedPageContainer>
      <Card className={`bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:shadow-blue-500/10 hover:border-slate-600/60 ${designTokens.animations.hover} ${designTokens.animations.fadeIn} rounded-2xl`}>
        <CardHeader className={`bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`}>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className={`${designTokens.text.cardTitle} text-white`}>Tasks</CardTitle>
              <CardDescription className={`${designTokens.text.cardDescription} text-gray-200`}>View all tasks in the system</CardDescription>
            </div>
            {!loading && (
              <div className="bg-white/10 backdrop-blur-sm px-4 py-2 rounded-lg border border-white/20">
                <div className="text-xs text-gray-200 mb-0.5">Total Tasks</div>
                <div className="text-2xl font-bold text-white">
                  {totalCount > 0 ? totalCount : filteredTasks.length}
                </div>
                {filteredTasks.length < totalCount && (
                  <div className="text-xs text-gray-300 mt-1">
                    Showing {filteredTasks.length}
                  </div>
                )}
              </div>
            )}
          </div>
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
            <>
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
                      onStartImplementation={handleStartImplementation}
                      onEvaluate={handleEvaluate}
                    />
                  )
                })}
              </div>

              {/* Infinite scroll loading indicator and observer target */}
              {loadingMore && (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-400">Loading more tasks...</div>
                </div>
              )}

              {/* Observer target for infinite scroll */}
              <div ref={observerTarget} className="h-4" />

              {!hasMore && filteredTasks.length > 0 && (
                <div className="flex justify-center items-center py-8">
                  <div className="text-gray-500 text-sm">No more tasks to load</div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </AnimatedPageContainer>
  )
}
