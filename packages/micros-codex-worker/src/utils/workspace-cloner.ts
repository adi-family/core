/**
 * Workspace cloning utility
 * Handles cloning git repositories from project workspace configuration
 */

import { promisify } from 'util'
import { exec as execCallback } from 'child_process'
import { createLogger } from '@utils/logger'
import { existsSync } from 'fs'
import { mkdir } from 'fs/promises'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'workspace-cloner' })

export interface WorkspaceConfig {
  name: string
  repo: string
  branch?: string
  token?: string
}

export interface ClonedWorkspace {
  path: string
  name: string
  repo: string
  branch: string
}

/**
 * Clone workspaces for a task
 */
export async function cloneWorkspaces(
  workspaces: WorkspaceConfig[],
  baseDir: string
): Promise<ClonedWorkspace[]> {
  logger.info(`Cloning ${workspaces.length} workspace(s) to ${baseDir}`)

  // Create base directory
  await mkdir(baseDir, { recursive: true })

  const clonedWorkspaces: ClonedWorkspace[] = []

  for (const workspace of workspaces) {
    const cloned = await cloneWorkspace(workspace, baseDir)
    clonedWorkspaces.push(cloned)
  }

  logger.info(`Successfully cloned ${clonedWorkspaces.length} workspace(s)`)
  return clonedWorkspaces
}

/**
 * Clone a single workspace
 */
async function cloneWorkspace(
  config: WorkspaceConfig,
  baseDir: string
): Promise<ClonedWorkspace> {
  const workspacePath = `${baseDir}/${config.name}`

  logger.info(`Cloning workspace: ${config.name}`)
  logger.info(`  Repository: ${config.repo}`)
  logger.info(`  Branch: ${config.branch || 'default'}`)

  // Check if workspace already exists
  if (existsSync(workspacePath)) {
    logger.info(`  Workspace already exists, pulling latest changes...`)
    try {
      await exec(`cd "${workspacePath}" && git fetch origin && git pull`)
      const { stdout } = await exec(`cd "${workspacePath}" && git branch --show-current`)
      const branch = stdout.trim()
      logger.info(`  ✓ Updated workspace on branch: ${branch}`)
      return {
        path: workspacePath,
        name: config.name,
        repo: config.repo,
        branch
      }
    } catch (error) {
      logger.warn(`  Failed to update existing workspace: ${error}`)
      logger.info(`  Will try to re-clone...`)
      await exec(`rm -rf "${workspacePath}"`)
    }
  }

  // Build git URL with token if provided
  let repoUrl = config.repo
  if (config.token) {
    // Insert token into HTTPS URL
    if (repoUrl.startsWith('https://')) {
      const urlWithoutProtocol = repoUrl.substring(8)
      repoUrl = `https://oauth2:${config.token}@${urlWithoutProtocol}`
    }
  }

  // Clone repository
  const branchArg = config.branch ? `-b ${config.branch}` : ''
  const cloneCmd = `git clone ${branchArg} --depth 1 "${repoUrl}" "${workspacePath}"`

  try {
    await exec(cloneCmd)
    logger.info(`  ✓ Cloned successfully`)
  } catch (error) {
    logger.error(`  ❌ Failed to clone workspace: ${error}`)
    throw new Error(`Failed to clone workspace ${config.name}: ${error}`)
  }

  // Get the branch name
  const { stdout } = await exec(`cd "${workspacePath}" && git branch --show-current`)
  const branch = stdout.trim()

  return {
    path: workspacePath,
    name: config.name,
    repo: config.repo,
    branch
  }
}

/**
 * Create task-specific branch in workspace
 */
export async function createTaskBranch(
  workspacePath: string,
  taskId: string
): Promise<string> {
  const taskBranch = `adi/task-${taskId}`

  logger.info(`Creating task branch: ${taskBranch}`)

  // Get current branch
  const { stdout: currentBranch } = await exec(`cd "${workspacePath}" && git rev-parse --abbrev-ref HEAD`)
  const baseBranch = currentBranch.trim()

  logger.info(`  Base branch: ${baseBranch}`)
  logger.info(`  Fetching latest changes...`)
  await exec(`cd "${workspacePath}" && git fetch origin`)

  // Check if task branch already exists
  let taskBranchExists = false
  try {
    await exec(`cd "${workspacePath}" && git rev-parse --verify origin/${taskBranch}`)
    taskBranchExists = true
    logger.info(`  Found existing task branch: ${taskBranch}`)
  } catch {
    logger.info(`  Task branch does not exist yet: ${taskBranch}`)
  }

  if (taskBranchExists) {
    // Task branch exists - checkout and pull
    logger.info(`  Checking out existing task branch...`)
    try {
      await exec(`cd "${workspacePath}" && git checkout ${taskBranch}`)
    } catch {
      await exec(`cd "${workspacePath}" && git checkout -b ${taskBranch} origin/${taskBranch}`)
    }
    logger.info(`  Pulling latest changes...`)
    await exec(`cd "${workspacePath}" && git pull origin ${taskBranch}`)
    logger.info(`  ✓ Resumed on branch: ${taskBranch}`)
  } else {
    // Create new task branch
    logger.info(`  Pulling latest changes from base branch...`)
    await exec(`cd "${workspacePath}" && git pull origin ${baseBranch}`)
    logger.info(`  Creating new task branch...`)
    await exec(`cd "${workspacePath}" && git checkout -b ${taskBranch}`)
    logger.info(`  ✓ Ready on new branch: ${taskBranch}`)
  }

  return taskBranch
}
