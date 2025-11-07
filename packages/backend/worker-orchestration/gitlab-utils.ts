import { decrypt } from '@shared/crypto-utils'

export interface GitLabSource {
  type: string
  project_id?: string
  project_path?: string
  host?: string
  user?: string
  access_token_encrypted?: string
}

export function validateGitLabSource(source: GitLabSource): void {
  if (!source.project_id || !source.host || !source.access_token_encrypted) {
    throw new Error(
      `Invalid GitLab source configuration. Missing required fields: ${[
        !source.project_id && 'project_id',
        !source.host && 'host',
        !source.access_token_encrypted && 'access_token_encrypted',
      ].filter(Boolean).join(', ')}`
    )
  }
}

export function decryptGitLabToken(encryptedToken: string): string {
  try {
    return decrypt(encryptedToken)
  } catch (error) {
    throw new Error(
      `Failed to decrypt GitLab access token. Please check ENCRYPTION_KEY environment variable. Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    )
  }
}

interface GitlabCredentials {
  host: string
  projectId: string
  accessToken: string
}

export function extractGitLabCredentials(source: GitLabSource): GitlabCredentials {
  validateGitLabSource(source)

  return {
    host: source.host!,
    projectId: source.project_id!,
    accessToken: decryptGitLabToken(source.access_token_encrypted!),
  }
}
