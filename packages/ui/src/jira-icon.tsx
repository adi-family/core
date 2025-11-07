import { siJira } from 'simple-icons'

/**
 * Jira icon component using simple-icons
 */
export const JiraIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="Jira">
    <title>{siJira.title}</title>
    <path d={siJira.path} />
  </svg>
)
