import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { Link } from "react-router-dom"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { TrendingUp, TrendingDown, DollarSign, Clock, Target, Award, Activity } from "lucide-react"
import {
  tasksStore,
  fetchTasks,
  usageMetricsStore,
  fetchUsageMetrics,
} from "@/stores"
import { calculateCostBreakdown } from "@/config/pricing"

export function InsightsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { tasks } = useSnapshot(tasksStore)
  const { metrics: usageMetrics } = useSnapshot(usageMetricsStore)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadData = async () => {
      try {
        await Promise.all([
          fetchTasks(client),
          fetchUsageMetrics(client),
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

  // Calculate this week's stats
  const thisWeek = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)

    const shipped = projectTasks.filter(task => {
      if (!task.updated_at) return false
      const taskDate = new Date(task.updated_at)
      return taskDate >= weekAgo && task.ai_implementation_status === 'completed'
    })

    const totalCost = usageMetrics.reduce((acc, metric) => {
      const breakdown = calculateCostBreakdown(metric)
      return acc + breakdown.totalCost
    }, 0)

    const successRate = projectTasks.filter(t => t.ai_implementation_status === 'completed').length /
      Math.max(projectTasks.filter(t => t.ai_implementation_status).length, 1) * 100

    return {
      shipped: shipped.length,
      cost: totalCost,
      timeSaved: shipped.length * 0.5, // Estimate 30 min saved per task
      successRate: Math.round(successRate),
    }
  }, [projectTasks, usageMetrics])

  // Calculate last week for comparison
  const lastWeek = useMemo(() => {
    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const twoWeeksAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000)

    const shipped = projectTasks.filter(task => {
      if (!task.updated_at) return false
      const taskDate = new Date(task.updated_at)
      return taskDate >= twoWeeksAgo && taskDate < weekAgo && task.ai_implementation_status === 'completed'
    })

    return {
      shipped: shipped.length,
    }
  }, [projectTasks])

  // Calculate velocity trend
  const velocityChange = useMemo(() => {
    if (lastWeek.shipped === 0) return 100
    return Math.round(((thisWeek.shipped - lastWeek.shipped) / lastWeek.shipped) * 100)
  }, [thisWeek.shipped, lastWeek.shipped])

  // Get biggest wins
  const biggestWins = useMemo(() => {
    const completed = projectTasks.filter(task =>
      task.ai_implementation_status === 'completed'
    ).slice(0, 3)

    return completed.map(task => {
      const evalResult = task.ai_evaluation_simple_result
      return {
        title: task.title,
        impact: evalResult?.estimated_impact || 'medium',
        complexity: evalResult?.complexity_score || 50,
      }
    })
  }, [projectTasks])

  // Weekly velocity data (mock for now - would come from backend)
  const weeklyData = useMemo(() => {
    return [
      { day: 'Mon', count: 4 },
      { day: 'Tue', count: 7 },
      { day: 'Wed', count: 5 },
      { day: 'Thu', count: 9 },
      { day: 'Fri', count: 8 },
      { day: 'Sat', count: 3 },
      { day: 'Sun', count: 2 },
    ]
  }, [])

  if (loading) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center`}>
        <div className={designTokens.text.bodySecondary}>Loading Insights...</div>
      </div>
    )
  }

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className={`${designTokens.text.caption} ${designTokens.colors.text.secondary} hover:${designTokens.colors.text.primary} mb-2 inline-block`}>
          ← Back to Command Center
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Activity className="h-8 w-8 text-purple-400" />
          <h1 className={designTokens.text.mode}>Insights</h1>
        </div>
        <p className={`${designTokens.text.bodySecondary}`}>
          Understand your velocity, impact, and efficiency
        </p>
      </div>

      {/* This Week Summary */}
      <div className="mb-8">
        <h2 className={`${designTokens.text.h2} mb-4`}>This Week</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          {/* Shipped */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={designTokens.text.metricLabel}>Shipped</div>
                {velocityChange > 0 ? (
                  <TrendingUp className={`h-4 w-4 ${designTokens.colors.text.ship}`} />
                ) : (
                  <TrendingDown className="h-4 w-4 text-red-400" />
                )}
              </div>
              <div className={`${designTokens.text.metric} ${designTokens.colors.text.ship}`}>
                {thisWeek.shipped}
              </div>
              <div className={`${designTokens.text.caption} mt-1`}>
                {velocityChange > 0 ? '+' : ''}{velocityChange}% from last week
              </div>
            </div>
          </div>

          {/* Cost */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={designTokens.text.metricLabel}>Cost</div>
                <DollarSign className="h-4 w-4 text-blue-400" />
              </div>
              <div className={`${designTokens.text.metric} text-blue-400`}>
                ${thisWeek.cost.toFixed(2)}
              </div>
              <div className={`${designTokens.text.caption} mt-1`}>
                AI & infrastructure
              </div>
            </div>
          </div>

          {/* Time Saved */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={designTokens.text.metricLabel}>Time Saved</div>
                <Clock className="h-4 w-4 text-amber-400" />
              </div>
              <div className={`${designTokens.text.metric} text-amber-400`}>
                {thisWeek.timeSaved.toFixed(1)}h
              </div>
              <div className={`${designTokens.text.caption} mt-1`}>
                Est. manual effort
              </div>
            </div>
          </div>

          {/* Success Rate */}
          <div className={designTokens.cards.default}>
            <div className="p-6">
              <div className="flex items-center justify-between mb-2">
                <div className={designTokens.text.metricLabel}>Success Rate</div>
                <Target className="h-4 w-4 text-purple-400" />
              </div>
              <div className={`${designTokens.text.metric} text-purple-400`}>
                {thisWeek.successRate}%
              </div>
              <div className={`${designTokens.text.caption} mt-1`}>
                Completed vs attempted
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Velocity Trend */}
      <div className="mb-8">
        <div className={designTokens.cards.default}>
          <div className="p-6">
            <div className="flex items-center gap-2 mb-6">
              <TrendingUp className={`h-5 w-5 ${designTokens.colors.text.ship}`} />
              <h2 className={designTokens.text.h2}>Velocity Trend</h2>
            </div>

            {/* Simple bar chart */}
            <div className="flex items-end gap-4 h-48">
              {weeklyData.map((day) => {
                const maxCount = Math.max(...weeklyData.map(d => d.count))
                const height = (day.count / maxCount) * 100

                return (
                  <div key={day.day} className="flex-1 flex flex-col items-center gap-2">
                    <div className="w-full flex items-end" style={{ height: '100%' }}>
                      <div
                        className={`w-full ${designTokens.colors.mode.ship.bg} rounded-t-lg transition-all duration-300 hover:opacity-80`}
                        style={{ height: `${height}%` }}
                      />
                    </div>
                    <div className={designTokens.text.caption}>{day.day}</div>
                    <div className={`${designTokens.text.body} font-medium`}>{day.count}</div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>

      {/* Biggest Wins */}
      <div>
        <div className="flex items-center gap-2 mb-4">
          <Award className="h-5 w-5 text-yellow-400" />
          <h2 className={designTokens.text.h2}>Biggest Wins This Week</h2>
        </div>

        <div className="space-y-3">
          {biggestWins.length === 0 ? (
            <div className={designTokens.cards.default}>
              <div className="p-8 text-center">
                <p className={designTokens.text.bodySecondary}>
                  No completed tasks yet. Ship something to see your wins!
                </p>
              </div>
            </div>
          ) : (
            biggestWins.map((win, index) => (
              <div key={index} className={designTokens.cards.default}>
                <div className="p-6 flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className={`w-8 h-8 rounded-full ${designTokens.colors.mode.ship.bg} flex items-center justify-center text-white font-bold`}>
                      {index + 1}
                    </div>
                    <div>
                      <div className={`${designTokens.text.body} font-medium mb-1`}>
                        {win.title}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.impact.high.bg} text-white rounded`}>
                          {win.impact.toUpperCase()} Impact
                        </span>
                        <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.bg.tertiary} rounded`}>
                          Complexity: {Math.round(win.complexity)}
                        </span>
                      </div>
                    </div>
                  </div>
                  <Award className="h-6 w-6 text-yellow-400" />
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  )
}
