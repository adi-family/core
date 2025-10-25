import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import { Clock, RefreshCw, CheckCircle, XCircle, Ban } from 'lucide-react'
import type { PipelineExecution } from '@adi-simple/types'
import type { PipelineExecutionApiClient } from './mock-client'

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
        let res: Response
        if (sessionId) {
          res = await client["pipeline-executions"]["by-session"][":sessionId"].$get({
            param: { sessionId }
          })
        } else if (workerRepositoryId) {
          res = await client["pipeline-executions"]["by-worker-repository"][":workerRepositoryId"].$get({
            param: { workerRepositoryId }
          })
        } else {
          res = await client["pipeline-executions"].$get()
        }

        if (!res.ok) {
          console.error("Error fetching pipeline executions:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setPipelineExecutions(data)
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
