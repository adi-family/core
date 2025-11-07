import { siGithub } from 'simple-icons'

/**
 * GitHub icon component using simple-icons
 */
export const GitHubIcon = ({ className = "w-5 h-5" }: { className?: string }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" role="img" aria-label="GitHub">
    <title>{siGithub.title}</title>
    <path d={siGithub.path} />
  </svg>
)
