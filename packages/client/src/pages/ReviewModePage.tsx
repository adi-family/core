import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { Link, useNavigate } from "react-router-dom"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { useProject } from "@/contexts/ProjectContext"
import { Search, MessageCircle, CheckCircle, X, AlertCircle, TrendingUp } from "lucide-react"
import { toast } from "sonner"
import {
  tasksStore,
  fetchTasks,
  deleteTask,
} from "@/stores"
import { evaluateTaskConfig } from "@adi/api-contracts"
import type { Task } from "@adi-simple/types"

type FilterType = 'all' | 'high-impact' | 'quick-wins' | 'risks'
type SortType = 'confidence' | 'complexity' | 'impact' | 'created'

export function ReviewModePage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const { tasks } = useSnapshot(tasksStore)
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<FilterType>('all')
  const [sort, setSort] = useState<SortType>('confidence')
  const [evaluating, setEvaluating] = useState<Set<string>>(new Set())

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

  // Get tasks that need review (not evaluated yet)
  const needsReview = useMemo(() => {
    return projectTasks.filter(task => {
      const noEvaluation = !task.ai_evaluation_simple_status || task.ai_evaluation_simple_status === 'not_started'
      return noEvaluation
    })
  }, [projectTasks])

  // Apply filters and sorting
  const filteredTasks = useMemo(() => {
    let result = [...needsReview]

    // Apply filters (placeholder - would need more task metadata)
    if (filter === 'high-impact') {
      // Filter by tasks with certain keywords or labels
      result = result.filter(t => t.title.toLowerCase().includes('feature') || t.title.toLowerCase().includes('critical'))
    } else if (filter === 'quick-wins') {
      // Filter by simpler tasks
      result = result.filter(t => !t.title.toLowerCase().includes('complex') && !t.title.toLowerCase().includes('refactor'))
    } else if (filter === 'risks') {
      // Filter by potential risks
      result = result.filter(t => t.title.toLowerCase().includes('security') || t.title.toLowerCase().includes('bug'))
    }

    // Apply sorting
    result.sort((a, b) => {
      switch (sort) {
        case 'created':
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        case 'complexity':
          // Placeholder - would use actual complexity from eval
          return a.title.length - b.title.length
        default:
          return 0
      }
    })

    return result
  }, [needsReview, filter, sort])

  const handleEvaluate = async (task: Task) => {
    setEvaluating(prev => new Set(prev).add(task.id))
    try {
      await client.run(evaluateTaskConfig, { params: { id: task.id } })
      toast.success('Evaluation started')
      await fetchTasks(client)
    } catch (error) {
      console.error('Failed to evaluate:', error)
      toast.error('Failed to start evaluation')
    } finally {
      setEvaluating(prev => {
        const next = new Set(prev)
        next.delete(task.id)
        return next
      })
    }
  }

  const handleReject = async (task: Task) => {
    if (!confirm(`Archive "${task.title}"? This action cannot be undone.`)) {
      return
    }

    try {
      await deleteTask(client, task.id)
      toast.success('Task archived')
    } catch (error) {
      console.error('Failed to delete:', error)
      toast.error('Failed to archive task')
    }
  }

  const handleDiscuss = (task: Task) => {
    navigate(`/tasks/${task.id}`)
  }

  if (loading) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center`}>
        <div className={designTokens.text.bodySecondary}>Loading Review Mode...</div>
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
          <Search className={`h-8 w-8 ${designTokens.colors.text.review}`} />
          <h1 className={designTokens.text.mode}>Review Mode</h1>
        </div>
        <p className={`${designTokens.text.bodySecondary}`}>
          Analyze code, evaluate priorities, make decisions
        </p>
      </div>

      {/* Filters */}
      <div className={`${designTokens.cards.glass} p-6 mb-8`}>
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className={`${designTokens.text.h3} mb-1`}>
              Inbox: {filteredTasks.length} items need your review
            </div>
            <div className={designTokens.text.caption}>
              Total pending: {needsReview.length}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className={designTokens.text.label}>Filter:</span>
            <button
              onClick={() => setFilter('all')}
              className={`px-3 py-1.5 rounded-lg ${designTokens.text.body} transition-colors ${
                filter === 'all'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              All
            </button>
            <button
              onClick={() => setFilter('high-impact')}
              className={`px-3 py-1.5 rounded-lg ${designTokens.text.body} transition-colors ${
                filter === 'high-impact'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              High Impact
            </button>
            <button
              onClick={() => setFilter('quick-wins')}
              className={`px-3 py-1.5 rounded-lg ${designTokens.text.body} transition-colors ${
                filter === 'quick-wins'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              Quick Wins
            </button>
            <button
              onClick={() => setFilter('risks')}
              className={`px-3 py-1.5 rounded-lg ${designTokens.text.body} transition-colors ${
                filter === 'risks'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              Risks
            </button>
          </div>

          <div className="flex items-center gap-2 ml-auto">
            <span className={designTokens.text.label}>Sort:</span>
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortType)}
              className={`px-3 py-1.5 rounded-lg ${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary} ${designTokens.borders.default} ${designTokens.text.body}`}
            >
              <option value="confidence">AI Confidence</option>
              <option value="complexity">Complexity</option>
              <option value="impact">Impact</option>
              <option value="created">Date Created</option>
            </select>
          </div>
        </div>
      </div>

      {/* Task List */}
      {filteredTasks.length === 0 ? (
        <div className={designTokens.cards.default}>
          <div className="p-12 text-center">
            <CheckCircle className={`h-16 w-16 ${designTokens.colors.text.ship} mx-auto mb-4`} />
            <h2 className={`${designTokens.text.h2} mb-2`}>Inbox Zero!</h2>
            <p className={designTokens.text.bodySecondary}>
              All tasks have been reviewed. Great work!
            </p>
            <Link to="/" className="inline-block mt-6">
              <button className={designTokens.buttons.primary}>
                Back to Command Center
              </button>
            </Link>
          </div>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredTasks.map((task) => (
            <ReviewCard
              key={task.id}
              task={task}
              onEvaluate={() => handleEvaluate(task)}
              onReject={() => handleReject(task)}
              onDiscuss={() => handleDiscuss(task)}
              isEvaluating={evaluating.has(task.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

interface ReviewCardProps {
  task: Task
  onEvaluate: () => void
  onReject: () => void
  onDiscuss: () => void
  isEvaluating: boolean
}

function ReviewCard({ task, onEvaluate, onReject, onDiscuss, isEvaluating }: ReviewCardProps) {
  // Determine if task looks critical based on title/description
  const isCritical = task.title.toLowerCase().includes('security') ||
                     task.title.toLowerCase().includes('critical') ||
                     task.title.toLowerCase().includes('urgent')

  const isHighImpact = task.title.toLowerCase().includes('feature') ||
                       task.title.toLowerCase().includes('improvement')

  return (
    <div className={`${designTokens.cards.default} ${designTokens.interactions.cardHover} ${
      isCritical ? designTokens.colors.border.ship : ''
    }`}>
      <div className="p-6">
        <div className="flex items-start justify-between mb-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              {isCritical && (
                <AlertCircle className={`h-5 w-5 ${designTokens.colors.status.blocked}`} />
              )}
              {isHighImpact && !isCritical && (
                <TrendingUp className={`h-5 w-5 ${designTokens.colors.impact.high.text}`} />
              )}
              <h3 className={designTokens.text.h3}>{task.title}</h3>
            </div>
            {task.description && (
              <p className={`${designTokens.text.bodySecondary} mb-3`}>
                {task.description}
              </p>
            )}
            <div className="flex items-center gap-2">
              {isCritical && (
                <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.status.blocked} text-white rounded`}>
                  CRITICAL
                </span>
              )}
              {isHighImpact && !isCritical && (
                <span className={`${designTokens.text.caption} px-2 py-0.5 ${designTokens.colors.impact.high.bg} text-white rounded`}>
                  High Impact
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={onDiscuss}
            className={`${designTokens.buttons.ghost} flex items-center gap-2`}
          >
            <MessageCircle className="h-4 w-4" />
            Discuss with AI
          </button>
          <button
            onClick={onEvaluate}
            disabled={isEvaluating}
            className={`${designTokens.buttons.review} flex items-center gap-2 ${designTokens.interactions.disabled}`}
          >
            <CheckCircle className="h-4 w-4" />
            {isEvaluating ? 'Evaluating...' : 'Approve & Build'}
          </button>
          <button
            onClick={onReject}
            className={`${designTokens.buttons.ghost} flex items-center gap-2 hover:text-red-400`}
          >
            <X className="h-4 w-4" />
            Archive
          </button>
        </div>
      </div>
    </div>
  )
}
