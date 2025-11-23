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
      case 'completed': return designTokens.colors.status.success
      case 'failed': return designTokens.colors.status.error
      case 'in_progress': return designTokens.colors.status.info
      default: return designTokens.colors.status.pending
    }
  }

  return (
    <div className={`px-6 py-6 min-h-[calc(100vh-3rem)]`}>
      <div className={`mb-6 pt-6 ${designTokens.spacing.section}`}>
        <div className="mb-6">
          <h1 className={`text-3xl font-semibold mb-2 ${designTokens.colors.text.primary}`}>Dashboard</h1>
          <p className={designTokens.text.bodySecondary}>
            {selectedProject ? selectedProject.name : 'Task automation platform overview'}
          </p>
        </div>

        {/* Cost Counter - Full Width */}
        <div className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default} rounded-lg ${designTokens.spacing.cardPadding}`}>
          <div className="flex items-center justify-between">
            <div className={designTokens.text.label}>Platform Cost (Last 100 API calls)</div>
            {loading ? (
              <div className="text-2xl font-semibold text-neutral-400">Loading...</div>
            ) : (
              <div className="flex items-center gap-8">
                <div className="text-center">
                  <div className="text-2xl font-semibold text-neutral-400">{formatCost(totals.totalCost)}</div>
                  <div className={`${designTokens.text.caption} mt-1`}>Total Cost</div>
                </div>
                <div className={`h-10 w-px ${designTokens.colors.bg.tertiary}`}></div>
                <div className="text-center">
                  <div className={`text-base font-medium ${designTokens.colors.text.secondary}`}>{formatTokens(totals.totalTokens)}</div>
                  <div className={`${designTokens.text.caption} mt-1`}>Tokens ({formatCost(totals.tokenCost)})</div>
                </div>
                <div className={`h-10 w-px ${designTokens.colors.bg.tertiary}`}></div>
                <div className="text-center">
                  <div className={`text-base font-medium ${designTokens.colors.text.secondary}`}>{formatCost(totals.ciCost)}</div>
                  <div className={`${designTokens.text.caption} mt-1`}>CI Time</div>
                </div>
                <div className={`h-10 w-px ${designTokens.colors.bg.tertiary}`}></div>
                <div className="text-center">
                  <div className={`text-base font-medium ${designTokens.colors.text.secondary}`}>{usageMetrics.length}</div>
                  <div className={`${designTokens.text.caption} mt-1`}>API Calls</div>
                </div>
                <div className={`h-10 w-px ${designTokens.colors.bg.tertiary}`}></div>
                <div className={`text-right ${designTokens.text.caption}`}>
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
        <div className="mb-6">
          <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default}`}>
            <CardContent className={designTokens.spacing.cardPadding}>
              {loadingStats ? (
                <div className={`text-center ${designTokens.text.bodySecondary} py-4`}>Loading stats...</div>
              ) : projectStats ? (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                  <div className="text-center">
                    <div className={`text-2xl font-semibold ${designTokens.colors.text.primary}`}>{projectStats.total_tasks}</div>
                    <div className={`${designTokens.text.caption} mt-1`}>Total Tasks</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-neutral-300">{projectStats.completed_tasks}</div>
                    <div className={`${designTokens.text.caption} mt-1`}>Completed</div>
                  </div>
                  <div className="text-center">
                    <div className="text-2xl font-semibold text-neutral-300">{projectStats.pending_tasks}</div>
                    <div className={`${designTokens.text.caption} mt-1`}>Pending</div>
                  </div>
                </div>
              ) : (
                <div className={`text-center ${designTokens.text.bodySecondary} py-4`}>No stats available</div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Projects Section */}
      <div className="mb-6">
        <div className="flex items-center mb-3">
          <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
            <Folder className={`${designTokens.icons.header} ${designTokens.icons.color}`} />
            Projects
          </h2>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {loading ? (
            <div className={designTokens.text.bodySecondary}>Loading projects...</div>
          ) : (
            <>
              {projects.map((project) => (
                <Link key={project.id} to={`/projects/${project.id}`}>
                  <Card className={`cursor-pointer ${designTokens.colors.bg.secondary} ${designTokens.borders.default} ${designTokens.interactions.hover} h-24`}>
                    <CardHeader className={`${designTokens.spacing.cardHeader} pb-3`}>
                      <CardTitle className={`${designTokens.text.h3}`}>{project.name}</CardTitle>
                    </CardHeader>
                  </Card>
                </Link>
              ))}
              {/* New Project Card */}
              <Link to="/setup-project">
                <Card className={`cursor-pointer ${designTokens.colors.bg.secondary} border-2 border-dashed ${designTokens.colors.border.default} hover:border-[#5e6ad2] ${designTokens.interactions.hover} flex items-center justify-center h-24`}>
                  <CardContent className="flex flex-col items-center justify-center p-4">
                    <Plus className={`${designTokens.icons.header} text-[#5e6ad2] mb-1`} />
                    <span className={`${designTokens.text.body} font-medium`}>New Project</span>
                  </CardContent>
                </Card>
              </Link>
            </>
          )}
        </div>
      </div>

      {/* Latest Tasks */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-3">
          <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
            <ListTodo className={`${designTokens.icons.header} ${designTokens.icons.color}`} />
            Latest Tasks
          </h2>
          <Link to="/tasks" className={`${designTokens.text.body} ${designTokens.colors.text.accent} ${designTokens.interactions.hover}`}>
            View All
          </Link>
        </div>
        <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default}`}>
          <CardContent className={designTokens.spacing.cardPadding}>
            {loading ? (
              <div className={designTokens.text.bodySecondary}>Loading tasks...</div>
            ) : latestTasks.length === 0 ? (
              <div className={designTokens.text.bodySecondary}>No tasks found</div>
            ) : (
              <div className={designTokens.spacing.listItem}>
                {latestTasks.map((task) => (
                  <Link key={task.id} to={`/tasks/${task.id}`}>
                    <div className={`flex items-center justify-between p-3 rounded-lg ${designTokens.colors.bg.primary} ${designTokens.interactions.hover} ${designTokens.borders.default}`}>
                      <div className="flex-1">
                        <div className={`${designTokens.text.body} font-medium`}>{task.title}</div>
                        <div className={`${designTokens.text.caption} mt-1`}>{task.description?.substring(0, 80)}...</div>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className={`${designTokens.statusDot} ${getStatusColor(task.status)}`} />
                        <span className={designTokens.text.caption}>{task.status}</span>
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
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Task Sources */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
              <Database className={`${designTokens.icons.header} ${designTokens.icons.color}`} />
              Task Sources
            </h2>
            <Link to="/task-sources" className={`${designTokens.text.body} ${designTokens.colors.text.accent} ${designTokens.interactions.hover}`}>
              View All
            </Link>
          </div>
          <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default}`}>
            <CardContent className={designTokens.spacing.cardPadding}>
              {loading ? (
                <div className={designTokens.text.bodySecondary}>Loading task sources...</div>
              ) : filteredTaskSources.length === 0 ? (
                <div className={designTokens.text.bodySecondary}>No task sources found</div>
              ) : (
                <div className={designTokens.spacing.listItem}>
                  {filteredTaskSources.slice(0, 5).map((source) => (
                    <div key={source.id} className={`flex items-center justify-between p-3 rounded-lg ${designTokens.colors.bg.primary} ${designTokens.borders.default}`}>
                      <div>
                        <div className={`${designTokens.text.body} font-medium`}>{source.name}</div>
                        <div className={designTokens.text.caption}>{source.type}</div>
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
          <div className="flex items-center justify-between mb-3">
            <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
              <GitBranch className={`${designTokens.icons.header} ${designTokens.icons.color}`} />
              Repositories
            </h2>
            <Link to="/file-spaces" className={`${designTokens.text.body} ${designTokens.colors.text.accent} ${designTokens.interactions.hover}`}>
              View All
            </Link>
          </div>
          <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default}`}>
            <CardContent className={designTokens.spacing.cardPadding}>
              {loading ? (
                <div className={designTokens.text.bodySecondary}>Loading file spaces...</div>
              ) : filteredFileSpaces.length === 0 ? (
                <div className={designTokens.text.bodySecondary}>No file spaces found</div>
              ) : (
                <div className={designTokens.spacing.listItem}>
                  {filteredFileSpaces.slice(0, 5).map((space) => (
                    <div key={space.id} className={`flex items-center justify-between p-3 rounded-lg ${designTokens.colors.bg.primary} ${designTokens.borders.default}`}>
                      <div>
                        <div className={`${designTokens.text.body} font-medium`}>{space.name}</div>
                        <div className={designTokens.text.caption}>{space.config.repo}</div>
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
