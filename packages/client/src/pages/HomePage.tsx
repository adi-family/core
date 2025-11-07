import { Link } from "react-router-dom"
import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { createAuthenticatedClient } from "@/lib/client"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import {
  PRICING,
  calculateCostBreakdown,
  formatCost,
  formatTokens,
} from '@/config/pricing'
import { Folder, ListTodo, Database, GitBranch, Plus } from "lucide-react"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import {
  getProjectStatsConfig
} from '@adi/api-contracts'
import {
  projectsStore,
  fetchProjects,
  tasksStore,
  fetchTasks,
  getTasksByProject,
  taskSourcesStore,
  fetchTaskSources,
  getTaskSourcesByProject,
  fileSpacesStore,
  fetchFileSpaces,
  getFileSpacesByProject,
  usageMetricsStore,
  fetchUsageMetrics
} from "@/stores"

export function HomePage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { projects } = useSnapshot(projectsStore)
  const { tasks } = useSnapshot(tasksStore)
  const { taskSources } = useSnapshot(taskSourcesStore)
  const { fileSpaces } = useSnapshot(fileSpacesStore)
  const { metrics: usageMetrics } = useSnapshot(usageMetricsStore)
  const [projectStats, setProjectStats] = useState<{
    total_tasks: number
    completed_tasks: number
    pending_tasks: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadingStats, setLoadingStats] = useState(false)

  // Load all data
  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchProjects(client),
          fetchTasks(client),
          fetchTaskSources(client),
          fetchFileSpaces(client),
          fetchUsageMetrics(client)
        ])
      } catch (error) {
        console.error('Failed to load dashboard data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [client])

  // Load project stats when selected project changes
  useEffect(() => {
    if (!selectedProjectId) {
      setProjectStats(null)
      return
    }

    const loadProjectStats = async () => {
      setLoadingStats(true)
      try {
        const data = await client.run(getProjectStatsConfig, {
          params: { id: selectedProjectId }
        })
        setProjectStats(data)
      } catch (error) {
        console.error('Failed to load project stats:', error)
      } finally {
        setLoadingStats(false)
      }
    }

    loadProjectStats()
  }, [selectedProjectId, client])

  // Calculate totals
  const totals = useMemo(() => {
    if (usageMetrics.length === 0) {
      return { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0 }
    }

    return usageMetrics.reduce(
      (acc, metric) => {
        const breakdown = calculateCostBreakdown(metric)
        return {
          totalCost: acc.totalCost + breakdown.totalCost,
          tokenCost: acc.tokenCost + breakdown.tokenCost,
          ciCost: acc.ciCost + breakdown.ciCost,
          totalTokens: acc.totalTokens + breakdown.totalTokens
        }
      },
      { totalCost: 0, tokenCost: 0, ciCost: 0, totalTokens: 0 }
    )
  }, [usageMetrics])

  // Get selected project
  const selectedProject = useMemo(() => {
    return projects.find(p => p.id === selectedProjectId)
  }, [projects, selectedProjectId])

  // Filter data by selected project
  const filteredTasks = useMemo(() =>
    getTasksByProject(selectedProjectId), [selectedProjectId, tasks]
  )

  const filteredTaskSources = useMemo(() =>
    getTaskSourcesByProject(selectedProjectId), [selectedProjectId, taskSources]
  )

  const filteredFileSpaces = useMemo(() =>
    getFileSpacesByProject(selectedProjectId), [selectedProjectId, fileSpaces]
  )

  // Get latest tasks (last 5)
  const latestTasks = useMemo(() => {
    return filteredTasks.slice(0, 5)
  }, [filteredTasks])

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'completed': return 'text-green-400 bg-green-500/10 border-green-500/20'
      case 'failed': return 'text-red-400 bg-red-500/10 border-red-500/20'
      case 'in_progress': return 'text-blue-400 bg-blue-500/10 border-blue-500/20'
      default: return 'text-gray-400 bg-gray-500/10 border-gray-500/20'
    }
  }

  return (
    <div className="mx-auto p-6 max-w-7xl min-h-[calc(100vh-3.5rem)]">
      <div className="mb-8 pt-8">
        <div className="mb-6">
          <h1 className="text-6xl font-bold tracking-tight uppercase mb-4 bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">ADI Dashboard</h1>
          <p className="text-gray-400 text-sm uppercase tracking-wide">
            {selectedProject ? selectedProject.name : 'Task automation platform overview'}
          </p>
        </div>

        {/* Cost Counter - Full Width */}
        <div className="bg-slate-800/50 backdrop-blur-xl border border-slate-700/50 rounded-lg p-6">
          <div className="flex items-center justify-between">
            <div className="text-sm font-medium text-gray-300">Platform Cost (Last 100 API calls)</div>
            {loading ? (
              <div className="text-2xl font-bold text-blue-400">Loading...</div>
            ) : (
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-3xl font-bold text-blue-400">{formatCost(totals.totalCost)}</div>
                  <div className="text-xs text-gray-400 uppercase mt-1">Total Cost</div>
                </div>
                <div className="h-12 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-300">{formatTokens(totals.totalTokens)}</div>
                  <div className="text-xs text-gray-400 uppercase mt-1">Tokens ({formatCost(totals.tokenCost)})</div>
                </div>
                <div className="h-12 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-300">{formatCost(totals.ciCost)}</div>
                  <div className="text-xs text-gray-400 uppercase mt-1">CI Time</div>
                </div>
                <div className="h-12 w-px bg-slate-600"></div>
                <div className="text-center">
                  <div className="text-lg font-semibold text-gray-300">{usageMetrics.length}</div>
                  <div className="text-xs text-gray-400 uppercase mt-1">API Calls</div>
                </div>
                <div className="h-12 w-px bg-slate-600"></div>
                <div className="text-right text-xs text-gray-400">
                  <div>${PRICING.PER_MILLION_TOKENS}/M tokens</div>
                  <div>${PRICING.PER_CI_HOUR.toFixed(4)}/hour CI</div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Project Stats Section */}
      {selectedProject && !loading && (
        <div className="mb-8">
          <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <CardContent className="p-6">
              {loadingStats ? (
                <div className="text-center text-gray-500 py-4">Loading stats...</div>
              ) : projectStats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-7 gap-4">
                  <div className="text-center">
                    <div className="text-3xl font-bold text-white">{projectStats.total_tasks}</div>
                    <div className="text-xs text-gray-400 uppercase mt-1">Total Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-green-400">{projectStats.completed_tasks}</div>
                    <div className="text-xs text-gray-400 uppercase mt-1">Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-3xl font-bold text-yellow-400">{projectStats.pending_tasks}</div>
                    <div className="text-xs text-gray-400 uppercase mt-1">Pending</div>
                  </div>
                </div>
              ) : (
                <div className="text-center text-gray-500 py-4">No stats available</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projects Section */}
      <div className="mb-8">
        <div className="flex items-center mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <Folder className="h-6 w-6 text-blue-400" />
            Projects
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {loading ? (
            <div className="text-gray-500">Loading projects...</div>
          ) : (
            <>
              {projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <Card className={`cursor-pointer bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 hover:border-slate-600/60 ${designTokens.animations.hover} transition-all h-[120px]`}>
                    <CardHeader className="pb-3">
                      <CardTitle className="text-white text-lg">{project.name}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
              {/* New Project Card */}
              <Link to="/setup-project">
                <Card className={`cursor-pointer bg-slate-800/40 backdrop-blur-xl border-2 border-dashed border-slate-600/50 hover:border-blue-500/60 hover:bg-slate-700/40 ${designTokens.animations.hover} transition-all flex items-center justify-center h-[120px]`}>
                  <CardContent className="flex flex-col items-center justify-center p-6">
                    <Plus className="h-8 w-8 text-blue-400 mb-2" />
                    <span className="text-white font-medium">New Project</span>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Latest Tasks */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-2xl font-bold text-white flex items-center gap-2">
            <ListTodo className="h-6 w-6 text-green-400" />
            Latest Tasks
          </h2>
          <Link to="/tasks" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
            View All
          </Link>
        </div>
        <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
          <CardContent className="p-6">
            {loading ? (
              <div className="text-gray-500">Loading tasks...</div>
            ) : latestTasks.length === 0 ? (
              <div className="text-gray-500">No tasks found</div>
            ) : (
              <div className="space-y-3">
                {latestTasks.map((task) => (
                  <Link key={task.id} to={`/tasks/${task.id}`}>
                    <div className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 hover:bg-slate-700/50 transition-colors border border-slate-600/30">
                      <div className="flex-1">
                        <div className="text-white font-medium text-sm">{task.title}</div>
                        <div className="text-gray-400 text-xs mt-1">{task.description?.substring(0, 80)}...</div>
                      </div>
                      <div className={`px-2 py-1 rounded text-xs font-medium border ${getStatusColor(task.status)}`}>
                        {task.status}
                      </div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Task Sources & File Spaces Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Task Sources */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <Database className="h-6 w-6 text-purple-400" />
              Task Sources
            </h2>
            <Link to="/task-sources" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View All
            </Link>
          </div>
          <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <CardContent className="p-6">
              {loading ? (
                <div className="text-gray-500">Loading task sources...</div>
              ) : filteredTaskSources.length === 0 ? (
                <div className="text-gray-500">No task sources found</div>
              ) : (
                <div className="space-y-2">
                  {filteredTaskSources.slice(0, 5).map((source) => (
                    <div key={source.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
                      <div>
                        <div className="text-white font-medium text-sm">{source.name}</div>
                        <div className="text-gray-400 text-xs uppercase">{source.type}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* File Spaces */}
        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <GitBranch className="h-6 w-6 text-orange-400" />
              Repositories
            </h2>
            <Link to="/file-spaces" className="text-sm text-blue-400 hover:text-blue-300 transition-colors">
              View All
            </Link>
          </div>
          <Card className="bg-slate-800/40 backdrop-blur-xl border border-slate-700/50">
            <CardContent className="p-6">
              {loading ? (
                <div className="text-gray-500">Loading file spaces...</div>
              ) : filteredFileSpaces.length === 0 ? (
                <div className="text-gray-500">No file spaces found</div>
              ) : (
                <div className="space-y-2">
                  {filteredFileSpaces.slice(0, 5).map((space) => (
                    <div key={space.id} className="flex items-center justify-between p-3 rounded-lg bg-slate-700/30 border border-slate-600/30">
                      <div>
                        <div className="text-white font-medium text-sm">{space.name}</div>
                        <div className="text-gray-400 text-xs">{space.config.repo}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
