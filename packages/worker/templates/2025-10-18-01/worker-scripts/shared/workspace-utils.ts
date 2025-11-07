/**
 * Workspace naming utilities
 * Ensures consistent workspace directory naming across scripts
 */

/**
 * Generate a unique, stable workspace directory name from a file space
 * Format: sanitized-name-{first8chars-of-id}
 *
 * Examples:
 *   - "My Repo!" + "abc123..." → "my-repo-abc123"
 *   - "gitlab.the-ihor.com" + "def456..." → "gitlab-the-ihor-com-def456"
 */
export function getWorkspaceName(fileSpaceName: string, fileSpaceId: string): string {
  // Sanitize the name: replace non-alphanumeric chars with hyphens, lowercase
  const sanitized = fileSpaceName
    .replace(/[^a-zA-Z0-9-]/g, '-')
    .replace(/-+/g, '-') // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-|-$/g, '') // Remove leading/trailing hyphens
    .toLowerCase()

  // Use first 8 characters of the file space ID as unique suffix
  const idSuffix = fileSpaceId.slice(0, 8)

  return `${sanitized}-${idSuffix}`
}
