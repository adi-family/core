import { Button } from '@adi-simple/ui/button'
import { ExternalLink, Folder, Tag } from "lucide-react"
import { siJira, siGitlab, siGithub } from 'simple-icons'
import type { TaskSource, Project } from "@types"

/**
 * SimpleIcon component to render simple-icons SVG icons
 */
const SimpleIcon = ({ icon, size = 16, color }: { icon: typeof siJira; size?: number; color?: string }) => (
  <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={color || `#${icon.hex}`} className="shrink-0">
    <path d={icon.path} />
  </svg>
)

interface TaskSourceRowProps {
  taskSource: TaskSource
  project?: Project
  onSync?: (taskSource: TaskSource) => void
}

/**
 * TaskSourceRow component displays a task source in a compact row format
 */
export function TaskSourceRow({
  taskSource,
  project,
  onSync,
}: TaskSourceRowProps) {
  const getStatusColor = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower === 'completed' || statusLower === 'success') return 'text-green-400'
    if (statusLower === 'failed' || statusLower === 'error') return 'text-red-400'
    if (statusLower === 'syncing' || statusLower === 'running') return 'text-blue-400'
    if (statusLower === 'queued') return 'text-yellow-400'
    if (statusLower === 'pending') return 'text-gray-400'
    return 'text-gray-400'
  }

  const getTypeIcon = (type: string) => {
    const typeLower = type.toLowerCase()
    if (typeLower === 'gitlab_issues' || typeLower === 'gitlab') {
      return <SimpleIcon icon={siGitlab} size={20} />
    }
    if (typeLower === 'github_issues' || typeLower === 'github') {
      return <SimpleIcon icon={siGithub} size={20} color="#ffffff" />
    }
    if (typeLower === 'jira') {
      return <SimpleIcon icon={siJira} size={20} />
    }
    return <Tag className="h-5 w-5" />
  }

  const getTypeDisplayName = (type: string) => {
    if (type === 'gitlab_issues') return 'GitLab Issues'
    if (type === 'github_issues') return 'GitHub Issues'
    if (type === 'jira') return 'Jira'
    return type
  }

  const getRepositoryOrProject = () => {
    if (taskSource.type === 'gitlab_issues' || taskSource.type === 'github_issues') {
      return taskSource.config.repo
    }
    if (taskSource.type === 'jira') {
      // Ensure we return a string, not an object
      const projectKey = taskSource.config.project_key
      return typeof projectKey === 'string' ? projectKey : null
    }
    return null
  }

  const getLabels = () => {
    if (taskSource.type === 'gitlab_issues') {
      const labels = taskSource.config.labels || []
      // Ensure all labels are strings
      return Array.isArray(labels) ? labels.filter(l => typeof l === 'string') : []
    }
    if (taskSource.type === 'github_issues') {
      const labels = taskSource.config.labels || []
      // Ensure all labels are strings
      return Array.isArray(labels) ? labels.filter(l => typeof l === 'string') : []
    }
    return []
  }

  const getExternalUrl = () => {
    if (taskSource.type === 'gitlab_issues') {
      const host = taskSource.config.host || 'https://gitlab.com'
      return `${host}/${taskSource.config.repo}/-/issues`
    }
    if (taskSource.type === 'github_issues') {
      const host = taskSource.config.host || 'https://github.com'
      return `${host}/${taskSource.config.repo}/issues`
    }
    if (taskSource.type === 'jira') {
      return `${taskSource.config.host}/browse/${taskSource.config.project_key}`
    }
    return null
  }

  const repoOrProject = getRepositoryOrProject()
  const labels = getLabels()
  const externalUrl = getExternalUrl()

  const formatLastSynced = (lastSyncedAt: string | null) => {
    if (!lastSyncedAt) return 'Never'
    const date = new Date(lastSyncedAt)
    const now = new Date()
    const diff = now.getTime() - date.getTime()
    const minutes = Math.floor(diff / 60000)
    const hours = Math.floor(diff / 3600000)
    const days = Math.floor(diff / 86400000)

    if (minutes < 1) return 'Just now'
    if (minutes < 60) return `${minutes}m ago`
    if (hours < 24) return `${hours}h ago`
    return `${days}d ago`
  }

  return (
    <div className="border border-slate-700/50 bg-slate-800/40 backdrop-blur-xl hover:bg-slate-800/60 transition-all duration-200 rounded-lg overflow-hidden">
      {/* Status Bar at Top */}
      <div className="flex flex-wrap gap-4 bg-slate-900/40 px-4 py-2.5 border-b border-slate-700/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Status:</span>
          <span className={`text-xs font-medium ${taskSource.enabled ? 'text-green-400' : 'text-gray-400'}`}>
            {taskSource.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Sync:</span>
          <span className={`text-xs font-medium ${getStatusColor(taskSource.sync_status)}`}>
            {taskSource.sync_status}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Last Synced:</span>
          <span className="text-xs font-medium text-gray-300">
            {formatLastSynced(taskSource.last_synced_at)}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header: Name and Actions */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {getTypeIcon(taskSource.type)}
              <h3 className="text-base font-semibold text-white truncate">
                {taskSource.name}
              </h3>
            </div>
            <p className="text-xs font-mono text-gray-400">
              ID: {taskSource.id.substring(0, 8)}...
            </p>
          </div>
          {onSync && (
            <Button
              variant="default"
              size="sm"
              onClick={() => onSync(taskSource)}
              disabled={!taskSource.enabled}
              className="shrink-0"
            >
              Sync
            </Button>
          )}
        </div>

        {/* Project and Type Info */}
        <div className="flex items-center gap-3 mb-3 text-sm">
          {project && (
            <div className="flex items-center gap-1.5 text-gray-300">
              <Folder className="h-3.5 w-3.5 text-gray-400" />
              <span>{typeof project.name === 'string' ? project.name : 'Unknown Project'}</span>
            </div>
          )}
          <div className="text-gray-400">
            {getTypeDisplayName(taskSource.type)}
          </div>
        </div>

        {/* Repository/Project Info */}
        {repoOrProject && (
          <div className="flex items-center gap-2 text-sm mb-2">
            <span className="text-gray-500">
              {taskSource.type === 'jira' ? 'Project:' : 'Repository:'}
            </span>
            {externalUrl ? (
              <a
                href={externalUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 transition-colors flex items-center gap-1 font-mono text-xs"
              >
                {repoOrProject}
                <ExternalLink className="h-3 w-3" />
              </a>
            ) : (
              <span className="text-gray-300 font-mono text-xs">{repoOrProject}</span>
            )}
          </div>
        )}

        {/* Labels */}
        {labels.length > 0 && (
          <div className="flex items-start gap-2 text-sm">
            <span className="text-gray-500">Labels:</span>
            <div className="flex flex-wrap gap-1.5">
              {labels.map((label, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-2 py-0.5 rounded-md bg-slate-700/50 border border-slate-600/50 text-xs text-gray-300"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* JQL Filter for Jira */}
        {taskSource.type === 'jira' && taskSource.config.jql_filter && (
          <div className="flex items-start gap-2 text-sm mt-2">
            <span className="text-gray-500">JQL:</span>
            <span className="text-gray-300 font-mono text-xs">
              {taskSource.config.jql_filter}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
