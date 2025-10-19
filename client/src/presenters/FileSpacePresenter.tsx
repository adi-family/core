import { BasePresenter } from './base'
import type { FileSpace } from '../../../backend/types'
import { Badge } from '@/components/ui/badge'
import { FolderGit2, CheckCircle2, XCircle } from 'lucide-react'

/**
 * Presenter for FileSpace model
 */
export class FileSpacePresenter extends BasePresenter<FileSpace> {
  getId(): string {
    return this.model.id
  }

  getTableColumns() {
    return [
      {
        key: 'id',
        label: 'ID',
        render: (fileSpace: FileSpace) => (
          <span className="font-mono text-xs">{this.truncateId(fileSpace.id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'name',
        label: 'Name',
        render: (fileSpace: FileSpace) => <span className="font-medium">{fileSpace.name}</span>,
        sortable: true,
      },
      {
        key: 'type',
        label: 'Type',
        render: (fileSpace: FileSpace) => (
          <Badge variant="blue" icon={FolderGit2}>
            {fileSpace.type}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'status',
        label: 'Status',
        render: (fileSpace: FileSpace) => (
          <Badge
            variant={fileSpace.enabled ? 'success' : 'gray'}
            icon={fileSpace.enabled ? CheckCircle2 : XCircle}
          >
            {fileSpace.enabled ? 'Enabled' : 'Disabled'}
          </Badge>
        ),
        sortable: true,
      },
      {
        key: 'project_id',
        label: 'Project ID',
        render: (fileSpace: FileSpace) => (
          <span className="font-mono text-xs">{this.truncateId(fileSpace.project_id)}</span>
        ),
        sortable: false,
      },
      {
        key: 'created_at',
        label: 'Created At',
        render: (fileSpace: FileSpace) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(fileSpace.created_at)}
          </span>
        ),
        sortable: true,
      },
      {
        key: 'updated_at',
        label: 'Updated At',
        render: (fileSpace: FileSpace) => (
          <span className="text-muted-foreground text-sm">
            {this.formatDate(fileSpace.updated_at)}
          </span>
        ),
        sortable: true,
      },
    ]
  }

  getActions() {
    return [
      {
        label: 'View Details',
        onClick: (fileSpace: FileSpace) => {
          window.location.href = `/file-spaces/${fileSpace.id}`
        },
        variant: 'default' as const,
      },
      {
        label: 'View Project',
        onClick: (fileSpace: FileSpace) => {
          window.location.href = `/projects/${fileSpace.project_id}`
        },
        variant: 'outline' as const,
      },
      {
        label: this.model.enabled ? 'Disable' : 'Enable',
        onClick: async (fileSpace: FileSpace) => {
          // TODO: Implement toggle enabled status
          console.log(`Toggle file space ${fileSpace.id} status`)
        },
        variant: 'outline' as const,
      },
      {
        label: 'Delete',
        onClick: async (fileSpace: FileSpace) => {
          if (confirm(`Are you sure you want to delete "${fileSpace.name}"?`)) {
            // TODO: Implement delete action
            console.log(`Delete file space ${fileSpace.id}`)
          }
        },
        variant: 'destructive' as const,
      },
    ]
  }
}
