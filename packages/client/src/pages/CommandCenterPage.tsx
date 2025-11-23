import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { Link } from "react-router-dom"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { Rocket, Search, Zap, TrendingUp, Activity, AlertCircle, Command } from "lucide-react"
import {
  tasksStore,
  fetchTasks,
  projectsStore,
  fetchProjects,
} from "@/stores"

export function CommandCenterPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { tasks } = useSnapshot(tasksStore)
  const { projects } = useSnapshot(projectsStore)
  const [loading, setLoading] = useState(true)

  const selectedProject = useMemo(() =>
    projects.find(p => p.id === selectedProjectId),
    [projects, selectedProjectId]
  )

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchTasks(client),
          fetchProjects(client),
        ])
      } catch (error) {
        console.error('Failed to load data:', error)
      } finally {
        setLoading(false)
      }
    }
    loadData()
  }, [client])

  // Filter tasks by project
  const projectTasks = useMemo(() => {
    if (!selectedProjectId) return tasks
    return tasks.filter(t => t.project_id === selectedProjectId)
  }, [tasks, selectedProjectId])

  // Calculate quick wins (evaluated, low complexity, ready to ship)
  const quickWins = useMemo(() => {
    return projectTasks.filter(task => {
      const hasEvaluation = task.ai_evaluation_simple_status === 'completed' || task.ai_evaluation_advanced_status === 'completed'
      const isReady = task.ai_evaluation_simple_verdict === 'ready' || task.ai_evaluation_advanced_verdict === 'ready'
      const notStarted = !task.ai_implementation_status || task.ai_implementation_status === 'pending'
      const evalResult = task.ai_evaluation_simple_result || task.ai_evaluation_advanced_result
      const lowComplexity = evalResult?.complexity_score ? evalResult.complexity_score < 50 : false

      return hasEvaluation && isReady && notStarted && lowComplexity
    })
  }, [projectTasks])

  // Calculate features ready to ship
  const readyFeatures = useMemo(() => {
    return projectTasks.filter(task => {
      const hasEvaluation = task.ai_evaluation_simple_status === 'completed' || task.ai_evaluation_advanced_status === 'completed'
      const isReady = task.ai_evaluation_simple_verdict === 'ready' || task.ai_evaluation_advanced_verdict === 'ready'
      const notStarted = !task.ai_implementation_status || task.ai_implementation_status === 'pending'
      const evalResult = task.ai_evaluation_simple_result || task.ai_evaluation_advanced_result
      const highComplexity = evalResult?.complexity_score ? evalResult.complexity_score >= 50 : true

      return hasEvaluation && isReady && notStarted && highComplexity
    })
  }, [projectTasks])

  // Calculate items needing review
  const needsReview = useMemo(() => {
    return projectTasks.filter(task => {
      const noEvaluation = !task.ai_evaluation_simple_status || task.ai_evaluation_simple_status === 'not_started'
      return noEvaluation
    })
  }, [projectTasks])

  // Calculate active builds
  const activeBuilds = useMemo(() => {
    return projectTasks.filter(task =>
      task.ai_implementation_status === 'implementing' ||
      task.ai_implementation_status === 'queued'
    )
  }, [projectTasks])

  // Calculate completed today
  const completedToday = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return projectTasks.filter(task => {
      if (!task.updated_at) return false
      const taskDate = new Date(task.updated_at)
      return taskDate >= today && task.ai_implementation_status === 'completed'
    })
  }, [projectTasks])

  if (loading) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center`}>
        <div className={designTokens.text.bodySecondary}>Loading Command Center...</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Command className="h-8 w-8 text-white" />
          <h1 className={designTokens.text.mode}>Command Center</h1>
        </div>
        <p className={`${designTokens.text.bodySecondary}`}>
          {selectedProject ? selectedProject.name : 'All Projects'} · {projectTasks.length} total issues
        </p>
      </div>

      {/* Mode Selection */}
      <div className="grid grid-cols-3 gap-4 mb-8">
          <Link to="/ship" className="group block">
            <div className={`${designTokens.cards.interactive} p-5 group-hover:${designTokens.colors.border.ship}`}>
              <h2 className={`${designTokens.text.h2} ${designTokens.colors.text.ship} flex items-center gap-2 mb-2`}>
                <Rocket className="h-5 w-5" />
                Ship Mode
              </h2>
              <p className={designTokens.text.bodySecondary}>
                Execute tested tasks and deploy improvements
              </p>
            </div>
          </Link>

          <Link to="/review" className="group block">
            <div className={`${designTokens.cards.interactive} p-5 group-hover:${designTokens.colors.border.review}`}>
              <h2 className={`${designTokens.text.h2} ${designTokens.colors.text.review} flex items-center gap-2 mb-2`}>
                <Search className="h-5 w-5" />
                Review Mode
              </h2>
              <p className={designTokens.text.bodySecondary}>
                Analyze code, evaluate priorities, make decisions
              </p>
            </div>
          </Link>

          <Link to="/build" className="group block">
            <div className={`${designTokens.cards.interactive} p-5 group-hover:${designTokens.colors.border.build}`}>
              <h2 className={`${designTokens.text.h2} ${designTokens.colors.text.build} flex items-center gap-2 mb-2`}>
                <Zap className="h-5 w-5" />
                Build Mode
              </h2>
              <p className={designTokens.text.bodySecondary}>
                Focus on complex features requiring expertise
              </p>
            </div>
          </Link>
      </div>

      {/* Ready to Ship */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
            <TrendingUp className={`h-5 w-5 ${designTokens.colors.text.ship}`} />
            Ready to Ship
          </h2>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Quick Wins */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="mb-4">
                <div className={`${designTokens.text.metric} ${designTokens.colors.text.primary}`}>{quickWins.length}</div>
                <div className={designTokens.text.metricLabel}>Quick Wins Ready</div>
              </div>
              <p className={`${designTokens.text.bodySecondary} mb-4`}>
                Low complexity · High confidence · Ready to deploy
              </p>
              {quickWins.length > 0 && (
                <Link to="/ship?filter=quick-wins">
                  <button className={designTokens.buttons.ship}>
                    Ship All Quick Wins →
                  </button>
                </Link>
              )}
            </div>
          </div>

          {/* Features Ready */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="mb-4">
                <div className={`${designTokens.text.metric} ${designTokens.colors.text.primary}`}>{readyFeatures.length}</div>
                <div className={designTokens.text.metricLabel}>Features Evaluated</div>
              </div>
              <p className={`${designTokens.text.bodySecondary} mb-4`}>
                High impact · Approved for implementation
              </p>
              {readyFeatures.length > 0 && (
                <Link to="/ship?filter=features">
                  <button className={designTokens.buttons.primary}>
                    Review & Execute →
                  </button>
                </Link>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Needs Attention */}
      <div className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
            <AlertCircle className={`h-5 w-5 ${designTokens.colors.text.review}`} />
            Needs Your Attention
          </h2>
        </div>

        <div className={designTokens.cards.default}>
          <div className="p-6 space-y-4">
            {needsReview.length > 0 && (
              <div className="flex items-center justify-between">
                <div>
                  <div className={`${designTokens.text.body} font-medium`}>
                    {needsReview.length} issues need review and prioritization
                  </div>
                  <div className={designTokens.text.caption}>
                    Analyze and decide which to build
                  </div>
                </div>
                <Link to="/review">
                  <button className={designTokens.buttons.review}>
                    Enter Review Mode →
                  </button>
                </Link>
              </div>
            )}

            {needsReview.length === 0 && quickWins.length === 0 && readyFeatures.length === 0 && (
              <div className="text-center py-8">
                <p className={designTokens.text.bodySecondary}>
                  All caught up! No items need your attention right now.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* System Status */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className={`${designTokens.text.h2} flex items-center gap-2`}>
            <Activity className="h-5 w-5 text-neutral-400" />
            System Status
          </h2>
        </div>

        <div className={designTokens.cards.default}>
          <div className="p-6">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div>
                <div className={designTokens.text.metricLabel}>Active Builds</div>
                <div className={`${designTokens.text.metric} ${designTokens.colors.text.build}`}>
                  {activeBuilds.length}
                </div>
              </div>
              <div>
                <div className={designTokens.text.metricLabel}>Shipped Today</div>
                <div className={`${designTokens.text.metric} ${designTokens.colors.text.ship}`}>
                  {completedToday.length}
                </div>
              </div>
              <div>
                <div className={designTokens.text.metricLabel}>Total Pipeline</div>
                <div className={`${designTokens.text.metric} text-neutral-300`}>
                  {projectTasks.length}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
