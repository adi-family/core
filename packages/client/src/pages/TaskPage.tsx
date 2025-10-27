import { useEffect, useState } from "react"
import { useParams } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Badge } from '@adi-simple/ui/badge'
import { Button } from '@adi-simple/ui/button'
import { Calendar, ExternalLink, ArrowLeft, Circle, CheckCircle2, Loader2, XCircle, Clock, RefreshCw } from "lucide-react"
import { client } from "@/lib/client"
import { navigateTo } from "@/utils/navigation"
import { apiCall } from "@/utils/apiCall"
import { useAuth } from "@clerk/clerk-react"
import { toast } from "sonner"
import type { Task, TaskSource, PipelineArtifact } from "../../../types"

export function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const [task, setTask] = useState<Task | null>(null)
  const [taskSource, setTaskSource] = useState<TaskSource | null>(null)
  const [evaluationReport, setEvaluationReport] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const { getToken } = useAuth()
  const API_BASE = import.meta.env.VITE_API_URL || '/api'

  useEffect(() => {
    const fetchTask = async () => {
      if (!id) {
        setError("No task ID provided")
        setLoading(false)
        return
      }

      try {
        const res = await client.tasks[":id"].$get({
          param: { id },
        })

        if (!res.ok) {
          const errorText = await res.text()
          setError(errorText || "Failed to fetch task")
          setLoading(false)
          return
        }

        const taskData = await res.json()
        setTask(taskData)

        // Fetch task source
        if (taskData.task_source_id) {
          const taskSourceRes = await client["task-sources"][":id"].$get({
            param: { id: taskData.task_source_id },
          })

          if (taskSourceRes.ok) {
            const taskSourceData = await taskSourceRes.json()
            setTaskSource(taskSourceData)
          }
        }

        // Fetch evaluation report from pipeline artifacts
        if (taskData.ai_evaluation_status === 'completed') {
          try {
            const artifactsRes = await client["pipeline-artifacts"].$get()
            if (artifactsRes.ok) {
              const artifacts = await artifactsRes.json() as PipelineArtifact[]
              const evaluationArtifact = artifacts.find(
                (a) => a.artifact_type === 'text' &&
                       (a.metadata as any)?.task_id === taskData.id
              )
              if (evaluationArtifact) {
                const content = (evaluationArtifact.metadata as any)?.evaluation_content
                if (content) {
                  setEvaluationReport(content)
                }
              }
            }
          } catch (err) {
            console.error('Failed to fetch evaluation report:', err)
          }
        }

        setLoading(false)
      } catch {
        setError("Error fetching task")
        setLoading(false)
      }
    }

    fetchTask()
  }, [id])

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getRemoteStatusVariant = (status: 'opened' | 'closed') => {
    return status === 'opened' ? 'green' : 'gray'
  }

  const getStepIcon = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return CheckCircle2
    if (statusLower === "failed" || statusLower === "error") return XCircle
    if (statusLower.includes("ing") || statusLower === "running") return Loader2
    if (statusLower === "queued" || statusLower === "pending") return Clock
    return Circle
  }

  const getStepColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return "text-green-600"
    if (statusLower === "failed" || statusLower === "error") return "text-red-600"
    if (statusLower.includes("ing") || statusLower === "running") return "text-blue-600"
    if (statusLower === "queued") return "text-yellow-600"
    if (statusLower === "pending") return "text-gray-400"
    return "text-gray-400"
  }

  const handleRetrySync = async () => {
    if (!taskSource) return

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/task-sources/${taskSource.id}/sync`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Sync restarted successfully!')
          // Refetch task data
          const res = await client.tasks[":id"].$get({ param: { id: id! } })
          if (res.ok) {
            const taskData = await res.json()
            setTask(taskData)
            if (taskData.task_source_id) {
              const taskSourceRes = await client["task-sources"][":id"].$get({
                param: { id: taskData.task_source_id },
              })
              if (taskSourceRes.ok) {
                const taskSourceData = await taskSourceRes.json()
                setTaskSource(taskSourceData)
              }
            }
          }
        },
        onError: (error) => toast.error(`Failed to restart sync: ${error}`)
      }
    )
  }

  const handleRetryEvaluation = async () => {
    if (!task) return

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${task.id}/evaluate`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Evaluation restarted successfully!')
          // Refetch task data
          const res = await client.tasks[":id"].$get({ param: { id: id! } })
          if (res.ok) {
            const taskData = await res.json()
            setTask(taskData)
          }
        },
        onError: (error) => toast.error(`Failed to restart evaluation: ${error}`)
      }
    )
  }

  const handleStartImplementation = async () => {
    if (!task) return

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${task.id}/implement`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Implementation started successfully!')
          // Refetch task data
          const res = await client.tasks[":id"].$get({ param: { id: id! } })
          if (res.ok) {
            const taskData = await res.json()
            setTask(taskData)
          }
        },
        onError: (error) => toast.error(`Failed to start implementation: ${error}`)
      }
    )
  }

  const steps = [
    {
      id: "sync",
      label: "Sync",
      status: taskSource?.sync_status || "pending",
      onRetry: handleRetrySync,
    },
    {
      id: "evaluation",
      label: "Evaluation",
      status: task?.ai_evaluation_status || "pending",
      onRetry: handleRetryEvaluation,
    },
    {
      id: "implementation",
      label: "Implementation",
      status: task?.ai_implementation_status || "pending",
      onRetry: undefined,
    },
    {
      id: "task",
      label: "Task",
      status: task?.status || "pending",
      onRetry: undefined,
    },
  ]

  if (loading) {
    return (
      <div className="mx-auto">
        <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
          <CardContent className="pt-6">
            <div className="text-center py-4">Loading task...</div>
          </CardContent>
        </Card>
      </div>
    )
  }

  if (error || !task) {
    return (
      <div className="mx-auto">
        <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
          <CardContent className="pt-6">
            <div className="text-center py-4 text-red-600">{error || "Task not found"}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigateTo("/tasks")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  return (
    <div className="mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button onClick={() => navigateTo("/tasks")} variant="outline" size="sm">
          <ArrowLeft className="h-4 w-4 mr-2" />
          Back to Tasks
        </Button>
        <div className="flex gap-2">
          {/* Re-evaluate button - always shown */}
          <Button
            onClick={handleRetryEvaluation}
            variant="outline"
            size="sm"
            className="border-purple-500 text-purple-600 hover:bg-purple-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-evaluate
          </Button>
          {/* Re-implement button - always shown */}
          <Button
            onClick={handleStartImplementation}
            variant="outline"
            size="sm"
            className="border-accent-teal text-accent-teal hover:bg-teal-50"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Re-implement
          </Button>
        </div>
      </div>

      {/* Task Details Card */}
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-accent-teal to-accent-cyan text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">{task.title}</CardTitle>
          <CardDescription className="text-gray-300">
            Task ID: {task.id}
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-6">
          {/* Description */}
          {task.description && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-800">{task.description}</p>
            </div>
          )}

          {/* Step Indicator */}
          <div className="bg-gradient-to-r from-gray-50 to-gray-100/50 rounded-lg p-4 border border-gray-200/60">
            <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
              Pipeline Status
            </h3>
            <div className="flex items-center justify-between gap-2">
              {steps.map((step, index) => {
                const StepIcon = getStepIcon(step.status)
                const isAnimating = step.status.toLowerCase().includes("ing")
                const isFailed = step.status.toLowerCase() === "failed"

                return (
                  <div key={step.label} className="flex items-center flex-1">
                    <div className="flex flex-col items-center flex-1 gap-0.5">
                      <div className={`flex items-center gap-1.5 ${getStepColor(step.status)}`}>
                        <StepIcon
                          className={`h-5 w-5 ${isAnimating ? 'animate-spin' : ''}`}
                        />
                        <span className="text-sm font-medium">{step.label}</span>
                      </div>
                      <span className="text-xs text-gray-500">
                        {step.status}
                      </span>
                      {isFailed && step.onRetry && (
                        <button
                          onClick={step.onRetry}
                          className="flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800 disabled:opacity-50 mt-1"
                          title="Retry this step"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="h-px bg-gray-300 flex-shrink-0 w-8 mx-2" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Status
              </h3>
              <Badge variant="blue" className="text-sm">
                {task.status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Remote Status
              </h3>
              <Badge variant={getRemoteStatusVariant(task.remote_status)} className="text-sm">
                {task.remote_status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                AI Evaluation Status
              </h3>
              <Badge variant="gray" className="text-sm">
                {task.ai_evaluation_status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                AI Implementation Status
              </h3>
              <Badge variant="gray" className="text-sm">
                {task.ai_implementation_status}
              </Badge>
            </div>

            {task.ai_evaluation_result && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Evaluation Result
                </h3>
                <Badge
                  variant={task.ai_evaluation_result === 'ready' ? 'green' : 'yellow'}
                  className="text-sm"
                >
                  {task.ai_evaluation_result === 'ready' ? 'Ready for Implementation' : 'Needs Clarification'}
                </Badge>
              </div>
            )}

            {taskSource && (
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                  Task Source
                </h3>
                <p className="text-gray-800">{taskSource.name}</p>
                <Badge variant="orange" className="text-xs mt-1">
                  {taskSource.type}
                </Badge>
              </div>
            )}
          </div>

          {/* Source Issue Information */}
          {task.source_gitlab_issue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                GitLab Issue
              </h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Issue IID:</span>
                  <span className="font-mono text-sm">{task.source_gitlab_issue.iid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Repository:</span>
                  <span className="font-mono text-sm">{task.source_gitlab_issue.metadata.repo}</span>
                </div>
                {task.source_gitlab_issue.metadata.host && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-600">Host:</span>
                    <a
                      href={`${task.source_gitlab_issue.metadata.host}/${task.source_gitlab_issue.metadata.repo}/-/issues/${task.source_gitlab_issue.iid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent-teal hover:underline flex items-center gap-1 text-sm"
                    >
                      View on GitLab
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            </div>
          )}

          {task.source_github_issue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                GitHub Issue
              </h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Issue IID:</span>
                  <span className="font-mono text-sm">{task.source_github_issue.iid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Repository:</span>
                  <span className="font-mono text-sm">{task.source_github_issue.metadata.repo}</span>
                </div>
              </div>
            </div>
          )}

          {task.source_jira_issue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-2">
                Jira Issue
              </h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Key:</span>
                  <span className="font-mono text-sm">{task.source_jira_issue.metadata.key}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Project:</span>
                  <span className="font-mono text-sm">{task.source_jira_issue.metadata.project_key}</span>
                </div>
              </div>
            </div>
          )}

          {/* Simple Evaluation Results */}
          {task.ai_evaluation_simple_result && (
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                Quick Evaluation
              </h3>
              <div className="bg-gray-50 p-4 rounded-md space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Clarity Score:</span>
                  <div className="flex items-center gap-2">
                    <div className="w-32 h-2 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-500"
                        style={{ width: `${task.ai_evaluation_simple_result.clarity_score || 0}%` }}
                      />
                    </div>
                    <span className="text-sm font-medium">{task.ai_evaluation_simple_result.clarity_score || 0}/100</span>
                  </div>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-600">Has Acceptance Criteria:</span>
                  <Badge variant={task.ai_evaluation_simple_result.has_acceptance_criteria ? 'green' : 'gray'}>
                    {task.ai_evaluation_simple_result.has_acceptance_criteria ? 'Yes' : 'No'}
                  </Badge>
                </div>
                {task.ai_evaluation_simple_result.auto_reject_reason && (
                  <div className="pt-2 border-t border-gray-200">
                    <span className="text-sm font-semibold text-gray-600">Rejection Reason:</span>
                    <p className="text-sm text-gray-800 mt-1">{task.ai_evaluation_simple_result.auto_reject_reason}</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Agentic Evaluation Results */}
          {task.ai_evaluation_agentic_result && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                Deep Evaluation
              </h3>

              {/* Confidence */}
              <div className="bg-gray-50 p-4 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-600">Confidence:</span>
                  <span className="text-lg font-bold">{task.ai_evaluation_agentic_result.confidence || 0}%</span>
                </div>
                <div className="w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-green-500"
                    style={{ width: `${task.ai_evaluation_agentic_result.confidence || 0}%` }}
                  />
                </div>
              </div>

              {/* Blockers */}
              {task.ai_evaluation_agentic_result.blockers && task.ai_evaluation_agentic_result.blockers.length > 0 && (
                <div className="bg-red-50 p-4 rounded-md border border-red-200">
                  <h4 className="text-sm font-semibold text-red-800 mb-2">Blockers</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.blockers.map((blocker, idx) => (
                      <li key={idx} className="text-sm text-red-700">{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Information */}
              {task.ai_evaluation_agentic_result.missing_information && task.ai_evaluation_agentic_result.missing_information.length > 0 && (
                <div className="bg-yellow-50 p-4 rounded-md border border-yellow-200">
                  <h4 className="text-sm font-semibold text-yellow-800 mb-2">Missing Information</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.missing_information.map((info, idx) => (
                      <li key={idx} className="text-sm text-yellow-700">{info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {task.ai_evaluation_agentic_result.risks && task.ai_evaluation_agentic_result.risks.length > 0 && (
                <div className="bg-orange-50 p-4 rounded-md border border-orange-200">
                  <h4 className="text-sm font-semibold text-orange-800 mb-2">Implementation Risks</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.risks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-orange-700">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agent Instructions */}
              {task.ai_evaluation_agentic_result.agent_instructions && (
                <div className="bg-blue-50 p-4 rounded-md border border-blue-200">
                  <h4 className="text-sm font-semibold text-blue-800 mb-3">Agent Instructions</h4>

                  {task.ai_evaluation_agentic_result.agent_instructions.required_context_files && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-blue-700 uppercase">Required Files:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.required_context_files.map((file, idx) => (
                          <li key={idx} className="text-sm text-blue-600 font-mono">{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {task.ai_evaluation_agentic_result.agent_instructions.suggested_steps && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-blue-700 uppercase">Suggested Steps:</span>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.suggested_steps.map((step, idx) => (
                          <li key={idx} className="text-sm text-blue-600">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {task.ai_evaluation_agentic_result.agent_instructions.follow_patterns_from && (
                    <div>
                      <span className="text-xs font-semibold text-blue-700 uppercase">Follow Patterns From:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.follow_patterns_from.map((pattern, idx) => (
                          <li key={idx} className="text-sm text-blue-600 font-mono">{pattern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Report */}
              {task.ai_evaluation_agentic_result.report && (
                <div className="bg-gray-50 p-4 rounded-md">
                  <h4 className="text-sm font-semibold text-gray-600 mb-2">Agent Context Report</h4>
                  <pre className="whitespace-pre-wrap text-xs text-gray-700 font-mono">
                    {task.ai_evaluation_agentic_result.report}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Legacy Evaluation Report */}
          {evaluationReport && !task.ai_evaluation_agentic_result && (
            <div className="pt-4 border-t border-gray-200">
              <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide mb-3">
                AI Evaluation Report
              </h3>
              <div className="bg-gray-50 p-4 rounded-md">
                <pre className="whitespace-pre-wrap text-sm text-gray-800 font-sans">
                  {evaluationReport}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-gray-200">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Created
                </h3>
                <p className="text-sm text-gray-700">{formatDate(task.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-400 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-600 uppercase tracking-wide">
                  Updated
                </h3>
                <p className="text-sm text-gray-700">{formatDate(task.updated_at)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
