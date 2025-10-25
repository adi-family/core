/**
 * GitLab utility functions for pipeline operations
 * Shared utilities for validating and decrypting GitLab credentials
 */

import { decrypt } from '@shared/crypto-utils'

/**
 * GitLab source configuration type
 */
export interface GitLabSource {
  type: string
  project_id?: string
  project_path?: string
  host?: string
  user?: string
  access_token_encrypted?: string
}

/**
 * Validate GitLab source has required fields
 * @throws Error if validation fails
 */
export function validateGitLabSource(source: GitLabSource): void {
  if (!source.project_id || !source.host || !source.access_token_encrypted) {
    throw new Error(
      `Invalid GitLab source configuration. Missing required fields: ${[
        !source.project_id && 'project_id',
        !source.host && 'host',
        !source.access_token_encrypted && 'access_token_encrypted',
      ]
        .filter(Boolean)
        .join(', ')}`
    )
  }
}

/**
 * Decrypt GitLab access token with proper error handling
 * @throws Error with detailed message if decryption fails
 */
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

/**
 * Extract GitLab credentials from source with validation and decryption
 * @returns Validated and decrypted credentials
 */
export function extractGitLabCredentials(source: GitLabSource): {
  host: string
  projectId: string
  accessToken: string
} {
  validateGitLabSource(source)

  return {
    host: source.host!,
    projectId: source.project_id!,
    accessToken: decryptGitLabToken(source.access_token_encrypted!),
  }
}
