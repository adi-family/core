import { useEffect, useState, useMemo } from "react"
import { useParams } from "react-router-dom"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Badge } from '@adi-simple/ui/badge'
import { Button } from '@adi-simple/ui/button'
import { Calendar, ExternalLink, ArrowLeft, Circle, CheckCircle2, Loader2, XCircle, Clock, RefreshCw, GitMerge, Star, AlertTriangle, Shield, Eye, TrendingUp, Zap } from "lucide-react"
import { createAuthenticatedClient } from "@/lib/client"
import { navigateTo } from "@/utils/navigation"
import { apiCall } from "@/utils/apiCall"
import { useAuth } from "@clerk/clerk-react"
import { toast } from "sonner"
import { getComputedMetrics } from '@adi-simple/shared/task-scoring'
import { getTaskConfig, getTaskArtifactsConfig } from '@adi/api-contracts/tasks'
import { getTaskSourceConfig } from '@adi/api-contracts/task-sources'
import { listPipelineArtifactsConfig } from '@adi/api-contracts/pipeline-executions'
import type { Task, TaskSource, PipelineArtifact } from "../../../types"

export function TaskPage() {
  const { id } = useParams<{ id: string }>()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [task, setTask] = useState<Task | null>(null)
  const [taskSource, setTaskSource] = useState<TaskSource | null>(null)
  const [evaluationReport, setEvaluationReport] = useState<string | null>(null)
  const [mergeRequestArtifacts, setMergeRequestArtifacts] = useState<PipelineArtifact[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const API_BASE = import.meta.env.VITE_API_URL || '/api'

  useEffect(() => {
    const fetchTask = async () => {
      if (!id) {
        setError("No task ID provided")
        setLoading(false)
        return
      }

      try {
        const taskData = await client.run(getTaskConfig, {
          params: { id },
        })
        setTask(taskData)

        // Fetch task source
        if (taskData.task_source_id) {
          try {
            const taskSourceData = await client.run(getTaskSourceConfig, {
              params: { id: taskData.task_source_id },
            })
            setTaskSource(taskSourceData)
          } catch (error) {
            console.error('Error fetching task source:', error)
          }
        }

        // Fetch evaluation report from pipeline artifacts
        if (taskData.ai_evaluation_simple_status === 'completed') {
          try {
            const artifacts = await client.run(listPipelineArtifactsConfig, {}) as PipelineArtifact[]
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
          } catch (error) {
            console.error('Failed to fetch evaluation report:', error)
          }
        }

        // Fetch all artifacts for this task
        try {
          const artifacts = await client.run(getTaskArtifactsConfig, {
            params: { taskId: taskData.id }
          }) as PipelineArtifact[]
          // Filter for merge request artifacts
          const mrArtifacts = artifacts.filter(a => a.artifact_type === 'merge_request')
          setMergeRequestArtifacts(mrArtifacts)
        } catch (err) {
          console.error('Failed to fetch artifacts:', err)
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
    if (statusLower === "not_started") return Circle
    return Circle
  }

  const getStepColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === "completed" || statusLower === "success") return "text-green-400"
    if (statusLower === "failed" || statusLower === "error") return "text-red-400"
    if (statusLower.includes("ing") || statusLower === "running") return "text-blue-400"
    if (statusLower === "queued") return "text-yellow-400"
    if (statusLower === "pending") return "text-orange-400"
    if (statusLower === "not_started") return "text-gray-500"
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
          try {
            const taskData = await client.run(getTaskConfig, {
              params: { id: id! },
            })
            setTask(taskData)
            if (taskData.task_source_id) {
              try {
                const taskSourceData = await client.run(getTaskSourceConfig, {
                  params: { id: taskData.task_source_id },
                })
                setTaskSource(taskSourceData)
              } catch (error) {
                console.error('Error fetching task source:', error)
              }
            }
          } catch (error) {
            console.error('Error refetching task:', error)
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
          try {
            const taskData = await client.run(getTaskConfig, {
              params: { id: id! },
            })
            setTask(taskData)
          } catch (error) {
            console.error('Error refetching task:', error)
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
        onSuccess: async (response) => {
          console.log('🚀 Implementation API response:', response)
          toast.success('Implementation started successfully!')
          // Refetch task data
          try {
            const taskData = await client.run(getTaskConfig, {
              params: { id: id! },
            })
            console.log('🔄 Refetched task data:', taskData)
            console.log('📊 Implementation status in refetched data:', taskData.ai_implementation_status)
            setTask(taskData)
            console.log('✅ State updated with new task data')
          } catch (error) {
            console.error('❌ Error refetching task:', error)
          }
        },
        onError: (error) => toast.error(`Failed to start implementation: ${error}`)
      }
    )
  }

  const handleStartAdvancedEvaluation = async () => {
    if (!task) return

    const token = await getToken()

    await apiCall(
      () => fetch(`${API_BASE}/tasks/${task.id}/evaluate-advanced`, {
        method: 'POST',
        headers: {
          ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
        },
        credentials: 'include',
      }),
      {
        onSuccess: async () => {
          toast.success('Advanced evaluation started successfully!')
          // Refetch task data
          try {
            const taskData = await client.run(getTaskConfig, {
              params: { id: id! },
            })
            setTask(taskData)
          } catch (error) {
            console.error('Error refetching task:', error)
          }
        },
        onError: (error) => toast.error(`Failed to start advanced evaluation: ${error}`)
      }
    )
  }

  const steps = [
    {
      id: "sync",
      label: "Sync",
      status: taskSource?.sync_status || "not_started",
      onRetry: handleRetrySync,
    },
    {
      id: "simple_evaluation",
      label: "Simple Evaluation",
      status: task?.ai_evaluation_simple_status || "not_started",
      onRetry: handleRetryEvaluation,
    },
    {
      id: "advanced_evaluation",
      label: "Advanced Evaluation",
      status: task?.ai_evaluation_advanced_status || (task?.ai_evaluation_simple_status === 'completed' && task?.ai_evaluation_simple_verdict === 'ready' ? "not_started" : "not_started"),
      onRetry: undefined,
    },
    {
      id: "implementation",
      label: "Implementation",
      status: task?.ai_implementation_status || "not_started",
      onRetry: undefined,
    },
    {
      id: "task",
      label: "Task",
      status: task?.status || "not_started",
      onRetry: undefined,
    },
  ]

  if (loading) {
    return (
      <AnimatedPageContainer>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4 text-gray-300">Loading task...</div>
          </CardContent>
        </Card>
      </AnimatedPageContainer>
    )
  }

  if (error || !task) {
    return (
      <AnimatedPageContainer>
        <Card>
          <CardContent className="pt-6">
            <div className="text-center py-4 text-red-400">{error || "Task not found"}</div>
            <div className="text-center mt-4">
              <Button onClick={() => navigateTo("/tasks")} variant="outline">
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Tasks
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedPageContainer>
    )
  }

  return (
    <AnimatedPageContainer>
      <div className="space-y-6">
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
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              Re-evaluate (Simple)
            </Button>

            {/* Advanced evaluation button - only show when simple eval is complete and passed */}
            {task.ai_evaluation_simple_status === 'completed' &&
             task.ai_evaluation_simple_verdict === 'ready' &&
             (!task.ai_evaluation_advanced_status || task.ai_evaluation_advanced_status === 'not_started') && (
              <Button
                onClick={handleStartAdvancedEvaluation}
                variant="outline"
                size="sm"
                className="bg-blue-600/10 border-blue-500/50 hover:bg-blue-600/20"
              >
                <Zap className="h-4 w-4 mr-2" />
                Run Advanced Evaluation
              </Button>
            )}

            {/* Start/Re-implement button - shows different text based on status */}
            <Button
              onClick={handleStartImplementation}
              variant="outline"
              size="sm"
            >
              <RefreshCw className="h-4 w-4 mr-2" />
              {!task.ai_implementation_status || task.ai_implementation_status === 'pending' ? 'Start Implementation' : 'Re-implement'}
            </Button>
          </div>
        </div>

        {/* Task Details Card */}
        <Card>
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
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Description
              </h3>
              <p className="text-gray-100">{task.description}</p>
            </div>
          )}

          {/* Step Indicator */}
          <div className="bg-white/5 backdrop-blur-sm rounded-lg p-4 border border-white/10">
            <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
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
                      <span className="text-xs text-gray-400">
                        {step.status}
                      </span>
                      {isFailed && step.onRetry && (
                        <button
                          onClick={step.onRetry}
                          className="flex items-center gap-0.5 text-xs text-blue-400 hover:text-blue-300 disabled:opacity-50 mt-1"
                          title="Retry this step"
                        >
                          <RefreshCw className="h-3 w-3" />
                          Retry
                        </button>
                      )}
                    </div>
                    {index < steps.length - 1 && (
                      <div className="h-px bg-white/20 flex-shrink-0 w-8 mx-2" />
                    )}
                  </div>
                )
              })}
            </div>
          </div>

          {/* Status Information */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Status
              </h3>
              <Badge variant="blue" className="text-sm">
                {task.status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Remote Status
              </h3>
              <Badge variant={getRemoteStatusVariant(task.remote_status)} className="text-sm">
                {task.remote_status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Simple Evaluation Status
              </h3>
              <Badge variant="gray" className="text-sm">
                {task.ai_evaluation_simple_status}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Advanced Evaluation Status
              </h3>
              <Badge variant="gray" className="text-sm">
                {task.ai_evaluation_advanced_status || (task.ai_evaluation_simple_status === 'completed' && task.ai_evaluation_simple_verdict === 'ready' ? 'not_started' : 'not_started')}
              </Badge>
            </div>

            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                AI Implementation Status
              </h3>
              <Badge variant="gray" className="text-sm">
                {task.ai_implementation_status}
              </Badge>
            </div>

            {task.ai_evaluation_simple_verdict && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                  Simple Evaluation Result
                </h3>
                <Badge
                  variant={task.ai_evaluation_simple_verdict === 'ready' ? 'green' : 'warning'}
                  className="text-sm"
                >
                  {task.ai_evaluation_simple_verdict === 'ready' ? 'Ready' : 'Needs Clarification'}
                </Badge>
              </div>
            )}

            {task.ai_evaluation_advanced_verdict && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                  Advanced Evaluation Result
                </h3>
                <Badge
                  variant={task.ai_evaluation_advanced_verdict === 'ready' ? 'green' : 'warning'}
                  className="text-sm"
                >
                  {task.ai_evaluation_advanced_verdict === 'ready' ? 'Ready for Implementation' : 'Needs Clarification'}
                </Badge>
              </div>
            )}

            {taskSource && (
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                  Task Source
                </h3>
                <p className="text-gray-100">{taskSource.name}</p>
                <Badge variant="orange" className="text-xs mt-1">
                  {taskSource.type}
                </Badge>
              </div>
            )}
          </div>

          {/* Source Issue Information */}
          {task.source_gitlab_issue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                GitLab Issue
              </h3>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Issue IID:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_gitlab_issue.iid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Repository:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_gitlab_issue.metadata.repo}</span>
                </div>
                {task.source_gitlab_issue.metadata.host && (
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Host:</span>
                    <a
                      href={`${task.source_gitlab_issue.metadata.host}/${task.source_gitlab_issue.metadata.repo}/-/issues/${task.source_gitlab_issue.iid}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1 text-sm"
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
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                GitHub Issue
              </h3>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Issue IID:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_github_issue.iid}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Repository:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_github_issue.metadata.repo}</span>
                </div>
              </div>
            </div>
          )}

          {task.source_jira_issue && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2">
                Jira Issue
              </h3>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Key:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_jira_issue.metadata.key}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-sm text-gray-300">Project:</span>
                  <span className="font-mono text-sm text-gray-100">{task.source_jira_issue.metadata.project_key}</span>
                </div>
              </div>
            </div>
          )}

          {/* Merge Request Artifacts */}
          {mergeRequestArtifacts.length > 0 && (
            <div>
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-2 flex items-center gap-2">
                <GitMerge className="h-4 w-4" />
                Merge Requests
              </h3>
              <div className="space-y-3">
                {mergeRequestArtifacts.map((artifact) => {
                  const metadata = artifact.metadata as any
                  return (
                    <div key={artifact.id} className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-200">
                          {metadata?.file_space_name || 'Merge Request'}
                        </span>
                        <a
                          href={artifact.reference_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-teal-400 hover:text-teal-300 hover:underline flex items-center gap-1 text-sm"
                        >
                          View MR
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      {metadata?.branch && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Branch:</span>
                          <span className="font-mono text-sm text-gray-100">{metadata.branch}</span>
                        </div>
                      )}
                      {metadata?.mr_iid && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">MR IID:</span>
                          <span className="font-mono text-sm text-gray-100">{metadata.mr_iid}</span>
                        </div>
                      )}
                      {metadata?.completed !== undefined && (
                        <div className="flex items-center justify-between">
                          <span className="text-sm text-gray-300">Status:</span>
                          <Badge variant={metadata.completed ? 'green' : 'warning'} className="text-xs">
                            {metadata.completed ? 'Completed' : 'Needs Clarification'}
                          </Badge>
                        </div>
                      )}
                      <div className="text-xs text-gray-400 pt-2 border-t border-white/10">
                        Created: {new Date(artifact.created_at).toLocaleString()}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* Simple Evaluation Results */}
          {task.ai_evaluation_simple_result && (() => {
            const metrics = getComputedMetrics(task.ai_evaluation_simple_result)
            const result = task.ai_evaluation_simple_result

            return (
              <div className="pt-4 border-t border-white/10 space-y-6">
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide flex items-center gap-2">
                  <Zap className="h-4 w-4 text-yellow-400" />
                  Quick Evaluation
                </h3>

                {/* Quick Win Score & Priority */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="bg-gradient-to-br from-yellow-500/10 to-orange-500/10 p-4 rounded-lg border border-yellow-500/30">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-yellow-200 flex items-center gap-2">
                        <Star className="h-4 w-4" />
                        Quick Win Score
                      </span>
                      <span className="text-3xl font-bold text-yellow-400">{metrics.quick_win_score}</span>
                    </div>
                    <div className="w-full h-2 bg-gray-700 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-yellow-400"
                        style={{ width: `${metrics.quick_win_score}%` }}
                      />
                    </div>
                    <p className="text-xs text-gray-400 mt-2">
                      {metrics.quick_win_score >= 75 ? 'Excellent candidate!' :
                       metrics.quick_win_score >= 50 ? 'Good candidate' :
                       metrics.quick_win_score >= 25 ? 'Moderate effort' : 'Complex task'}
                    </p>
                  </div>

                  <div className="bg-white/5 backdrop-blur-sm p-4 rounded-lg border border-white/10">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-gray-300 flex items-center gap-2">
                        <TrendingUp className="h-4 w-4" />
                        Priority
                      </span>
                      <Badge
                        variant={
                          metrics.priority_quadrant === 'quick_win' ? 'green' :
                          metrics.priority_quadrant === 'major_project' ? 'blue' :
                          metrics.priority_quadrant === 'fill_in' ? 'warning' : 'gray'
                        }
                        className="text-sm"
                      >
                        {metrics.priority_quadrant === 'quick_win' ? 'Quick Win' :
                         metrics.priority_quadrant === 'major_project' ? 'Major Project' :
                         metrics.priority_quadrant === 'fill_in' ? 'Fill In' : 'Low Priority'}
                      </Badge>
                    </div>
                    <div className="space-y-2 text-sm text-gray-300">
                      <div className="flex justify-between">
                        <span>Impact:</span>
                        <span className="font-medium capitalize">{result.estimated_impact}</span>
                      </div>
                      <div className="flex justify-between">
                        <span>Effort:</span>
                        <span className="font-medium capitalize">{result.estimated_effort}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Status Badges */}
                <div className="flex flex-wrap gap-2">
                  {metrics.is_ai_blocked && (
                    <Badge variant="danger" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      AI Blocked
                    </Badge>
                  )}
                  {!metrics.is_ai_blocked && metrics.implementation_status.confidence === 'low' && (
                    <Badge variant="orange" className="flex items-center gap-1">
                      <AlertTriangle className="h-3 w-3" />
                      Low Confidence
                    </Badge>
                  )}
                  {!metrics.is_ai_blocked && !metrics.implementation_status.can_verify && (
                    <Badge variant="blue" className="flex items-center gap-1">
                      <Shield className="h-3 w-3" />
                      Can't Test
                    </Badge>
                  )}
                  {metrics.requires_human_oversight && (
                    <Badge variant="purple" className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      Needs Review
                    </Badge>
                  )}
                </div>

                {/* Detailed Metrics */}
                <div className="bg-white/5 backdrop-blur-sm p-4 rounded-md space-y-3">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div>
                      <span className="text-xs text-gray-400">Task Type</span>
                      <p className="text-sm font-medium text-gray-100 capitalize">{result.task_type.replace('_', ' ')}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Effort Estimate</span>
                      <p className="text-sm font-medium text-gray-100 uppercase">{result.effort_estimate}</p>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Risk Level</span>
                      <Badge variant={result.risk_level === 'high' ? 'danger' : result.risk_level === 'medium' ? 'warning' : 'green'} className="text-xs">
                        {result.risk_level}
                      </Badge>
                    </div>
                    <div>
                      <span className="text-xs text-gray-400">Confidence</span>
                      <Badge
                        variant={
                          metrics.implementation_status.confidence === 'high' ? 'green' :
                          metrics.implementation_status.confidence === 'medium' ? 'warning' : 'orange'
                        }
                        className="text-xs"
                      >
                        {metrics.implementation_status.confidence}
                      </Badge>
                    </div>
                  </div>

                  <div className="flex items-center justify-between pt-2 border-t border-white/10">
                    <span className="text-sm text-gray-300">Clarity Score:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-blue-400"
                          style={{ width: `${result.clarity_score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{result.clarity_score}/100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Complexity Score:</span>
                    <div className="flex items-center gap-2">
                      <div className="w-32 h-2 bg-gray-700 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-purple-400"
                          style={{ width: `${result.complexity_score}%` }}
                        />
                      </div>
                      <span className="text-sm font-medium">{result.complexity_score}/100</span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between">
                    <span className="text-sm text-gray-300">Has Acceptance Criteria:</span>
                    <Badge variant={result.has_acceptance_criteria ? 'green' : 'gray'}>
                      {result.has_acceptance_criteria ? 'Yes' : 'No'}
                    </Badge>
                  </div>
                </div>

                {/* Blockers Summary */}
                {result.blockers_summary && result.blockers_summary.length > 0 && (
                  <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                    <h4 className="text-sm font-semibold text-red-200 mb-2 flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4" />
                      Blockers
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {result.blockers_summary.map((blocker, idx) => (
                        <li key={idx} className="text-sm text-red-300">{blocker}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Verification Summary */}
                {result.verification_summary && result.verification_summary.length > 0 && (
                  <div className="bg-purple-500/10 p-4 rounded-lg border border-purple-500/30">
                    <h4 className="text-sm font-semibold text-purple-200 mb-2 flex items-center gap-2">
                      <Eye className="h-4 w-4" />
                      Post-Implementation Verification Needed
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {result.verification_summary.map((verification, idx) => (
                        <li key={idx} className="text-sm text-purple-300">{verification}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Risk Summary */}
                {result.risk_summary && result.risk_summary.length > 0 && (
                  <div className="bg-orange-500/10 p-4 rounded-lg border border-orange-500/30">
                    <h4 className="text-sm font-semibold text-orange-200 mb-2 flex items-center gap-2">
                      <Shield className="h-4 w-4" />
                      Implementation Risks
                    </h4>
                    <ul className="list-disc list-inside space-y-1">
                      {result.risk_summary.map((risk, idx) => (
                        <li key={idx} className="text-sm text-orange-300">{risk}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Caveats */}
                {metrics.implementation_status.caveats.length > 0 && (
                  <div className="bg-blue-500/10 p-4 rounded-lg border border-blue-500/30">
                    <h4 className="text-sm font-semibold text-blue-200 mb-2">Implementation Caveats</h4>
                    <ul className="list-disc list-inside space-y-1">
                      {metrics.implementation_status.caveats.map((caveat, idx) => (
                        <li key={idx} className="text-sm text-blue-300">{caveat}</li>
                      ))}
                    </ul>
                  </div>
                )}

                {result.auto_reject_reason && (
                  <div className="bg-red-500/10 p-4 rounded-lg border border-red-500/30">
                    <span className="text-sm font-semibold text-red-200 block mb-2">Rejection Reason:</span>
                    <p className="text-sm text-red-300">{result.auto_reject_reason}</p>
                  </div>
                )}
              </div>
            )
          })()}

          {/* Agentic Evaluation Results */}
          {task.ai_evaluation_agentic_result && (
            <div className="pt-4 border-t border-gray-200 space-y-4">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                Deep Evaluation
              </h3>

              {/* Confidence */}
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-md">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-semibold text-gray-300">Confidence:</span>
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
                <div className="bg-red-500/10 p-4 rounded-md border border-red-500/30">
                  <h4 className="text-sm font-semibold text-red-200 mb-2">Blockers</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.blockers.map((blocker, idx) => (
                      <li key={idx} className="text-sm text-red-300">{blocker}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Missing Information */}
              {task.ai_evaluation_agentic_result.missing_information && task.ai_evaluation_agentic_result.missing_information.length > 0 && (
                <div className="bg-yellow-500/10 p-4 rounded-md border border-yellow-500/30">
                  <h4 className="text-sm font-semibold text-yellow-200 mb-2">Missing Information</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.missing_information.map((info, idx) => (
                      <li key={idx} className="text-sm text-yellow-300">{info}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Risks */}
              {task.ai_evaluation_agentic_result.risks && task.ai_evaluation_agentic_result.risks.length > 0 && (
                <div className="bg-orange-500/10 p-4 rounded-md border border-orange-500/30">
                  <h4 className="text-sm font-semibold text-orange-200 mb-2">Implementation Risks</h4>
                  <ul className="list-disc list-inside space-y-1">
                    {task.ai_evaluation_agentic_result.risks.map((risk, idx) => (
                      <li key={idx} className="text-sm text-orange-300">{risk}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Agent Instructions */}
              {task.ai_evaluation_agentic_result.agent_instructions && (
                <div className="bg-blue-500/10 p-4 rounded-md border border-blue-500/30">
                  <h4 className="text-sm font-semibold text-blue-200 mb-3">Agent Instructions</h4>

                  {task.ai_evaluation_agentic_result.agent_instructions.required_context_files && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-blue-300 uppercase">Required Files:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.required_context_files.map((file, idx) => (
                          <li key={idx} className="text-sm text-blue-400 font-mono">{file}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {task.ai_evaluation_agentic_result.agent_instructions.suggested_steps && (
                    <div className="mb-3">
                      <span className="text-xs font-semibold text-blue-300 uppercase">Suggested Steps:</span>
                      <ol className="list-decimal list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.suggested_steps.map((step, idx) => (
                          <li key={idx} className="text-sm text-blue-400">{step}</li>
                        ))}
                      </ol>
                    </div>
                  )}

                  {task.ai_evaluation_agentic_result.agent_instructions.follow_patterns_from && (
                    <div>
                      <span className="text-xs font-semibold text-blue-300 uppercase">Follow Patterns From:</span>
                      <ul className="list-disc list-inside mt-1 space-y-1">
                        {task.ai_evaluation_agentic_result.agent_instructions.follow_patterns_from.map((pattern, idx) => (
                          <li key={idx} className="text-sm text-blue-400 font-mono">{pattern}</li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              )}

              {/* Agent Report */}
              {task.ai_evaluation_agentic_result.report && (
                <div className="bg-white/5 backdrop-blur-sm p-4 rounded-md">
                  <h4 className="text-sm font-semibold text-gray-300 mb-2">Agent Context Report</h4>
                  <pre className="whitespace-pre-wrap text-xs text-gray-200 font-mono">
                    {task.ai_evaluation_agentic_result.report}
                  </pre>
                </div>
              )}
            </div>
          )}

          {/* Legacy Evaluation Report */}
          {evaluationReport && !task.ai_evaluation_agentic_result && (
            <div className="pt-4 border-t border-white/10">
              <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide mb-3">
                AI Evaluation Report
              </h3>
              <div className="bg-white/5 backdrop-blur-sm p-4 rounded-md">
                <pre className="whitespace-pre-wrap text-sm text-gray-100 font-sans">
                  {evaluationReport}
                </pre>
              </div>
            </div>
          )}

          {/* Timestamps */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-4 border-t border-white/10">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Created
                </h3>
                <p className="text-sm text-gray-200">{formatDate(task.created_at)}</p>
              </div>
            </div>
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-gray-500 mt-0.5" />
              <div>
                <h3 className="text-sm font-semibold text-gray-300 uppercase tracking-wide">
                  Updated
                </h3>
                <p className="text-sm text-gray-200">{formatDate(task.updated_at)}</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
      </div>
    </AnimatedPageContainer>
  )
}
