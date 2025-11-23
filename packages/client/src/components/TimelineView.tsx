import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { createAuthenticatedClient } from "@/lib/client"
import type { Task } from "@adi-simple/types"
import { navigateTo } from "@/utils/navigation"
import { designTokens } from "@/theme/tokens"
import { Bot } from "lucide-react"

interface TimelineViewProps {
  tasks: Task[]
  _onRefresh: () => void
}

interface TimelineTask extends Task {
  startDate: Date
  endDate: Date
  dependencies: string[]
}

export function TimelineView({ tasks, _onRefresh }: TimelineViewProps) {
  const { getToken } = useAuth()
  const _client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [_selectedTask, _setSelectedTask] = useState<Task | null>(null)
  const [viewMode, setViewMode] = useState<'week' | 'month'>('week')

  // Convert tasks to timeline tasks with estimated dates
  const timelineTasks = useMemo(() => {
    const now = new Date()

    return tasks.map((task): TimelineTask => {
      const evalResult = task.ai_evaluation_simple_result

      // Estimate duration based on effort
      let durationDays = 3 // default
      if (evalResult?.effort_estimate) {
        const effortMap: Record<string, number> = {
          xs: 0.5,
          s: 1,
          m: 3,
          l: 7,
          xl: 14
        }
        durationDays = effortMap[evalResult.effort_estimate] || 3
      }

      // Calculate start date (stagger tasks to avoid overlap)
      const startDate = new Date(now)
      startDate.setDate(startDate.getDate() + index * 2)

      const endDate = new Date(startDate)
      endDate.setDate(endDate.getDate() + durationDays)

      return {
        ...task,
        startDate,
        endDate,
        dependencies: [] // TODO: Add dependency tracking
      }
    })
  }, [tasks])

  // Group tasks by week or month
  const timeSlots = useMemo(() => {
    if (timelineTasks.length === 0) return []

    const slots: { start: Date; end: Date; label: string }[] = []
    const now = new Date()

    if (viewMode === 'week') {
      // Show 8 weeks
      for (let i = 0; i < 8; i++) {
        const start = new Date(now)
        start.setDate(start.getDate() + i * 7)
        const end = new Date(start)
        end.setDate(end.getDate() + 7)

        slots.push({
          start,
          end,
          label: `Week ${i + 1}`
        })
      }
    } else {
      // Show 6 months
      for (let i = 0; i < 6; i++) {
        const start = new Date(now.getFullYear(), now.getMonth() + i, 1)
        const end = new Date(now.getFullYear(), now.getMonth() + i + 1, 0)

        slots.push({
          start,
          end,
          label: start.toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
        })
      }
    }

    return slots
  }, [viewMode, timelineTasks])

  // Calculate task position in timeline
  const getTaskPosition = (task: TimelineTask) => {
    if (timeSlots.length === 0) return { left: 0, width: 0 }

    const firstSlot = timeSlots[0]
    const lastSlot = timeSlots[timeSlots.length - 1]
    const totalDuration = lastSlot.end.getTime() - firstSlot.start.getTime()

    const taskStart = Math.max(task.startDate.getTime(), firstSlot.start.getTime())
    const taskEnd = Math.min(task.endDate.getTime(), lastSlot.end.getTime())

    const left = ((taskStart - firstSlot.start.getTime()) / totalDuration) * 100
    const width = ((taskEnd - taskStart) / totalDuration) * 100

    return { left: `${left}%`, width: `${width}%` }
  }

  // Get task color based on status and metrics
  const getTaskColor = (task: TimelineTask) => {
    if (task.ai_implementation_status === 'completed') return 'bg-neutral-500'
    if (task.ai_implementation_status === 'implementing') return 'bg-neutral-600'

    const evalResult = task.ai_evaluation_simple_result
    if (evalResult?.estimated_impact === 'high') return 'bg-neutral-600'
    if (evalResult?.estimated_impact === 'medium') return 'bg-neutral-700'

    return 'bg-neutral-700'
  }

  return (
    <div className={`${designTokens.colors.bg.secondary} rounded-lg ${designTokens.borders.default} ${designTokens.spacing.cardPadding}`}>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className={designTokens.text.h2}>Timeline View</h2>
          <p className={`${designTokens.text.bodySecondary} mt-1`}>
            Visualize task scheduling and dependencies
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setViewMode('week')}
            className={`px-3 py-1.5 ${designTokens.text.body} rounded-lg transition-colors ${
              viewMode === 'week'
                ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
            }`}
          >
            Week View
          </button>
          <button
            onClick={() => setViewMode('month')}
            className={`px-3 py-1.5 ${designTokens.text.body} rounded-lg transition-colors ${
              viewMode === 'month'
                ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
            }`}
          >
            Month View
          </button>
        </div>
      </div>

      {timelineTasks.length === 0 ? (
        <div className="flex items-center justify-center h-64">
          <p className="text-neutral-500">No tasks to display</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Time slots header */}
          <div className="flex border-b border-neutral-700 pb-2">
            {timeSlots.map((slot) => (
              <div
                key={index}
                className="flex-1 text-center text-xs font-medium text-neutral-400"
              >
                {slot.label}
              </div>
            ))}
          </div>

          {/* Timeline grid */}
          <div className="relative">
            {/* Grid lines */}
            <div className="absolute inset-0 flex">
              {timeSlots.map((_) => (
                <div
                  key={index}
                  className="flex-1 border-r border-neutral-700/30 last:border-r-0"
                />
              ))}
            </div>

            {/* Tasks */}
            <div className="relative space-y-2 pt-4">
              {timelineTasks.map((task) => {
                const position = getTaskPosition(task)
                const color = getTaskColor(task)

                return (
                  <div key={task.id} className="relative h-12 group">
                    <div
                      className={`absolute h-10 ${color} rounded-lg cursor-pointer transition-all hover:scale-105 hover:shadow-lg overflow-hidden`}
                      style={position}
                      onClick={() => navigateTo(`/tasks/${task.id}`)}
                    >
                      <div className="px-3 py-2 h-full flex items-center justify-between">
                        <span className="text-white text-sm font-medium truncate flex-1">
                          {task.title}
                        </span>

                        {/* Effort badge */}
                        {task.ai_evaluation_simple_result?.effort_estimate && (
                          <span className="ml-2 text-xs bg-white/20 px-2 py-0.5 rounded text-white">
                            {task.ai_evaluation_simple_result.effort_estimate.toUpperCase()}
                          </span>
                        )}
                      </div>

                      {/* Hover details */}
                      <div className="absolute left-0 top-full mt-2 bg-neutral-900 border border-neutral-700 rounded-lg p-3 shadow-xl opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity z-10 min-w-[300px]">
                        <h4 className="font-semibold text-white mb-2">{task.title}</h4>

                        {task.description && (
                          <p className="text-sm text-neutral-400 mb-2 line-clamp-3">
                            {task.description}
                          </p>
                        )}

                        <div className="text-xs text-neutral-500 space-y-1">
                          <div>Start: {task.startDate.toLocaleDateString()}</div>
                          <div>End: {task.endDate.toLocaleDateString()}</div>

                          {task.ai_evaluation_simple_result && (
                            <>
                              <div>Complexity: {Math.round(task.ai_evaluation_simple_result.complexity_score || 0)}</div>
                              <div>Impact: {task.ai_evaluation_simple_result.estimated_impact}</div>
                            </>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* Legend */}
          <div className="flex items-center gap-6 pt-6 border-t border-neutral-700">
            <div className="text-sm text-neutral-400">Legend:</div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-neutral-500 rounded" />
              <span className="text-xs text-neutral-400">Completed</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-neutral-600 rounded" />
              <span className="text-xs text-neutral-400">In Progress</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-neutral-600 rounded" />
              <span className="text-xs text-neutral-400">High Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-neutral-700 rounded" />
              <span className="text-xs text-neutral-400">Medium Impact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-4 h-4 bg-neutral-700 rounded" />
              <span className="text-xs text-neutral-400">Not Evaluated</span>
            </div>
          </div>

          {/* Predictive scheduling hint */}
          <div className="bg-neutral-900/20 border border-neutral-700/30 rounded-lg p-4 mt-6">
            <div className="flex items-start gap-3">
              <Bot className="h-8 w-8 text-neutral-400" />
              <div>
                <h4 className="text-sm font-semibold text-neutral-300 mb-1">AI Scheduling</h4>
                <p className="text-xs text-neutral-200/80">
                  Tasks are automatically scheduled based on complexity, dependencies, and estimated effort.
                  Drag tasks to adjust timeline or let AI optimize the schedule.
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
