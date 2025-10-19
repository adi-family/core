import { siGithub } from 'simple-icons'

/**
 * Github icon from simple-icons
 */
export const GithubIcon = ({ className }: { className?: string }) => (
  <svg
    role="img"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
    fill="currentColor"
    className={className}
  >
    <path d={siGithub.path} />
  </svg>
)
