#!/usr/bin/env bun
/**
 * Push to File Spaces Script
 * Pushes changes made by Claude Agent to file space repositories and creates merge requests
 */

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { readdir } from 'fs/promises'
import { ApiClient } from './shared/api-client'
import { createLogger } from './shared/logger'
import { GitLabApiClient } from '@shared/gitlab-api-client'
import { GitHubApiClient } from '@shared/github-api-client'
import { getWorkspaceName } from './shared/workspace-utils'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'push-to-file-spaces' })

interface MergeRequestResult {
  fileSpaceId: string
  fileSpaceName: string
  workspacePath: string
  branchName: string
  mrUrl: string
  mrIid: number
  hasChanges: boolean
  provider: 'gitlab' | 'github'
}

interface PushResult {
  mergeRequests: MergeRequestResult[]
  errors: { fileSpaceId: string; error: string }[]
}

/**
 * Check if a workspace directory has uncommitted changes
 */
async function hasChanges(workspacePath: string): Promise<boolean> {
  try {
    const { stdout } = await exec(`cd ${workspacePath} && git status --porcelain`)
    return stdout.trim().length > 0
  } catch (error) {
    logger.error(`Failed to check git status in ${workspacePath}:`, error)
    return false
  }
}

/**
 * Get the GitLab API client for a file space
 */
function getGitLabClient(fileSpace: unknown, token: string, tokenType: 'oauth' | 'pat' | 'api' | null): GitLabApiClient | null {
  if (!fileSpace.config || typeof fileSpace.config !== 'object') {
    return null
  }

  const config = fileSpace.config as { host?: string; access_token_secret_id?: string; repo?: string }

  // Extract host from config or repo URL
  let host = config.host || 'https://gitlab.com'

  // If host doesn't include protocol, add it
  if (!host.startsWith('http://') && !host.startsWith('https://')) {
    host = `https://${host}`
  }

  // Clean up trailing slash
  host = host.replace(/\/$/, '')

  if (!token) {
    logger.warn('Token not provided, cannot create GitLab client')
    return null
  }

  // Map token type to GitLab client auth type
  // 'api' tokens are treated as PAT for GitLab
  const clientTokenType = (tokenType === 'oauth') ? 'oauth' : 'pat'

  logger.info(`   🔐 Creating GitLab API client:`)
  logger.info(`      Host: ${host}`)
  logger.info(`      Token length: ${token.length} chars`)
  logger.info(`      Token starts with: ${token.substring(0, 8)}...`)
  logger.info(`      Token type from DB: '${tokenType}'`)
  logger.info(`      Using auth type: '${clientTokenType}' (${clientTokenType === 'oauth' ? 'Bearer' : 'PRIVATE-TOKEN'} header)`)

  return new GitLabApiClient(host, token, clientTokenType)
}

/**
 * Get the GitHub API client for a file space
 */
function getGitHubClient(fileSpace: unknown, token: string): GitHubApiClient | null {
  if (!fileSpace.config || typeof fileSpace.config !== 'object') {
    return null
  }

  const config = fileSpace.config as { host?: string; access_token_secret_id?: string; repo?: string }

  // Extract host from config
  const host = config.host || 'https://api.github.com'

  if (!token) {
    logger.warn('Token not provided, cannot create GitHub client')
    return null
  }

  logger.info(`   🔐 Creating GitHub API client:`)
  logger.info(`      Host: ${host}`)
  logger.info(`      Token length: ${token.length} chars`)
  logger.info(`      Token starts with: ${token.substring(0, 8)}...`)

  return new GitHubApiClient(token, host)
}

/**
 * Extract project path from repository URL or config
 */
function getProjectPath(fileSpace: unknown): string | null {
  if (!fileSpace.config || typeof fileSpace.config !== 'object' || !('repo' in fileSpace.config)) {
    return null
  }

  const config = fileSpace.config as { repo: string; host?: string }
  let repo = config.repo

  // If repo is a full URL, extract the path
  if (repo.startsWith('http://') || repo.startsWith('https://')) {
    try {
      const url = new URL(repo)
      // Remove leading slash and .git suffix
      const path = url.pathname.replace(/^\//, '').replace(/\.git$/, '')
      return path
    } catch {
      return null
    }
  }

  // If repo is already a path (e.g., "username/project"), clean it up
  repo = repo.replace(/^\//, '').replace(/\.git$/, '')
  return repo
}

/**
 * Push changes from a workspace to its file space and create a merge request
 */
async function pushWorkspaceToFileSpace(
  workspacePath: string,
  fileSpace: any,
  taskId: string,
  taskTitle: string,
  taskDescription: string | null,
  accessToken: string,
  tokenType: 'oauth' | 'pat' | 'api' | null
): Promise<MergeRequestResult> {
  const workspaceName = workspacePath.split('/').pop() || 'unknown'

  logger.info(`\n📦 Processing workspace: ${workspaceName}`)
  logger.info(`   File space: ${fileSpace.name}`)
  logger.info(`   Path: ${workspacePath}`)

  // Check if there are changes
  const changesExist = await hasChanges(workspacePath)
  if (!changesExist) {
    logger.info(`   ℹ️  No changes detected, skipping`)
    throw new Error('No changes to push')
  }

  logger.info(`   ✓ Changes detected`)

  // Get current branch (should already be on task branch from claude-pipeline)
  const { stdout: currentBranch } = await exec(`cd ${workspacePath} && git branch --show-current`)
  let branchName = currentBranch.trim()

  // If not on a branch or on main/master, create task branch
  if (!branchName || branchName === 'main' || branchName === 'master' || branchName === 'HEAD') {
    branchName = `adi/task-${taskId}`
    logger.info(`   🌿 Creating task branch: ${branchName}`)
    await exec(`cd ${workspacePath} && git checkout -b ${branchName}`)
    logger.info(`   ✓ Branch created`)
  } else {
    logger.info(`   ✓ Using existing branch: ${branchName}`)
  }

  // Get absolute path to workspace to avoid submodule issues
  const { stdout: absPath } = await exec(`cd ${workspacePath} && pwd`)
  const absoluteWorkspacePath = absPath.trim()
  logger.info(`   📍 Absolute path: ${absoluteWorkspacePath}`)

  // Verify workspace is a valid git repository
  try {
    await exec(`cd "${absoluteWorkspacePath}" && git rev-parse --git-dir`)
    logger.info(`   ✓ Git repository verified`)
  } catch (error) {
    throw new Error(`Workspace is not a valid git repository: ${error instanceof Error ? error.message : String(error)}`)
  }

  // Configure git user
  await exec(`cd "${absoluteWorkspacePath}" && git config user.email "ci@adi-pipeline.dev"`)
  await exec(`cd "${absoluteWorkspacePath}" && git config user.name "ADI Pipeline"`)

  // Stage all changes
  logger.info(`   📦 Staging changes...`)
  await exec(`cd "${absoluteWorkspacePath}" && git add -A`)

  // Create commit
  const commitMessage = `🤖 ${taskTitle}\n\n${taskDescription || ''}\n\nImplemented by ADI Pipeline\nTask ID: ${taskId}`
  logger.info(`   💾 Creating commit...`)
  await exec(`cd "${absoluteWorkspacePath}" && git commit -m "${commitMessage.replace(/"/g, '\\"')}"`)
  logger.info(`   ✓ Commit created`)

  // Get the remote URL and inject authentication
  const { stdout: remoteUrl } = await exec(`cd "${absoluteWorkspacePath}" && git remote get-url origin`)
  let pushUrl = remoteUrl.trim()

  // Inject token if available and URL is HTTPS
  if (pushUrl.startsWith('https://') && accessToken) {
    const url = new URL(pushUrl)
    // GitHub uses 'x-access-token' or the token directly as username
    // GitLab uses 'oauth2' as username
    if (fileSpace.type === 'github') {
      url.username = 'x-access-token'
      url.password = accessToken
    } else {
      url.username = 'oauth2'
      url.password = accessToken
    }
    pushUrl = url.toString()
    logger.info(`   ✓ Authentication injected`)
  }

  // Push branch to remote with explicit origin (force push to handle retries/conflicts)
  logger.info(`   📤 Pushing branch to remote (force)...`)
  await exec(`cd "${absoluteWorkspacePath}" && git push -f origin ${branchName}`)
  logger.info(`   ✓ Branch pushed`)

  // Determine target branch for merge request
  let defaultBranch = 'main' // final fallback

  // First, check if file space has a configured default branch
  if (fileSpace.default_branch) {
    defaultBranch = fileSpace.default_branch
    logger.info(`   ✓ Using configured default branch: ${defaultBranch}`)
  } else {
    // Detect default branch from remote HEAD
    logger.info(`   🔍 Detecting default branch...`)
    try {
      const { stdout } = await exec(`cd "${absoluteWorkspacePath}" && git symbolic-ref refs/remotes/origin/HEAD | sed 's@^refs/remotes/origin/@@'`)
      defaultBranch = stdout.trim()
      logger.info(`   ✓ Default branch: ${defaultBranch}`)
    } catch {
      // Fallback: try common default branch names in order
      logger.warn(`   ⚠️  Could not detect via symbolic-ref, trying common branch names...`)
      const fallbackBranches = ['develop', 'dev', 'development', 'main', 'master']

      for (const branch of fallbackBranches) {
        try {
          await exec(`cd "${absoluteWorkspacePath}" && git rev-parse --verify origin/${branch}`)
          defaultBranch = branch
          logger.info(`   ✓ Default branch (fallback): ${defaultBranch}`)
          break
        } catch {
          // Branch doesn't exist, try next
        }
      }

      if (!fallbackBranches.includes(defaultBranch)) {
        logger.warn(`   ⚠️  No common branches found, using final fallback: ${defaultBranch}`)
      }
    }
  }

  // Create merge/pull request based on provider
  logger.info(`   🔀 Creating ${fileSpace.type === 'github' ? 'pull' : 'merge'} request...`)

  const projectPath = getProjectPath(fileSpace)
  if (!projectPath) {
    throw new Error('Could not extract project path from file space config')
  }

  logger.info(`   📍 Project path: ${projectPath}`)

  // Build MR/PR description
  let description = `${taskDescription || 'Automated task implementation'}\n\n`
  description += `## Task Details\n\n`
  description += `**Task ID**: ${taskId}\n`
  description += `**Title**: ${taskTitle}\n\n`
  description += `---\n`
  description += `🤖 Automated by ADI Pipeline\n`

  let mr: any
  let mrUrl: string
  let mrIid: number | string

  if (fileSpace.type === 'github') {
    // Handle GitHub pull request
    const githubClient = getGitHubClient(fileSpace, accessToken)
    if (!githubClient) {
      throw new Error('Could not create GitHub client - missing token or host')
    }

    const [owner, repo] = projectPath.split('/')
    if (!owner || !repo) {
      throw new Error(`Invalid GitHub repository path: ${projectPath}. Expected format: owner/repo`)
    }

    try {
      const pr = await githubClient.createPullRequest(
        owner,
        repo,
        taskTitle,
        branchName,
        defaultBranch,
        description
      )

      mrUrl = pr.html_url
      mrIid = pr.number
      logger.info(`   ✓ Pull request created: #${pr.number}`)
      logger.info(`   🔗 URL: ${pr.html_url}`)
    } catch (error) {
      // Check if PR already exists
      if (error?.message?.includes('A pull request already exists') || error?.message?.includes('already exists')) {
        logger.info(`   ℹ️  Pull request already exists, skipping creation`)
        // Estimate PR URL (best effort)
        mrUrl = `https://github.com/${owner}/${repo}/pulls`
        mrIid = 'unknown'
      } else {
        throw error
      }
    }
  } else {
    // Handle GitLab merge request
    const gitlabClient = getGitLabClient(fileSpace, accessToken, tokenType)
    if (!gitlabClient) {
      throw new Error('Could not create GitLab client - missing token or host')
    }

    try {
      mr = await gitlabClient['client'].MergeRequests.create(
        projectPath,
        branchName,
        defaultBranch,
        taskTitle,
        {
          description,
          removeSourceBranch: true,
        }
      ) as any

      mrUrl = mr.web_url
      mrIid = mr.iid
      logger.info(`   ✓ Merge request created: !${mr.iid}`)
      logger.info(`   🔗 URL: ${mr.web_url}`)
    } catch (error) {
      // Check if MR already exists (409 Conflict)
      if (error?.cause?.response?.statusCode === 409 || error?.message?.includes('409') || error?.message?.includes('already exists')) {
        const mrMatch = error.message?.match(/!(\d+)/)
        const existingMrNumber = mrMatch ? mrMatch[1] : 'unknown'

        logger.info(`   ℹ️  Merge request already exists: !${existingMrNumber}, skipping creation`)

        mrUrl = `${gitlabClient['host']}/${projectPath}/-/merge_requests/${existingMrNumber}`
        mrIid = existingMrNumber
      } else {
        throw error
      }
    }
  }

  return {
    fileSpaceId: fileSpace.id,
    fileSpaceName: fileSpace.name,
    workspacePath,
    branchName,
    mrUrl,
    mrIid: typeof mrIid === 'number' ? mrIid : parseInt(mrIid, 10) || 0,
    hasChanges: true,
    provider: fileSpace.type,
  }
}

/**
 * Main function to push all workspaces to their file spaces
 */
async function main(): Promise<PushResult> {
  logger.info('🚀 Push to File Spaces Started')

  const result: PushResult = {
    mergeRequests: [],
    errors: [],
  }

  try {
    // Validate environment
    const requiredVars = ['SESSION_ID', 'API_BASE_URL', 'API_TOKEN']
    const missing = requiredVars.filter((key) => !process.env[key])

    if (missing.length > 0) {
      throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
    }

    const sessionId = process.env.SESSION_ID!
    logger.info(`Session ID: ${sessionId}`)

    // Create API client
    const apiClient = new ApiClient(process.env.API_BASE_URL!, process.env.API_TOKEN!)

    // Get session and task
    logger.info('📥 Fetching session...')
    const session = await apiClient.getSession(sessionId)

    if (!session.task_id) {
      throw new Error('Session has no associated task')
    }

    logger.info('📥 Fetching task...')
    const task = await apiClient.getTask(session.task_id)
    logger.info(`✓ Task loaded: ${task.title}`)

    // Get project ID from task
    if (!task.project_id) {
      throw new Error('Task has no associated project')
    }

    // Get file spaces for the project (file spaces are project-level, not task-level)
    logger.info('📥 Fetching file spaces for project...')
    const fileSpaces = await apiClient.getFileSpacesByProject(task.project_id)
    logger.info(`✓ Found ${fileSpaces.length} file space(s)`)

    if (fileSpaces.length === 0) {
      logger.info('ℹ️  No file spaces configured for this project')
      return result
    }

    // Get all workspace directories from environment or default location
    const workspacesDir = process.env.PIPELINE_EXECUTION_ID
      ? `/tmp/workspace-${process.env.PIPELINE_EXECUTION_ID}`
      : '../workspaces'

    const entries = await readdir(workspacesDir, { withFileTypes: true })
    const workspaces = entries
      .filter(entry => entry.isDirectory() && !entry.name.startsWith('.'))
      .map(entry => ({
        name: entry.name,
        path: `${workspacesDir}/${entry.name}`
      }))

    logger.info(`📦 Found ${workspaces.length} workspace(s)`)

    // Process each file space
    for (const fileSpace of fileSpaces) {
      if (!fileSpace.enabled) {
        logger.info(`⏭️  Skipping disabled file space: ${fileSpace.name}`)
        continue
      }

      // Get the access token for this file space
      let accessToken: string | null = null
      let tokenType: 'oauth' | 'pat' | 'api' | null = null
      if (fileSpace.config && fileSpace.config.access_token_secret_id) {
        try {
          logger.info(`🔑 Retrieving token for file space: ${fileSpace.name}`)
          const secretData = await apiClient.getSecretValue(fileSpace.config.access_token_secret_id)
          accessToken = secretData.value
          tokenType = secretData.token_type
          logger.info(`✓ Token retrieved successfully (type: ${tokenType})`)
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error)
          logger.error(`❌ Failed to retrieve token for ${fileSpace.name}: ${errorMsg}`)
          result.errors.push({
            fileSpaceId: fileSpace.id,
            error: `Failed to retrieve access token: ${errorMsg}`
          })
          continue
        }
      }

      if (!accessToken) {
        logger.error(`❌ No access token configured for file space: ${fileSpace.name}`)
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: 'No access token configured (access_token_secret_id missing)'
        })
        continue
      }

      // Find matching workspace
      const workspaceName = getWorkspaceName(fileSpace.name, fileSpace.id)
      const workspace = workspaces.find(ws => ws.name === workspaceName)

      if (!workspace) {
        logger.warn(`⚠️  No workspace found for file space: ${fileSpace.name}`)
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: 'No matching workspace directory found'
        })
        continue
      }

      try {
        const mrResult = await pushWorkspaceToFileSpace(
          workspace.path,
          fileSpace,
          task.id,
          task.title,
          task.description,
          accessToken,
          tokenType
        )
        result.mergeRequests.push(mrResult)
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        logger.error(`❌ Failed to push ${fileSpace.name}: ${errorMsg}`)
        result.errors.push({
          fileSpaceId: fileSpace.id,
          error: errorMsg
        })
      }
    }

    logger.info('\n✅ Push to file spaces completed')
    logger.info(`   Created ${result.mergeRequests.length} merge request(s)`)
    logger.info(`   Encountered ${result.errors.length} error(s)`)

    return result
  } catch (error) {
    logger.error('❌ Push to file spaces failed:', error)
    throw error
  }
}

// Export for use in other scripts
export { main as pushToFileSpaces, type PushResult, type MergeRequestResult }

// Run if called directly (not from worker binary)
if (!process.env.__WORKER_BINARY__) {
  const isMainModule = import.meta.url === `file://${process.argv[1]}`
  if (isMainModule) {
    main()
      .then(() => process.exit(0))
      .catch((error) => {
        logger.error('Fatal error:', error)
        process.exit(1)
      })
  }
}
