import { useState, useRef, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { createAuthenticatedClient } from "@/lib/client"
import type { Task } from "@adi-simple/types"
import { createTaskConfig, evaluateTaskConfig, implementTaskConfig } from "@adi/api-contracts"
import { useProject } from "@/contexts/ProjectContext"
import { designTokens } from "@/theme/tokens"
import { Bot } from "lucide-react"

interface AITaskChatProps {
  tasks: Task[]
  onRefresh: () => void
}

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  timestamp: Date
  action?: {
    type: 'create_task' | 'evaluate_task' | 'implement_task' | 'schedule_tasks'
    data?: unknown
  }
}

export function AITaskChat({ tasks, onRefresh }: AITaskChatProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: '1',
      role: 'assistant',
      content: "Hi! I'm your AI task assistant. I can help you:\n\n• Create and break down tasks\n• Evaluate task complexity and effort\n• Start AI implementation\n• Schedule and prioritize work\n• Answer questions about your tasks\n\nWhat would you like to do?",
      timestamp: new Date()
    }
  ])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  const handleSend = async () => {
    if (!input.trim() || loading) return

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input,
      timestamp: new Date()
    }

    setMessages(prev => [...prev, userMessage])
    setInput('')
    setLoading(true)

    try {
      // Simple AI command parsing
      const response = await parseAndExecuteCommand(input.toLowerCase())

      const assistantMessage: ChatMessage = {
        id: (Date.now() + 1).toString(),
        role: 'assistant',
        content: response.message,
        timestamp: new Date(),
        action: response.action
      }

      setMessages(prev => [...prev, assistantMessage])

      if (response.refresh) {
        onRefresh()
      }
    } catch (error) {
      console.error('Error processing command:', error)
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 1).toString(),
          role: 'assistant',
          content: `Sorry, I encountered an error: ${error instanceof Error ? error.message : 'Unknown error'}`,
          timestamp: new Date()
        }
      ])
    } finally {
      setLoading(false)
    }
  }

  const parseAndExecuteCommand = async (input: string): Promise<{ message: string; action?: any; refresh?: boolean }> => {
    // Create task
    if (input.includes('create task') || input.includes('add task') || input.includes('new task')) {
      const taskTitle = input.replace(/create task|add task|new task/gi, '').trim()

      if (!taskTitle) {
        return { message: "Sure! What should the task title be?" }
      }

      if (!selectedProjectId) {
        return { message: "Please select a project first before creating tasks." }
      }

      const task = await client.run(createTaskConfig, {
        body: {
          title: taskTitle,
          status: 'open',
          remote_status: 'opened',
          project_id: selectedProjectId,
          manual_task_metadata: { created_via: 'ui' }
        }
      })

      return {
        message: `Created task: "${taskTitle}"\n\nWould you like me to evaluate it now?`,
        action: { type: 'create_task', data: task },
        refresh: true
      }
    }

    // Evaluate tasks
    if (input.includes('evaluate') || input.includes('analyze')) {
      const unevaluatedTasks = tasks.filter(
        t => !t.ai_evaluation_simple_status || t.ai_evaluation_simple_status === 'not_started'
      )

      if (unevaluatedTasks.length === 0) {
        return { message: "All tasks are already evaluated!" }
      }

      if (input.includes('all')) {
        // Evaluate all tasks
        const promises = unevaluatedTasks.slice(0, 10).map(task =>
          client.run(evaluateTaskConfig, { params: { id: task.id } })
        )

        await Promise.all(promises)

        return {
          message: `Started evaluation for ${Math.min(unevaluatedTasks.length, 10)} tasks!\n\nI'm analyzing complexity, effort, and impact. This usually takes 30-60 seconds per task.`,
          refresh: true
        }
      } else {
        // Evaluate first task
        await client.run(evaluateTaskConfig, { params: { id: unevaluatedTasks[0].id } })

        return {
          message: `Started evaluation for: "${unevaluatedTasks[0].title}"\n\nI'm analyzing the codebase to determine complexity and effort. Check back in ~1 minute!`,
          refresh: true
        }
      }
    }

    // Implement tasks
    if (input.includes('implement') || input.includes('build') || input.includes('code')) {
      const readyTasks = tasks.filter(
        t => (t.ai_evaluation_simple_verdict === 'ready' || t.ai_evaluation_advanced_verdict === 'ready') &&
        (!t.ai_implementation_status || t.ai_implementation_status === 'pending')
      )

      if (readyTasks.length === 0) {
        return {
          message: "No tasks are ready for implementation yet.\n\nTip: Evaluate tasks first to determine which ones are ready."
        }
      }

      // Implement highest impact task
      const highImpactTask = readyTasks.find(t => t.ai_evaluation_simple_result?.estimated_impact === 'high') || readyTasks[0]

      await client.run(implementTaskConfig, { params: { id: highImpactTask.id } })

      return {
        message: `Starting AI implementation for: "${highImpactTask.title}"\n\nI'll clone the workspace, make the changes, and create a merge request. This typically takes 3-10 minutes depending on complexity.`,
        refresh: true
      }
    }

    // Task statistics
    if (input.includes('stats') || input.includes('status') || input.includes('how many')) {
      const total = tasks.length
      const evaluated = tasks.filter(t => t.ai_evaluation_simple_status === 'completed').length
      const ready = tasks.filter(t => t.ai_evaluation_simple_verdict === 'ready').length
      const inProgress = tasks.filter(t => t.ai_implementation_status === 'implementing').length
      const completed = tasks.filter(t => t.ai_implementation_status === 'completed').length

      return {
        message: `Task Statistics:\n\n• Total tasks: ${total}\n• Evaluated: ${evaluated}\n• Ready to implement: ${ready}\n• In progress: ${inProgress}\n• Completed: ${completed}\n\nNeed help with anything?`
      }
    }

    // Quick wins
    if (input.includes('quick win') || input.includes('easy') || input.includes('low hanging')) {
      const quickWins = tasks
        .filter(t => {
          const result = t.ai_evaluation_simple_result
          return result?.estimated_effort === 'low' && result?.estimated_impact === 'high'
        })
        .slice(0, 5)

      if (quickWins.length === 0) {
        return {
          message: "No quick wins found yet. Evaluate more tasks to find high-impact, low-effort opportunities!"
        }
      }

      const list = quickWins.map((t, i) => `${i + 1}. ${t.title}`).join('\n')

      return {
        message: `Quick Win Tasks (High Impact, Low Effort):\n\n${list}\n\nWant me to implement one of these?`
      }
    }

    // Schedule optimization
    if (input.includes('schedule') || input.includes('prioritize') || input.includes('order')) {
      const evaluatedTasks = tasks.filter(t => t.ai_evaluation_simple_result)

      if (evaluatedTasks.length === 0) {
        return { message: "Evaluate tasks first, then I can help optimize the schedule!" }
      }

      // Simple prioritization algorithm
      const prioritized = [...evaluatedTasks].sort((a, b) => {
        const scoreA = calculatePriorityScore(a)
        const scoreB = calculatePriorityScore(b)
        return scoreB - scoreA
      })

      const topTasks = prioritized.slice(0, 5).map((t, i) => {
        const score = calculatePriorityScore(t)
        return `${i + 1}. ${t.title} (Score: ${score.toFixed(1)})`
      }).join('\n')

      return {
        message: `Optimized Task Schedule:\n\n${topTasks}\n\nThis ordering maximizes impact while considering effort and complexity.\n\nShall I start with #1?`
      }
    }

    // Default response
    return {
      message: "I can help with:\n\n• **Create task** [title] - Add a new task\n• **Evaluate all** - Analyze all unevaluated tasks\n• **Implement** - Start AI coding on ready tasks\n• **Stats** - Show task statistics\n• **Quick wins** - Find high-impact, low-effort tasks\n• **Schedule** - Optimize task priority\n\nWhat would you like to do?"
    }
  }

  const calculatePriorityScore = (task: Task): number => {
    const result = task.ai_evaluation_simple_result
    if (!result) return 0

    let score = 0

    // Impact weight (high = 10, medium = 5, low = 2)
    const impactScore = result.estimated_impact === 'high' ? 10 : result.estimated_impact === 'medium' ? 5 : 2

    // Effort weight (inverse: xs = 10, s = 8, m = 5, l = 3, xl = 1)
    const effortMap: Record<string, number> = { xs: 10, s: 8, m: 5, l: 3, xl: 1 }
    const effortScore = effortMap[result.effort_estimate || 'm'] || 5

    // Complexity weight (inverse: lower complexity = higher priority)
    const complexityScore = 10 - (result.complexity_score || 50) / 10

    score = impactScore * 0.5 + effortScore * 0.3 + complexityScore * 0.2

    return score
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      handleSend()
    }
  }

  return (
    <div className={`${designTokens.colors.bg.secondary} rounded-lg ${designTokens.borders.default} flex flex-col h-[calc(100vh-200px)]`}>
      {/* Chat header */}
      <div className={`${designTokens.colors.bg.tertiary} px-6 py-4 rounded-t-lg ${designTokens.borders.bottom}`}>
        <div className="flex items-center gap-3">
          <div className="relative">
            <Bot className="h-8 w-8 text-neutral-400" />
            <span className={`absolute bottom-0 right-0 ${designTokens.statusDot} bg-neutral-300 border-2 ${designTokens.colors.border.default}`} />
          </div>
          <div>
            <h2 className={designTokens.text.h2}>AI Task Assistant</h2>
            <p className={designTokens.text.caption}>Powered by Claude • Always ready to help</p>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {messages.map((message) => (
          <div
            key={message.id}
            className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[80%] rounded-lg px-4 py-3 ${
                message.role === 'user'
                  ? 'bg-neutral-600 text-white'
                  : 'bg-neutral-700/50 text-neutral-100'
              }`}
            >
              <p className="text-sm whitespace-pre-wrap">{message.content}</p>
              <p className="text-xs opacity-60 mt-2">
                {message.timestamp.toLocaleTimeString()}
              </p>
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-neutral-700/50 text-neutral-100 rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex gap-1">
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                  <div className="w-2 h-2 bg-neutral-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
                <span className="text-sm">Thinking...</span>
              </div>
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Input */}
      <div className="p-4 border-t border-neutral-700/50">
        <div className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyPress={handleKeyPress}
            placeholder="Ask me anything about your tasks..."
            disabled={loading}
            className="flex-1 bg-neutral-700/50 text-white placeholder-neutral-400 px-4 py-3 rounded-lg border border-neutral-600/50 focus:outline-none focus:border-neutral-500 transition-colors disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={loading || !input.trim()}
            className="px-6 py-3 bg-neutral-600 hover:bg-neutral-700 disabled:bg-neutral-600 disabled:cursor-not-allowed text-white rounded-lg transition-colors font-medium"
          >
            Send
          </button>
        </div>

        {/* Quick suggestions */}
        <div className="flex gap-2 mt-3 flex-wrap">
          <QuickAction onClick={() => setInput('evaluate all tasks')} label="Evaluate All" />
          <QuickAction onClick={() => setInput('show quick wins')} label="Quick Wins" />
          <QuickAction onClick={() => setInput('implement ready tasks')} label="Auto-Implement" />
          <QuickAction onClick={() => setInput('show stats')} label="Statistics" />
        </div>
      </div>
    </div>
  )
}

function QuickAction({ onClick, label }: { onClick: () => void; label: string }) {
  return (
    <button
      onClick={onClick}
      className="px-3 py-1.5 text-xs bg-neutral-700/50 hover:bg-neutral-600/50 text-neutral-300 rounded-md transition-colors border border-neutral-600/30"
    >
      {label}
    </button>
  )
}
