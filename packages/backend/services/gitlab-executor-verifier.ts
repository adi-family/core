/**
 * GitLab Executor Verifier
 * Verifies GitLab access tokens for project-level pipeline executors
 */

import { GitLabApiClient } from '@shared/gitlab-api-client'
import { createLogger } from '@utils/logger'

const logger = createLogger({ namespace: 'gitlab-executor-verifier' })

export interface VerifyExecutorInput {
  host: string
  access_token: string
}

export interface VerifyExecutorResult {
  valid: boolean
  user?: string
  userId?: number
  error?: string
}

/**
 * Verify GitLab access token by calling the GitLab API
 * Returns user information if valid
 */
export async function verifyGitLabExecutor(
  input: VerifyExecutorInput
): Promise<VerifyExecutorResult> {
  const { host, access_token } = input

  try {
    logger.info(`Verifying GitLab executor for host: ${host}`)

    // Create GitLab client with provided token
    const client = new GitLabApiClient(host, access_token)

    // Try to get current user information
    // This validates both the host and the token
    const user = await client.getCurrentUser()

    logger.info(`✓ GitLab executor verified: ${user.username} (${user.id})`)

    return {
      valid: true,
      user: user.username,
      userId: user.id
    }
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    logger.error(`✗ GitLab executor verification failed: ${errorMsg}`)

    return {
      valid: false,
      error: errorMsg
    }
  }
}
