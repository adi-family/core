import { useState, useCallback, useMemo, useEffect } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Link } from "react-router-dom"
import { KanbanBoard } from "@/components/KanbanBoard"
import { useProject } from "@/contexts/ProjectContext"
import { createAuthenticatedClient } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import { toast } from "sonner"
import type { Task } from "@adi-simple/types"
import { listTasksConfig } from "@adi/api-contracts"
import { Plus, Bot, BarChart, Zap } from "lucide-react"

export function BuilderBoardPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
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
      setTasks(Array.isArray(data) ? data : (data as unknown).data || [])
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
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  if (!selectedProjectId) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
        <div className="flex items-center justify-center h-96">
          <div className="text-center">
            <p className="text-neutral-400 text-lg mb-4">No project selected</p>
            <p className="text-neutral-500 text-sm">Select a project to view the builder board</p>
          </div>
        </div>
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
          <Zap className={`h-8 w-8 ${designTokens.colors.text.build}`} />
          <h1 className={designTokens.text.mode}>Build Mode</h1>
        </div>
        <p className={designTokens.text.bodySecondary}>
          Focus on complex features requiring expertise
        </p>
      </div>

      {/* View content */}
      {loading && tasks.length === 0 ? (
        <div className="flex items-center justify-center h-96">
          <div className={designTokens.text.bodySecondary}>Loading tasks...</div>
        </div>
      ) : (
        <KanbanBoard tasks={tasks} onTasksChange={setTasks} onRefresh={fetchTasks} />
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
              className={`w-full px-6 py-4 bg-transparent ${designTokens.colors.text.primary} placeholder-neutral-400 ${designTokens.interactions.focus} ${designTokens.borders.bottom}`}
              autoFocus
            />
            <div className="p-2 max-h-96 overflow-y-auto">
              <div className={`${designTokens.text.caption} px-4 py-2`}>QUICK ACTIONS</div>
              <CommandOption icon={<Plus className="h-4 w-4" />} text="Create new task" shortcut="C" />
              <CommandOption icon={<Bot className="h-4 w-4" />} text="Start AI implementation" shortcut="I" />
              <CommandOption icon={<BarChart className="h-4 w-4" />} text="View analytics" shortcut="A" />
              <CommandOption icon={<Zap className="h-4 w-4" />} text="Evaluate all tasks" shortcut="E" />
            </div>
          </div>
        </div>
      )}
    </div>
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
