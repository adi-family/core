import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import { Clock, RefreshCw, CheckCircle, XCircle, Ban } from 'lucide-react'
import type { PipelineExecution } from '@adi-simple/types'
import type { BaseClient } from '@adi-family/http'

export type PipelineExecutionApiClient = BaseClient

interface PipelineExecutionSelectProps {
  client: PipelineExecutionApiClient
  value: string
  onChange: (pipelineExecutionId: string) => void
  sessionId?: string
  workerRepositoryId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showStatus?: boolean
}

export function PipelineExecutionSelect({
  client,
  value,
  onChange,
  sessionId,
  workerRepositoryId,
  required = false,
  label = "PIPELINE EXECUTION",
  placeholder = "Search pipeline executions...",
  showStatus = true,
}: PipelineExecutionSelectProps) {
  const [pipelineExecutions, setPipelineExecutions] = useState<PipelineExecution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchPipelineExecutions = async () => {
      try {
        const { listPipelineExecutionsConfig } = await import('@adi/api-contracts/pipeline-executions')
        const query: { session_id?: string; worker_repository_id?: string } = {}
        if (sessionId) {
          query.session_id = sessionId
        }
        if (workerRepositoryId) {
          query.worker_repository_id = workerRepositoryId
        }
        const data = await client.run(listPipelineExecutionsConfig, { query })
        setPipelineExecutions(data as any)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching pipeline executions:", error)
        setLoading(false)
      }
    }

    fetchPipelineExecutions().catch((error) => {
      console.error("Error fetching pipeline executions:", error)
      setLoading(false)
    })
  }, [sessionId, workerRepositoryId, client])

  const getStatusIcon = (status: string) => {
    const iconSize = 16
    const statusMap: Record<string, React.ReactNode> = {
      pending: <Clock size={iconSize} />,
      running: <RefreshCw size={iconSize} className="animate-spin" />,
      success: <CheckCircle size={iconSize} />,
      failed: <XCircle size={iconSize} />,
      canceled: <Ban size={iconSize} />,
    }
    return statusMap[status] || <Clock size={iconSize} />
  }

  const formatPipelineExecutionLabel = (execution: PipelineExecution) => {
    const pipelineId = execution.pipeline_id || 'N/A'
    const shortId = execution.id.substring(0, 8)
    return `Pipeline #${pipelineId} (${shortId}...)`
  }

  const options = pipelineExecutions.map((execution) => ({
    value: execution.id,
    label: formatPipelineExecutionLabel(execution),
    icon: showStatus ? getStatusIcon(execution.status) : undefined,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="pipeline_execution_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading pipeline executions...</div>
      ) : (
        <Combobox
          id="pipeline_execution_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No pipeline executions found"
        />
      )}
    </div>
  )
}
