import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { useSearchParams, Link } from "react-router-dom"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { Rocket, Package, Zap, ChevronRight, CheckCircle } from "lucide-react"
import { toast } from "sonner"
import {
  tasksStore,
  fetchTasks,
} from "@/stores"
import { implementTaskConfig } from "@adi/api-contracts"
import type { Task } from "@adi-simple/types"

export function ShipModePage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { tasks } = useSnapshot(tasksStore)
  const [searchParams] = useSearchParams()
  const [loading, setLoading] = useState(true)
  const [shipping, setShipping] = useState<Set<string>>(new Set())
  const [selectedTasks, setSelectedTasks] = useState<Set<string>>(new Set())

  useEffect(() => {
    const loadData = async () => {
      try {
        await fetchTasks(client)
      } catch (error) {
        console.error('Failed to load tasks:', error)
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

  // Calculate quick wins
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

  // Calculate ready features
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

  const filter = searchParams.get('filter')
  const displayTasks = filter === 'quick-wins' ? quickWins : filter === 'features' ? readyFeatures : [...quickWins, ...readyFeatures]

  const handleShipTask = async (task: Task) => {
    setShipping(prev => new Set(prev).add(task.id))
    try {
      await client.run(implementTaskConfig, { params: { id: task.id } })
      toast.success(`Started implementation: ${task.title}`)
      await fetchTasks(client)
    } catch (error) {
      console.error('Failed to start implementation:', error)
      toast.error('Failed to start implementation')
    } finally {
      setShipping(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  const handleShipAll = async () => {
    const tasksToShip = displayTasks.slice(0, 10) // Limit to prevent overwhelming

    toast.success(`Shipping ${tasksToShip.length} tasks...`)

    for (const task of tasksToShip) {
      await handleShipTask(task)
    }
  }

  const handleShipSelected = async () => {
    if (selectedTasks.size === 0) {
      toast.error('No tasks selected')
      return
    }

    const tasksToShip = displayTasks.filter(t => selectedTasks.has(t.id))
    toast.success(`Shipping ${tasksToShip.length} selected tasks...`)

    for (const task of tasksToShip) {
      await handleShipTask(task)
    }

    setSelectedTasks(new Set())
  }

  const toggleTaskSelection = (taskId: string) => {
    setSelectedTasks(prev => {
      const next = new Set(prev)
      if (next.has(taskId)) {
        next.delete(taskId)
      } else {
        next.add(taskId)
      }
      return next
    })
  }

  const selectAll = () => {
    setSelectedTasks(new Set(displayTasks.map(t => t.id)))
  }

  const deselectAll = () => {
    setSelectedTasks(new Set())
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center`}>
        <div className={designTokens.text.bodySecondary}>Loading Ship Mode...</div>
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
          <Rocket className={`h-8 w-8 ${designTokens.colors.text.ship}`} />
          <h1 className={designTokens.text.mode}>Ship Mode</h1>
        </div>
        <p className={`${designTokens.text.bodySecondary}`}>
          Execute tested tasks and deploy improvements
        </p>
      </div>

      {displayTasks.length === 0 ? (
        <div className={designTokens.cards.default}>
          <div className="p-12 text-center">
            <CheckCircle className={`h-16 w-16 ${designTokens.colors.text.ship} mx-auto mb-4`} />
            <h2 className={`${designTokens.text.h2} mb-2`}>All Shipped!</h2>
            <p className={designTokens.text.bodySecondary}>
              No tasks ready to ship right now. Check back soon or review pending items.
            </p>
            <Link to="/review" className="inline-block mt-6">
              <button className={designTokens.buttons.review}>
                Go to Review Mode
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <>
          {/* Batch Operations Bar */}
          {selectedTasks.size > 0 && (
            <div className={`${designTokens.cards.elevated} p-4 mb-6 flex items-center justify-between`}>
              <div className="flex items-center gap-4">
                <div className={`${designTokens.text.body} font-medium`}>
                  {selectedTasks.size} task{selectedTasks.size > 1 ? 's' : ''} selected
                </div>
                <button
                  onClick={deselectAll}
                  className={designTokens.buttons.ghost}
                >
                  Clear
                </button>
              </div>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleShipSelected}
                  className={`${designTokens.buttons.ship} flex items-center gap-2`}
                  disabled={shipping.size > 0}
                >
                  <Rocket className="h-4 w-4" />
                  Ship Selected ({selectedTasks.size})
                </button>
              </div>
            </div>
          )}

          {/* Quick Wins Pipeline */}
          {quickWins.length > 0 && (!filter || filter === 'quick-wins') && (
            <div className="mb-8">
              <div className={`${designTokens.cards.glass} p-6`}>
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <div className="flex items-center gap-2 mb-2">
                      <Package className={`h-5 w-5 ${designTokens.colors.text.ship}`} />
                      <h2 className={designTokens.text.h2}>Quick Wins Pipeline</h2>
                    </div>
                    <p className={designTokens.text.bodySecondary}>
                      {quickWins.length} low-complexity tasks ready to ship
                    </p>
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      onClick={selectAll}
                      className={designTokens.buttons.secondary}
                    >
                      Select All
                    </button>
                    <button
                      onClick={handleShipAll}
                      className={`${designTokens.buttons.ship} flex items-center gap-2`}
                      disabled={shipping.size > 0}
                    >
                      <Rocket className="h-4 w-4" />
                      Ship All as Batch
                    </button>
                  </div>
                </div>

                <div className="space-y-3">
                  {quickWins.slice(0, 20).map((task) => (
                    <TaskShipCard
                      key={task.id}
                      task={task}
                      onShip={() => handleShipTask(task)}
                      isShipping={shipping.has(task.id)}
                      isSelected={selectedTasks.has(task.id)}
                      onToggleSelect={() => toggleTaskSelection(task.id)}
                    />
                  ))}
                  {quickWins.length > 20 && (
                    <div className={`${designTokens.text.caption} text-center py-2`}>
                      + {quickWins.length - 20} more tasks
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* Features Ready */}
          {readyFeatures.length > 0 && (!filter || filter === 'features') && (
            <div className="mb-8">
              <div className={designTokens.cards.default}>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-6">
                    <div>
                      <div className="flex items-center gap-2 mb-2">
                        <Zap className={`h-5 w-5 ${designTokens.colors.text.build}`} />
                        <h2 className={designTokens.text.h2}>Features Ready</h2>
                      </div>
                      <p className={designTokens.text.bodySecondary}>
                        {readyFeatures.length} evaluated features ready for implementation
                      </p>
                    </div>
                  </div>

                  <div className="space-y-3">
                    {readyFeatures.map((task) => (
                      <FeatureShipCard
                        key={task.id}
                        task={task}
                        onShip={() => handleShipTask(task)}
                        isShipping={shipping.has(task.id)}
                      />
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

interface TaskShipCardProps {
  task: Task
  onShip: () => void
  isShipping: boolean
  isSelected?: boolean
  onToggleSelect?: () => void
}

function TaskShipCard({ task, onShip, isShipping, isSelected, onToggleSelect }: TaskShipCardProps) {
  const evalResult = task.ai_evaluation_simple_result || task.ai_evaluation_advanced_result

  return (
    <div className={`${designTokens.cards.default} ${designTokens.interactions.cardHover} ${
      isSelected ? 'ring-2 ring-green-500' : ''
    }`}>
      <div className="p-4 flex items-center justify-between">
        {onToggleSelect && (
          <input
            type="checkbox"
            checked={isSelected}
            onChange={onToggleSelect}
            className="mr-4 h-4 w-4 rounded border-gray-300 text-green-600 focus:ring-green-500"
          />
        )}
        <div className="flex-1">
          <div className={`${designTokens.text.body} font-medium mb-1`}>
            {task.title}
          </div>
          {task.description && (
            <div className={`${designTokens.text.caption} mb-2 line-clamp-1`}>
              {task.description}
            </div>
          )}
          <div className="flex items-center gap-2 flex-wrap">
            {evalResult?.complexity_score !== undefined && (
              <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.bg.tertiary} rounded`}>
                Complexity: {Math.round(evalResult.complexity_score)}
              </span>
            )}
            {evalResult?.estimated_effort && (
              <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.bg.tertiary} rounded`}>
                {evalResult.estimated_effort}
              </span>
            )}
          </div>
        </div>
        <button
          onClick={onShip}
          disabled={isShipping}
          className={`${designTokens.buttons.ship} flex items-center gap-2 ${designTokens.interactions.disabled}`}
        >
          {isShipping ? 'Shipping...' : (
            <>
              Deploy <ChevronRight className="h-4 w-4" />
            </>
          )}
        </button>
      </div>
    </div>
  )
}

function FeatureShipCard({ task, onShip, isShipping }: TaskShipCardProps) {
  const evalResult = task.ai_evaluation_simple_result || task.ai_evaluation_advanced_result

  return (
    <div className={`${designTokens.cards.default} ${designTokens.interactions.cardHover}`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className={`${designTokens.text.h3} mb-2`}>
              {task.title}
            </div>
            {task.description && (
              <div className={`${designTokens.text.bodySecondary} mb-3`}>
                {task.description}
              </div>
            )}
          </div>
        </div>

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {evalResult?.complexity_score !== undefined && (
              <div>
                <div className={designTokens.text.caption}>Complexity</div>
                <div className={`${designTokens.text.body} font-medium`}>
                  {Math.round(evalResult.complexity_score)}
                </div>
              </div>
            )}
            {evalResult?.estimated_impact && (
              <div>
                <div className={designTokens.text.caption}>Impact</div>
                <div className={`${designTokens.text.body} font-medium ${designTokens.colors.impact.high.text}`}>
                  {evalResult.estimated_impact}
                </div>
              </div>
            )}
            {evalResult?.estimated_effort && (
              <div>
                <div className={designTokens.text.caption}>Effort</div>
                <div className={`${designTokens.text.body} font-medium`}>
                  {evalResult.estimated_effort}
                </div>
              </div>
            )}
          </div>
          <button
            onClick={onShip}
            disabled={isShipping}
            className={`${designTokens.buttons.build} flex items-center gap-2 ${designTokens.interactions.disabled}`}
          >
            {isShipping ? 'Starting...' : (
              <>
                Deploy Now <ChevronRight className="h-4 w-4" />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
