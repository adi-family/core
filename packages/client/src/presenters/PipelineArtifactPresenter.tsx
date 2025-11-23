import { BasePresenter } from './base'
import type { PipelineArtifact } from '@types'
import { Badge } from '@adi-simple/ui/badge'

export class PipelineArtifactPresenter extends BasePresenter<PipelineArtifact> {
  getId(): string {
    return this.model.id
  }

  getDisplayTitle(): string {
    return `Artifact ${this.truncateId(this.model.id)}`
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (artifact: PipelineArtifact) => (
          <span className="font-mono text-xs text-neutral-600">
            {this.truncateId(artifact.id)}
          </span>
        ),
      },
      {
        key: 'artifact_type',
        label: 'Type',
        render: (artifact: PipelineArtifact) => {
          const typeColors: Record<string, string> = {
            merge_request: 'blue',
            execution_result: 'purple',
            log: 'gray',
          }
          return (
            <Badge variant={typeColors[artifact.artifact_type] as never}>
              {artifact.artifact_type.replace('_', ' ').toUpperCase()}
            </Badge>
          )
        },
      },
      {
        key: 'reference_url',
        label: 'Reference',
        render: (artifact: PipelineArtifact) =>
          artifact.reference_url ? (
            <a
              href={artifact.reference_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-neutral-600 hover:text-neutral-700 uppercase tracking-wide font-medium transition-colors duration-200 hover:underline"
            >
              View →
            </a>
          ) : (
            <span className="text-xs text-neutral-400">-</span>
          ),
      },
      {
        key: 'metadata',
        label: 'Details',
        render: (artifact: PipelineArtifact) => {
          const metadata = artifact.metadata as Record<string, unknown> | null
          if (!metadata) {
            return <span className="text-xs text-neutral-400">-</span>
          }

          const title = metadata.title ? String(metadata.title) : null
          const completed = typeof metadata.completed === 'boolean' ? metadata.completed : null
          const needsClarification = Boolean(metadata.needs_clarification)

          return (
            <div className="flex flex-col gap-1">
              {title && (
                <div className="text-xs text-neutral-700 font-medium">
                  {title}
                </div>
              )}
              {completed !== null && (
                <Badge
                  variant={completed ? 'success' : 'warning'}
                >
                  {completed ? 'Complete' : 'Incomplete'}
                </Badge>
              )}
              {needsClarification && (
                <Badge variant="warning">
                  Needs Clarification
                </Badge>
              )}
            </div>
          )
        },
      },
      {
        key: 'created_at',
        label: 'Created',
        render: (artifact: PipelineArtifact) => (
          <span className="text-xs text-neutral-600">
            {this.formatDate(artifact.created_at)}
          </span>
        ),
      },
    ]
  }

  getActions() {
    if (!this.model.reference_url) return []

    return [
      {
        label: 'Open',
        onClick: async () => {
          if (this.model.reference_url) {
            window.open(this.model.reference_url, '_blank')
          }
        },
        variant: 'outline' as const,
      },
    ]
  }
}
