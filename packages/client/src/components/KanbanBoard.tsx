import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { createAuthenticatedClient } from "@/lib/client"
import { toast } from "sonner"
import type { Task } from "@adi-simple/types"
import { updateTaskConfig, evaluateTaskConfig, implementTaskConfig } from "@adi/api-contracts"
import { navigateTo } from "@/utils/navigation"
import { designTokens } from "@/theme/tokens"
import { Inbox, CheckCircle, Zap, Eye } from "lucide-react"

interface KanbanBoardProps {
  tasks: Task[]
  onTasksChange: (tasks: Task[]) => void
  onRefresh: () => void
}

type KanbanColumn = 'backlog' | 'ready' | 'in-progress' | 'review' | 'done'

interface ColumnConfig {
  id: KanbanColumn
  title: string
  color: string
  icon: React.ReactNode
}

const columns: ColumnConfig[] = [
  { id: 'backlog', title: 'Backlog', color: 'bg-gray-700', icon: <Inbox className="h-4 w-4" /> },
  { id: 'ready', title: 'Ready', color: 'bg-blue-700', icon: <CheckCircle className="h-4 w-4" /> },
  { id: 'in-progress', title: 'In Progress', color: 'bg-yellow-700', icon: <Zap className="h-4 w-4" /> },
  { id: 'review', title: 'Review', color: 'bg-purple-700', icon: <Eye className="h-4 w-4" /> },
  { id: 'done', title: 'Done', color: 'bg-green-700', icon: <CheckCircle className="h-4 w-4" /> }
]

export function KanbanBoard({ tasks, _onTasksChange, _onRefresh }: KanbanBoardProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [draggedTask, setDraggedTask] = useState<Task | null>(null)
  const [hoveredColumn, setHoveredColumn] = useState<KanbanColumn | null>(null)

  // Map task status to kanban column
  const getColumnForTask = (task: Task): KanbanColumn => {
    // Check implementation status first
    if (task.ai_implementation_status === 'completed') return 'done'
    if (task.ai_implementation_status === 'implementing' || task.ai_implementation_status === 'queued') return 'in-progress'

    // Check evaluation status
    if (task.ai_evaluation_simple_status === 'completed' || task.ai_evaluation_advanced_status === 'completed') {
      if (task.ai_evaluation_simple_verdict === 'ready' || task.ai_evaluation_advanced_verdict === 'ready') {
        return 'ready'
      }
    }

    // Default to backlog
    return 'backlog'
  }

  // Group tasks by column
  const tasksByColumn = useMemo(() => {
    const grouped: Record<KanbanColumn, Task[]> = {
      backlog: [],
      ready: [],
      'in-progress': [],
      review: [],
      done: []
    }

    tasks.forEach(task => {
      const column = getColumnForTask(task)
      grouped[column].push(task)
    })

    return grouped
  }, [tasks])

  const handleDragStart = (task: Task) => {
    setDraggedTask(task)
  }

  const handleDragOver = (e: React.DragEvent, column: KanbanColumn) => {
    e.preventDefault()
    setHoveredColumn(column)
  }

  const handleDrop = async (column: KanbanColumn) => {
    if (!draggedTask) return

    // Determine what action to take based on column
    try {
      if (column === 'ready' && draggedTask.ai_evaluation_simple_status !== 'completed') {
        // Evaluate task
        await client.run(evaluateTaskConfig, { params: { id: draggedTask.id } })
        toast.success('Task evaluation started')
      } else if (column === 'in-progress' && draggedTask.ai_implementation_status !== 'implementing') {
        // Start implementation
        await client.run(implementTaskConfig, { params: { id: draggedTask.id } })
        toast.success('Implementation started')
      } else if (column === 'done' && draggedTask.status !== 'closed') {
        // Mark as done
        await client.run(updateTaskConfig, {
          params: { id: draggedTask.id },
          body: { status: 'closed', remote_status: 'closed' }
        })
        toast.success('Task marked as done')
      }

      onRefresh()
    } catch (error) {
      console.error('Error updating task:', error)
      toast.error('Failed to update task')
    } finally {
      setDraggedTask(null)
      setHoveredColumn(null)
    }
  }

  const handleEvaluate = async (task: Task) => {
    try {
      await client.run(evaluateTaskConfig, { params: { id: task.id } })
      toast.success('Evaluation started')
      onRefresh()
    } catch (error) {
      toast.error('Failed to start evaluation')
    }
  }

  const handleImplement = async (task: Task) => {
    try {
      await client.run(implementTaskConfig, { params: { id: task.id } })
      toast.success('Implementation started')
      onRefresh()
    } catch (error) {
      toast.error('Failed to start implementation')
    }
  }

  return (
    <div className="space-y-3 pb-4">
      {columns.map(column => (
        <div
          key={column.id}
          className={`${designTokens.colors.bg.secondary} rounded-lg ${designTokens.borders.default} ${
            hoveredColumn === column.id ? 'border-[#5e6ad2]' : ''
          } transition-colors`}
          onDragOver={(e) => handleDragOver(e, column.id)}
          onDrop={() => handleDrop(column.id)}
          onDragLeave={() => setHoveredColumn(null)}
        >
          {/* Row header */}
          <div className={`${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary} px-4 py-3 rounded-t-lg flex items-center justify-between ${designTokens.borders.bottom}`}>
            <div className="flex items-center gap-2">
              <span className={designTokens.text.body}>{column.icon}</span>
              <h3 className={designTokens.text.h3}>{column.title}</h3>
            </div>
            <span className={`${designTokens.text.caption} ${designTokens.colors.bg.primary} px-2 py-0.5 rounded-full`}>
              {tasksByColumn[column.id].length}
            </span>
          </div>

          {/* Row content - horizontal scroll */}
          <div className="p-3 overflow-x-auto">
            {tasksByColumn[column.id].length === 0 ? (
              <div className={`text-center ${designTokens.text.bodySecondary} py-8`}>
                No tasks
              </div>
            ) : (
              <div className="flex gap-3 pb-2">
                {tasksByColumn[column.id].map(task => (
                  <KanbanCard
                    key={task.id}
                    task={task}
                    onDragStart={() => handleDragStart(task)}
                    onEvaluate={() => handleEvaluate(task)}
                    onImplement={() => handleImplement(task)}
                    onClick={() => navigateTo(`/tasks/${task.id}`)}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

interface KanbanCardProps {
  task: Task
  onDragStart: () => void
  onEvaluate: () => void
  onImplement: () => void
  onClick: () => void
}

function KanbanCard({ task, onDragStart, onEvaluate, onImplement, onClick }: KanbanCardProps) {
  const evalResult = task.ai_evaluation_simple_result
  const canImplement = task.ai_evaluation_simple_verdict === 'ready' || task.ai_evaluation_advanced_verdict === 'ready'

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`flex-shrink-0 w-72 ${designTokens.colors.bg.primary} ${designTokens.interactions.hover} ${designTokens.borders.default} rounded-lg p-3 cursor-pointer group`}
    >
      <h4 className={`${designTokens.text.body} font-medium mb-2 line-clamp-2`}>
        {task.title}
      </h4>

      {task.description && (
        <p className={`${designTokens.text.caption} mb-2 line-clamp-2`}>
          {task.description}
        </p>
      )}

      {/* Evaluation metrics */}
      {evalResult && (
        <div className="flex items-center gap-2 mb-2 flex-wrap">
          {evalResult.complexity_score !== undefined && (
            <span className={`${designTokens.text.caption} ${designTokens.colors.bg.tertiary} px-2 py-0.5 rounded`}>
              Complexity: {Math.round(evalResult.complexity_score)}
            </span>
          )}
          {evalResult.estimated_effort && (
            <span className={`${designTokens.text.caption} ${designTokens.colors.bg.tertiary} px-2 py-0.5 rounded`}>
              {evalResult.estimated_effort.toUpperCase()}
            </span>
          )}
          {evalResult.estimated_impact && (
            <span className={`${designTokens.text.caption} ${designTokens.colors.bg.tertiary} px-2 py-0.5 rounded`}>
              Impact: {evalResult.estimated_impact}
            </span>
          )}
        </div>
      )}

      {/* Status indicators with dots */}
      <div className="flex items-center gap-2 flex-wrap mb-2">
        {task.ai_evaluation_simple_status === 'evaluating' && (
          <div className="flex items-center gap-1">
            <div className={`${designTokens.statusDot} ${designTokens.colors.status.info} animate-pulse`} />
            <span className={designTokens.text.caption}>Evaluating</span>
          </div>
        )}
        {task.ai_implementation_status === 'implementing' && (
          <div className="flex items-center gap-1">
            <div className={`${designTokens.statusDot} ${designTokens.colors.status.warning} animate-pulse`} />
            <span className={designTokens.text.caption}>Implementing</span>
          </div>
        )}
      </div>

      {/* Quick actions (show on hover) */}
      <div className="flex gap-2 mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
        {!task.ai_evaluation_simple_status || task.ai_evaluation_simple_status === 'not_started' ? (
          <button
            onClick={(e) => { e.stopPropagation(); onEvaluate() }}
            className={`${designTokens.text.caption} ${designTokens.colors.accent.primary} hover:${designTokens.colors.accent.hover} ${designTokens.colors.text.primary} px-2 py-1 rounded transition-colors`}
          >
            Evaluate
          </button>
        ) : null}
        {canImplement && (!task.ai_implementation_status || task.ai_implementation_status === 'pending') && (
          <button
            onClick={(e) => { e.stopPropagation(); onImplement() }}
            className={`${designTokens.text.caption} bg-green-600 hover:bg-green-700 ${designTokens.colors.text.primary} px-2 py-1 rounded transition-colors`}
          >
            Implement
          </button>
        )}
      </div>
    </div>
  )
}
