import type { Task } from "@types"
import { CheckCircle, XCircle } from "lucide-react"

interface ImplementationProgressProps {
  task: Task
}

export function ImplementationProgress({ task }: ImplementationProgressProps) {
  if (!task.ai_implementation_session_id) {
    return (
      <div className="bg-slate-800/40 backdrop-blur-sm rounded-lg border border-slate-700/50 p-6 text-center">
        <p className="text-gray-400">No implementation in progress</p>
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
                <h4 className={`font-medium ${phase.status === 'active' ? 'text-blue-300' :
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
    </div>
  )
}
