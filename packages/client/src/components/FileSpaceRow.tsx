import { ExternalLink, Folder, GitBranch } from "lucide-react"
import { siGitlab, siGithub } from 'simple-icons'
import type { FileSpace, Project } from "@types"
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'

/**
 * SimpleIcon component to render simple-icons SVG icons
 */
const SimpleIcon = ({ icon, size = 16, color }: { icon: typeof siGitlab; size?: number; color?: string }) => (
  <svg role="img" viewBox="0 0 24 24" width={size} height={size} fill={color || `#${icon.hex}`} className="shrink-0">
    <path d={icon.path} />
  </svg>
)

interface FileSpaceRowProps {
  fileSpace: FileSpace
  project?: Project
}

/**
 * FileSpaceRow component displays a file space in a compact row format
 */
export function FileSpaceRow({
  fileSpace,
  project,
}: FileSpaceRowProps) {
  const getTypeIcon = (type: string) => {
    const typeLower = type.toLowerCase()
    if (typeLower === 'gitlab') {
      return <SimpleIcon icon={siGitlab} size={20} />
    }
    if (typeLower === 'github') {
      return <SimpleIcon icon={siGithub} size={20} color="#ffffff" />
    }
    return <GitBranch className="h-5 w-5" />
  }

  const getRepoUrl = () => {
    if (fileSpace.type === 'gitlab') {
      const host = fileSpace.config.host || DEFAULT_HOSTS.gitlab
      return `${host}/${fileSpace.config.repo}`
    }
    if (fileSpace.type === 'github') {
      const host = fileSpace.config.host || DEFAULT_HOSTS.github
      return `${host}/${fileSpace.config.repo}`
    }
    return null
  }

  const repoUrl = getRepoUrl()

  return (
    <div className="border border-neutral-700/50 bg-neutral-800/40 backdrop-blur-xl hover:bg-neutral-800/60 transition-all duration-200 rounded-lg overflow-hidden">
      {/* Status Bar at Top */}
      <div className="flex flex-wrap gap-4 bg-neutral-900/40 px-4 py-2.5 border-b border-neutral-700/30">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Status:</span>
          <span className={`text-xs font-medium ${fileSpace.enabled ? 'text-green-400' : 'text-gray-400'}`}>
            {fileSpace.enabled ? 'Enabled' : 'Disabled'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-gray-500">Type:</span>
          <span className="text-xs font-medium text-neutral-400 capitalize">
            {fileSpace.type}
          </span>
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        {/* Header: Name and Icon */}
        <div className="flex items-start justify-between gap-4 mb-3">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 mb-2">
              {getTypeIcon(fileSpace.type)}
              <h3 className="text-base font-semibold text-white truncate">
                {fileSpace.name}
              </h3>
            </div>
            <p className="text-xs font-mono text-gray-400">
              ID: {fileSpace.id.substring(0, 8)}...
            </p>
          </div>
        </div>

        {/* Project Info */}
        {project && (
          <div className="flex items-center gap-1.5 text-sm mb-3 text-gray-300">
            <Folder className="h-3.5 w-3.5 text-gray-400" />
            <span>{project.name}</span>
          </div>
        )}

        {/* Repository Info */}
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500">Repository:</span>
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-neutral-400 hover:text-neutral-300 transition-colors flex items-center gap-1 font-mono text-xs"
            >
              {fileSpace.config.repo}
              <ExternalLink className="h-3 w-3" />
            </a>
          ) : (
            <span className="text-gray-300 font-mono text-xs">{fileSpace.config.repo}</span>
          )}
        </div>

        {/* Optional Host Info */}
        {fileSpace.config.host && (
          <div className="flex items-center gap-2 text-sm mt-2">
            <span className="text-gray-500">Host:</span>
            <span className="text-gray-300 font-mono text-xs">{fileSpace.config.host}</span>
          </div>
        )}
      </div>
    </div>
  )
}
