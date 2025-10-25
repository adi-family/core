import { BasePresenter } from './base'
import { navigateTo } from '@/utils/navigation'
import type { FileSpace } from '@types'
import { Badge } from '@adi-simple/ui/badge'
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
          navigateTo(`/file-spaces/${fileSpace.id}`)
        },
        variant: 'default' as const,
      },
      {
        label: 'View Project',
        onClick: (fileSpace: FileSpace) => {
          navigateTo(`/projects/${fileSpace.project_id}`)
        },
        variant: 'outline' as const,
      },
      {
        label: this.model.enabled ? 'Disable' : 'Enable',
        onClick: async (fileSpace: FileSpace) => {
          const { client } = await import('@/lib/client')
          const res = await client["file-spaces"][":id"].$patch({
            param: { id: fileSpace.id },
            json: {
              type: fileSpace.type,
              enabled: !fileSpace.enabled
            } as any
          })
          if (!res.ok) {
            console.error('Failed to toggle file space status')
          }
          this.onRefresh?.()
        },
        variant: 'outline' as const,
      },
      this.getDeleteAction(
        (fileSpace) => `Are you sure you want to delete "${fileSpace.name}"?`,
        async (fileSpace) => {
          const { client } = await import('@/lib/client')
          const res = await client["file-spaces"][":id"].$delete({
            param: { id: fileSpace.id }
          })
          if (!res.ok) {
            console.error('Failed to delete file space')
          }
          this.onRefresh?.()
        }
      ),
    ]
  }
}
