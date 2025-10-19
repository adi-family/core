import { BasePresenter } from './base'
import type { PipelineExecution } from '../../../types'
import { Badge } from '@/components/ui/badge'

export class PipelineExecutionPresenter extends BasePresenter<PipelineExecution> {
  getId(): string {
    return this.model.id
  }

  getDisplayTitle(): string {
    return `Pipeline ${this.model.pipeline_id || this.truncateId(this.model.id)}`
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (exec: PipelineExecution) => (
          <span className="font-mono text-xs text-gray-600">
            {this.truncateId(exec.id)}
          </span>
        ),
      },
      {
        key: 'session_id',
        label: 'Session',
        render: (exec: PipelineExecution) => (
          <span className="font-mono text-xs text-gray-600">
            {this.truncateId(exec.session_id)}
          </span>
        ),
      },
      {
        key: 'pipeline_id',
        label: 'Pipeline ID',
        render: (exec: PipelineExecution) =>
          exec.pipeline_id ? (
            <span className="font-mono text-xs text-gray-600">{exec.pipeline_id}</span>
          ) : (
            <span className="text-xs text-gray-400">-</span>
          ),
      },
      {
        key: 'status',
        label: 'Status',
        render: (exec: PipelineExecution) => {
          const statusColors: Record<string, string> = {
            pending: 'warning',
            running: 'blue',
            success: 'success',
            failed: 'danger',
            canceled: 'gray',
          }
          return (
            <Badge variant={statusColors[exec.status] as never}>
              {exec.status.toUpperCase()}
            </Badge>
          )
        },
      },
      {
        key: 'last_status_update',
        label: 'Last Update',
        render: (exec: PipelineExecution) => (
          <span className="text-xs text-gray-600">
            {this.formatDate(exec.last_status_update)}
          </span>
        ),
      },
      {
        key: 'created_at',
        label: 'Created',
        render: (exec: PipelineExecution) => (
          <span className="text-xs text-gray-600">
            {this.formatDate(exec.created_at)}
          </span>
        ),
      },
    ]
  }

  getActions() {
    const actions = []

    if (this.model.status === 'failed') {
      actions.push({
        label: 'Retry',
        onClick: async () => {
          console.log('Retry pipeline:', this.model.id)
          // TODO: Implement retry logic
        },
        variant: 'outline' as const,
      })
    }

    return actions
  }
}
