import { siGitlab } from 'simple-icons'

/**
 * GitLab icon component using simple-icons
 */
export const GitLabIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="GitLab">
    <title>{siGitlab.title}</title>
    <path d={siGitlab.path} />
  </svg>
)
