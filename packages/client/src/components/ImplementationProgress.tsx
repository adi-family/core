import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { createAuthenticatedClient } from "@/lib/client"
import type { Task } from "@adi-simple/types"
import type { Session, Message, PipelineArtifact } from "@adi-simple/types"
import { CheckCircle, XCircle, GitMerge, FileText, GitBranch } from "lucide-react"

interface ImplementationProgressProps {
  task: Task
  onComplete?: () => void
}

interface ProgressPhase {
  name: string
  status: 'pending' | 'active' | 'completed' | 'failed'
  description?: string
  timestamp?: Date
}

export function ImplementationProgress({ task, onComplete }: ImplementationProgressProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [session, setSession] = useState<Session | null>(null)
  const [messages, setMessages] = useState<Message[]>([])
  const [artifacts, setArtifacts] = useState<PipelineArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [pollingInterval, setPollingInterval] = useState<NodeJS.Timeout | null>(null)

  // Fetch session and progress data
  const fetchProgress = async () => {
    if (!task.ai_implementation_session_id) return

    try {
      // Fetch session details
      const sessionResponse = await client.run({
        method: 'GET',
        url: `/api/sessions/${task.ai_implementation_session_id}`
      } as any)
      setSession(sessionResponse)

      // Fetch messages
      const messagesResponse = await client.run({
        method: 'GET',
        url: `/api/tasks/${task.id}/sessions`
      } as any)
      setMessages(messagesResponse || [])

      // Fetch artifacts
      const artifactsResponse = await client.run({
        method: 'GET',
        url: `/api/tasks/${task.id}/artifacts`
      } as any)
      setArtifacts(artifactsResponse || [])

      setLoading(false)

      // Stop polling if completed or failed
      if (sessionResponse.status === 'completed' || sessionResponse.status === 'failed') {
        if (pollingInterval) {
          clearInterval(pollingInterval)
          setPollingInterval(null)
        }
        if (onComplete) {
          onComplete()
        }
      }
    } catch (error) {
      console.error('Error fetching progress:', error)
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!task.ai_implementation_session_id) return

    // Initial fetch
    fetchProgress()

    // Poll every 5 seconds if in progress
    if (task.ai_implementation_status === 'implementing' || task.ai_implementation_status === 'queued') {
      const interval = setInterval(fetchProgress, 5000)
      setPollingInterval(interval)

      return () => {
        clearInterval(interval)
      }
    }
  }, [task.ai_implementation_session_id, task.ai_implementation_status])

  // Calculate progress phases
  const phases: ProgressPhase[] = useMemo(() => {
    const basePhases: ProgressPhase[] = [
      { name: 'Queue', status: 'completed', description: 'Task added to queue' },
      { name: 'Setup', status: 'pending', description: 'Cloning workspace and preparing environment' },
      { name: 'Analysis', status: 'pending', description: 'Analyzing codebase and requirements' },
      { name: 'Implementation', status: 'pending', description: 'Writing code and making changes' },
      { name: 'Testing', status: 'pending', description: 'Running tests and validation' },
      { name: 'Finalization', status: 'pending', description: 'Creating commit and push' }
    ]

    if (!task.ai_implementation_status || task.ai_implementation_status === 'pending') {
      return basePhases
    }

    if (task.ai_implementation_status === 'queued') {
      basePhases[0].status = 'active'
      return basePhases
    }

    if (task.ai_implementation_status === 'implementing') {
      basePhases[0].status = 'completed'

      // Infer phase from messages
      const hasSetupComplete = messages.some(m => m.data && typeof m.data === 'object' && 'workspace_cloned' in m.data)
      const hasAnalysisComplete = messages.some(m => m.data && typeof m.data === 'object' && 'analysis_complete' in m.data)
      const hasCodeChanges = messages.some(m => m.data && typeof m.data === 'object' && 'files_changed' in m.data)

      if (hasCodeChanges) {
        basePhases[1].status = 'completed'
        basePhases[2].status = 'completed'
        basePhases[3].status = 'active'
      } else if (hasAnalysisComplete) {
        basePhases[1].status = 'completed'
        basePhases[2].status = 'active'
      } else if (hasSetupComplete) {
        basePhases[1].status = 'active'
      } else {
        basePhases[1].status = 'active'
      }

      return basePhases
    }

    if (task.ai_implementation_status === 'completed') {
      return basePhases.map(p => ({ ...p, status: 'completed' as const }))
    }

    if (task.ai_implementation_status === 'failed') {
      const activeIndex = basePhases.findIndex(p => p.status === 'active')
      if (activeIndex !== -1) {
        basePhases[activeIndex].status = 'failed'
      }
      return basePhases
    }

    return basePhases
  }, [task.ai_implementation_status, messages])

  if (!task.ai_implementation_session_id) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6 text-center">
        <p className="text-gray-400">No implementation in progress</p>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6 text-center">
        <p className="text-gray-400">Loading progress...</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Progress header */}
      <div className="bg-gradient-to-r from-blue-900/50 to-purple-900/50 rounded-lg border border-slate-700/50 p-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white mb-1">
              AI Implementation Progress
            </h3>
            <p className="text-sm text-gray-300">
              Status: <span className="font-medium">{task.ai_implementation_status}</span>
            </p>
          </div>

          {task.ai_implementation_status === 'implementing' && (
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-blue-400 rounded-full animate-pulse" />
              <span className="text-sm text-blue-300">In Progress</span>
            </div>
          )}

          {task.ai_implementation_status === 'completed' && (
            <div className="flex items-center gap-2">
              <CheckCircle className="h-6 w-6 text-green-400" />
              <span className="text-sm text-green-300">Completed</span>
            </div>
          )}

          {task.ai_implementation_status === 'failed' && (
            <div className="flex items-center gap-2">
              <XCircle className="h-6 w-6 text-red-400" />
              <span className="text-sm text-red-300">Failed</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress phases */}
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
        <div className="space-y-4">
          {phases.map((phase, index) => (
            <div key={phase.name} className="flex items-start gap-4">
              {/* Status indicator */}
              <div className="flex-shrink-0 mt-1">
                {phase.status === 'completed' && (
                  <div className="w-6 h-6 bg-green-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✓</span>
                  </div>
                )}
                {phase.status === 'active' && (
                  <div className="w-6 h-6 bg-blue-600 rounded-full flex items-center justify-center">
                    <div className="w-3 h-3 bg-white rounded-full animate-pulse" />
                  </div>
                )}
                {phase.status === 'failed' && (
                  <div className="w-6 h-6 bg-red-600 rounded-full flex items-center justify-center">
                    <span className="text-white text-xs">✗</span>
                  </div>
                )}
                {phase.status === 'pending' && (
                  <div className="w-6 h-6 bg-gray-600 rounded-full" />
                )}
              </div>

              {/* Phase info */}
              <div className="flex-1">
                <h4 className={`font-medium ${
                  phase.status === 'active' ? 'text-blue-300' :
                  phase.status === 'completed' ? 'text-green-300' :
                  phase.status === 'failed' ? 'text-red-300' :
                  'text-gray-400'
                }`}>
                  {phase.name}
                </h4>
                {phase.description && (
                  <p className="text-sm text-gray-500 mt-0.5">{phase.description}</p>
                )}
              </div>

              {/* Connector line */}
              {index < phases.length - 1 && (
                <div className="absolute left-[11px] w-0.5 h-full bg-slate-700 -z-10" style={{ top: '32px' }} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Artifacts */}
      {artifacts.length > 0 && (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4">Artifacts</h4>
          <div className="space-y-2">
            {artifacts.map((artifact) => (
              <div
                key={artifact.id}
                className="flex items-center justify-between bg-slate-700/30 rounded-lg p-3 hover:bg-slate-700/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  {artifact.artifact_type === 'merge_request' ? (
                    <GitMerge className="h-6 w-6 text-blue-400" />
                  ) : artifact.artifact_type === 'commit' ? (
                    <FileText className="h-6 w-6 text-purple-400" />
                  ) : artifact.artifact_type === 'branch' ? (
                    <GitBranch className="h-6 w-6 text-green-400" />
                  ) : (
                    <FileText className="h-6 w-6 text-gray-400" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-white capitalize">
                      {artifact.artifact_type.replace('_', ' ')}
                    </p>
                    {artifact.reference_url && (
                      <a
                        href={artifact.reference_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs text-blue-400 hover:underline"
                      >
                        View →
                      </a>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Live log (recent messages) */}
      {messages.length > 0 && (
        <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6">
          <h4 className="font-semibold text-white mb-4">Activity Log</h4>
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {messages.slice(-10).reverse().map((message) => (
              <div key={message.id} className="text-xs text-gray-400 font-mono bg-slate-900/50 rounded p-2">
                <span className="text-gray-500">{new Date(message.created_at).toLocaleTimeString()}</span>
                {' - '}
                <span>{JSON.stringify(message.data)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
