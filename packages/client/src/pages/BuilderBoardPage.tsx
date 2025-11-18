import { useState, useCallback, useMemo, useEffect } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Link } from "react-router-dom"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import { KanbanBoard } from "@/components/KanbanBoard"
import { TimelineView } from "@/components/TimelineView"
import { AITaskChat } from "@/components/AITaskChat"
import { useProject } from "@/contexts/ProjectContext"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { toast } from "sonner"
import type { Task } from "@adi-simple/types"
import { listTasksConfig } from "@adi/api-contracts"
import { Plus, Bot, BarChart, Zap, Columns, CalendarDays, MessageCircle } from "lucide-react"

type ViewMode = 'kanban' | 'timeline' | 'ai-chat'

export function BuilderBoardPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const [viewMode, setViewMode] = useState<ViewMode>('kanban')
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)
  const [commandPalette, setCommandPalette] = useState(false)

  const fetchTasks = useCallback(async () => {
    if (!selectedProjectId) return

    setLoading(true)
    try {
      const data = await client.run(listTasksConfig, {
        query: { project_id: selectedProjectId }
      })
      setTasks(Array.isArray(data) ? data : (data as any).data || [])
    } catch (error) {
      console.error("Error fetching tasks:", error)
      toast.error("Failed to fetch tasks")
    } finally {
      setLoading(false)
    }
  }, [client, selectedProjectId])

  useEffect(() => {
    fetchTasks()
  }, [fetchTasks])

  // Keyboard shortcuts - Linear-style command palette
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Cmd/Ctrl + K for command palette
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setCommandPalette(prev => !prev)
      }
      // Cmd/Ctrl + 1/2/3 for view switching
      if (e.metaKey || e.ctrlKey) {
        if (e.key === '1') {
          e.preventDefault()
          setViewMode('kanban')
        } else if (e.key === '2') {
          e.preventDefault()
          setViewMode('timeline')
        } else if (e.key === '3') {
          e.preventDefault()
          setViewMode('ai-chat')
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!selectedProjectId) {
    return (
      <AnimatedPageContainer>
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <p className="text-gray-400 text-lg mb-4">No project selected</p>
            <p className="text-gray-500 text-sm">Select a project to view the builder board</p>
          </div>
        </div>
      </AnimatedPageContainer>
    )
  }

  return (
    <AnimatedPageContainer>
      {/* Header */}
      <div className="mb-8">
        <Link to="/" className={`${designTokens.text.caption} ${designTokens.colors.text.secondary} hover:${designTokens.colors.text.primary} mb-2 inline-block`}>
          ← Back to Command Center
        </Link>
        <div className="flex items-center gap-3 mb-2">
          <Zap className={`h-8 w-8 ${designTokens.colors.text.build}`} />
          <h1 className={designTokens.text.mode}>Build Mode</h1>
        </div>
        <p className={`${designTokens.text.bodySecondary}`}>
          Focus on complex features requiring expertise
        </p>
      </div>

      {/* View switcher and actions */}
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          {/* View mode switcher - minimalist tabs */}
          <div className={`flex items-center gap-1 ${designTokens.colors.bg.secondary} rounded-lg p-1 ${designTokens.borders.default}`}>
            <button
              onClick={() => setViewMode('kanban')}
              className={`px-3 py-1.5 ${designTokens.text.body} font-medium rounded-md transition-colors ${
                viewMode === 'kanban'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              Board
            </button>
            <button
              onClick={() => setViewMode('timeline')}
              className={`px-3 py-1.5 ${designTokens.text.body} font-medium rounded-md transition-colors ${
                viewMode === 'timeline'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              Timeline
            </button>
            <button
              onClick={() => setViewMode('ai-chat')}
              className={`px-3 py-1.5 ${designTokens.text.body} font-medium rounded-md transition-colors ${
                viewMode === 'ai-chat'
                  ? `${designTokens.colors.bg.tertiary} ${designTokens.colors.text.primary}`
                  : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`
              }`}
            >
              <span className="flex items-center gap-2">
                AI Assistant
                <span className={`${designTokens.statusDot} bg-green-400 animate-pulse`} />
              </span>
            </button>
          </div>
        </div>

        {/* Quick actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setCommandPalette(true)}
            className={`flex items-center gap-2 px-3 py-1.5 ${designTokens.text.body} ${designTokens.colors.text.secondary} ${designTokens.colors.bg.secondary} ${designTokens.interactions.hover} ${designTokens.borders.default} rounded-lg`}
          >
            <kbd className={designTokens.kbd}>⌘K</kbd>
            <span>Quick actions</span>
          </button>

          <button
            onClick={fetchTasks}
            disabled={loading}
            className={`px-3 py-1.5 ${designTokens.text.body} ${designTokens.colors.text.secondary} ${designTokens.colors.bg.secondary} ${designTokens.interactions.hover} ${designTokens.borders.default} rounded-lg ${designTokens.interactions.disabled}`}
          >
            {loading ? 'Refreshing...' : 'Refresh'}
          </button>
        </div>
      </div>

      {/* View content */}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className={designTokens.text.bodySecondary}>Loading tasks...</div>
        </div>
      ) : (
        <>
          {viewMode === 'kanban' && (
            <KanbanBoard tasks={tasks} onTasksChange={setTasks} onRefresh={fetchTasks} />
          )}
          {viewMode === 'timeline' && (
            <TimelineView tasks={tasks} onRefresh={fetchTasks} />
          )}
          {viewMode === 'ai-chat' && (
            <AITaskChat tasks={tasks} onRefresh={fetchTasks} />
          )}
        </>
      )}

      {/* Command Palette - Linear-style */}
      {commandPalette && (
        <div
          className="fixed inset-0 bg-black/50 z-50 flex items-start justify-center pt-32"
          onClick={() => setCommandPalette(false)}
        >
          <div
            className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default} rounded-lg shadow-2xl w-full max-w-2xl`}
            onClick={(e) => e.stopPropagation()}
          >
            <input
              type="text"
              placeholder="Type a command or search..."
              className={`w-full px-6 py-4 bg-transparent ${designTokens.colors.text.primary} placeholder-gray-400 ${designTokens.interactions.focus} ${designTokens.borders.bottom}`}
              autoFocus
            />
            <div className="p-2 max-h-96 overflow-y-auto">
              <div className={`${designTokens.text.caption} px-4 py-2`}>QUICK ACTIONS</div>
              <CommandOption icon={<Plus className="h-4 w-4" />} text="Create new task" shortcut="C" />
              <CommandOption icon={<Bot className="h-4 w-4" />} text="Start AI implementation" shortcut="I" />
              <CommandOption icon={<BarChart className="h-4 w-4" />} text="View analytics" shortcut="A" />
              <CommandOption icon={<Zap className="h-4 w-4" />} text="Evaluate all tasks" shortcut="E" />

              <div className={`${designTokens.text.caption} px-4 py-2 mt-2`}>VIEWS</div>
              <CommandOption icon={<Columns className="h-4 w-4" />} text="Board view" shortcut="⌘1" onClick={() => { setViewMode('kanban'); setCommandPalette(false) }} />
              <CommandOption icon={<CalendarDays className="h-4 w-4" />} text="Timeline view" shortcut="⌘2" onClick={() => { setViewMode('timeline'); setCommandPalette(false) }} />
              <CommandOption icon={<MessageCircle className="h-4 w-4" />} text="AI Chat" shortcut="⌘3" onClick={() => { setViewMode('ai-chat'); setCommandPalette(false) }} />
            </div>
          </div>
        </div>
      )}
    </AnimatedPageContainer>
  )
}

function CommandOption({ icon, text, shortcut, onClick }: { icon: React.ReactNode; text: string; shortcut?: string; onClick?: () => void }) {
  return (
    <button
      onClick={onClick}
      className={`w-full flex items-center justify-between px-4 py-2.5 ${designTokens.colors.text.secondary} ${designTokens.interactions.hover} rounded-lg text-left`}
    >
      <div className="flex items-center gap-3">
        <span className={designTokens.text.body}>{icon}</span>
        <span className={designTokens.text.body}>{text}</span>
      </div>
      {shortcut && (
        <kbd className={designTokens.kbd}>
          {shortcut}
        </kbd>
      )}
    </button>
  )
}
