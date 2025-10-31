#!/usr/bin/env bun
/**
 * Workspace Sync Script
 * Manages workspace repositories as Git submodules
 */

import { exec as execCallback } from 'child_process'
import { promisify } from 'util'
import { readFile, mkdir } from 'fs/promises'
import { ApiClient } from './shared/api-client'
import { createLogger } from './shared/logger'
import { getWorkspaceName } from './shared/workspace-utils'

const exec = promisify(execCallback)
const logger = createLogger({ namespace: 'sync-workspaces' })

/**
 * Validate required environment variables
 */
function validateEnvironment(): void {
  const required = ['PROJECT_ID', 'API_BASE_URL', 'API_TOKEN']

  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    throw new Error(
      `Missing required environment variables: ${missing.join(', ')}`
    )
  }

  logger.info('✓ Environment variables validated')
}

/**
 * Clean up orphaned submodule data from .git/modules directory
 * This function aggressively removes ALL workspace-related .git/modules entries
 * and lets the sync process recreate them fresh
 */
async function cleanupOrphanedGitModules(): Promise<void> {
  logger.info('🧹 Cleaning up orphaned .git/modules entries...')

  try {
    // Determine the git root directory (go up to parent since we're in 2025-10-18-01/)
    // Git root is the parent of the template directory
    const gitRoot = '../..'

    // Get the template directory name (e.g., "2025-10-18-01")
    const templateDir = '..'
    const { stdout: templateDirName } = await exec(`cd ${templateDir} && basename $(pwd)`)
    const templateName = templateDirName.trim()

    logger.info(`   Template directory: ${templateName}`)

    // Get list of currently registered submodules in .gitmodules
    const { stdout: submodulesOutput } = await exec(`cd ${gitRoot} && git config --file .gitmodules --get-regexp path 2>/dev/null || true`)
    const registeredSubmodules = new Set<string>()

    if (submodulesOutput.trim()) {
      const lines = submodulesOutput.trim().split('\n')
      for (const line of lines) {
        const match = line.match(/submodule\.(.+?)\.path\s+(.+)/)
        if (match && match[2]) {
          registeredSubmodules.add(match[2])
        }
      }
    }

    logger.info(`   Found ${registeredSubmodules.size} registered submodule(s) in .gitmodules`)

    // Check if .git/modules/<template>/workspaces exists
    const gitModulesPath = `.git/modules/${templateName}/workspaces`
    const { stdout: modulesDirCheck } = await exec(`cd ${gitRoot} && test -d ${gitModulesPath} && echo "exists" || echo "not found"`)

    if (modulesDirCheck.trim() === 'exists') {
      // List all entries in .git/modules/<template>/workspaces directory
      const { stdout: modulesOutput } = await exec(`cd ${gitRoot} && ls -1 ${gitModulesPath} 2>/dev/null || true`)

      if (modulesOutput.trim()) {
        const moduleEntries = modulesOutput.trim().split('\n')
        let cleanedCount = 0

        for (const entry of moduleEntries) {
          const submodulePath = `${templateName}/workspaces/${entry}`

          // Remove if not registered in .gitmodules
          if (!registeredSubmodules.has(submodulePath)) {
            logger.info(`   🗑️  Removing orphaned .git/modules entry: ${submodulePath}`)
            try {
              await exec(`cd ${gitRoot} && rm -rf ${gitModulesPath}/${entry}`)
              logger.info(`   ✓ Orphaned entry removed`)
              cleanedCount++
            } catch (error) {
              logger.warn(`   ⚠️  Failed to remove: ${error instanceof Error ? error.message : String(error)}`)
            }
          }
        }

        if (cleanedCount > 0) {
          logger.info(`✅ Cleaned up ${cleanedCount} orphaned .git/modules entr${cleanedCount === 1 ? 'y' : 'ies'}`)
        } else {
          logger.info('✓ No orphaned .git/modules entries found')
        }
      }
    } else {
      logger.info(`   ℹ️  No ${gitModulesPath} directory found (this is normal for fresh repos)`)
    }
  } catch (error) {
    logger.warn(`⚠️  Orphaned cleanup warning: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Configuration context for workspace sync
 */
interface SyncContext {
  projectId: string
  apiClient: ApiClient
}

/**
 * File space configuration from API
 */
interface FileSpaceConfig {
  repo: string
  host?: string
  access_token_secret_id?: string
}

/**
 * Initialize sync context with API client
 */
function initializeSyncContext(): SyncContext {
  validateEnvironment()

  const projectId = process.env.PROJECT_ID!
  logger.info(`Project ID: ${projectId}`)

  const apiClient = new ApiClient(
    process.env.API_BASE_URL!,
    process.env.API_TOKEN!
  )

  return { projectId, apiClient }
}

/**
 * Fetch and validate file spaces from API
 */
async function fetchFileSpaces(context: SyncContext) {
  logger.info('📥 Fetching file spaces from API...')
  const fileSpaces = await context.apiClient.getFileSpacesByProject(context.projectId)
  logger.info(`✓ Found ${fileSpaces.length} file space(s)`)

  if (fileSpaces.length === 0) {
    logger.info('ℹ️  No file spaces to sync')
    process.exit(0)
  }

  return fileSpaces
}

/**
 * Prepare workspace directory and read existing modules
 */
async function prepareWorkspace() {
  await mkdir('../workspaces', { recursive: true })
  logger.info('✓ Workspaces directory ready')

  let gitmodulesContent = ''
  try {
    gitmodulesContent = await readFile('../.gitmodules', 'utf-8')
    logger.info('✓ Loaded existing .gitmodules')
  } catch {
    logger.info('📝 Creating new .gitmodules file')
  }

  const existingModules = new Set<string>()
  const moduleRegex = /\[submodule "([^"]+)"\]/g
  let match: RegExpExecArray | null
  while ((match = moduleRegex.exec(gitmodulesContent)) !== null) {
    if (match[1]) {
      existingModules.add(match[1])
    }
  }

  return existingModules
}

/**
 * Construct full repository URL from config
 */
function constructRepoUrl(config: FileSpaceConfig): string {
  let repoUrl = config.repo

  if (
    !repoUrl.startsWith('http://') &&
    !repoUrl.startsWith('https://') &&
    !repoUrl.startsWith('git@')
  ) {
    const host = config.host || 'https://gitlab.com'
    const cleanHost = host.replace(/\/$/, '')
    const cleanRepo = repoUrl.replace(/^\//, '')
    repoUrl = `${cleanHost}/${cleanRepo}.git`
    logger.info(`   Constructed URL from host: ${repoUrl}`)
  }

  return repoUrl
}

/**
 * Inject authentication token into HTTPS URL
 */
async function addAuthToUrl(repoUrl: string, config: FileSpaceConfig, apiClient: ApiClient, fileSpaceName: string): Promise<string> {
  if (!repoUrl.startsWith('https://')) {
    return repoUrl
  }

  const url = new URL(repoUrl)
  if (url.username || url.password) {
    return repoUrl
  }

  let token: string | undefined

  if (config.access_token_secret_id) {
    try {
      token = await apiClient.getSecretValue(config.access_token_secret_id)
      logger.info(`   ✓ Using per-workspace token from secret`)
    } catch (error) {
      logger.warn(
        `   ⚠️  Failed to fetch workspace token: ${error instanceof Error ? error.message : String(error)}`
      )
      logger.warn(`   ⚠️  Falling back to GITLAB_TOKEN environment variable`)
      token = process.env.GITLAB_TOKEN
    }
  } else {
    token = process.env.GITLAB_TOKEN
    if (token) {
      logger.info(`   ✓ Using global GITLAB_TOKEN`)
    }
  }

  if (token) {
    url.username = 'oauth2'
    url.password = token
    logger.info(`   ✓ Added authentication to URL`)
    return url.toString()
  }

  logger.warn(`   ⚠️  No authentication token available for ${fileSpaceName}`)
  return repoUrl
}

/**
 * Validate repository URL format
 */
function validateRepoUrl(repoUrl: string): void {
  if (
    !repoUrl.startsWith('http://') &&
    !repoUrl.startsWith('https://') &&
    !repoUrl.startsWith('git@')
  ) {
    throw new Error(
      `Invalid repository URL format: ${repoUrl}. Must start with http://, https://, or git@`
    )
  }
}

/**
 * Add or update a git submodule
 */
async function syncSubmodule(workspacePath: string, repoUrl: string, existingModules: Set<string>): Promise<void> {
  if (existingModules.has(workspacePath)) {
    logger.info(`   ✓ Submodule already registered`)
    await exec(`cd .. && git config submodule.${workspacePath}.url ${repoUrl}`)
    logger.info(`   ✓ Submodule URL updated`)
  } else {
    logger.info(`   📦 Adding submodule...`)

    const workspaceName = workspacePath.split('/')[1]
    const { stdout: templateDirName } = await exec('cd .. && basename $(pwd)')
    const templateName = templateDirName.trim()
    const gitModulePath = `.git/modules/${templateName}/workspaces/${workspaceName}`

    const { stdout: gitModuleCheck } = await exec(`cd ../.. && test -d ${gitModulePath} && echo "exists" || echo "not found"`)

    if (gitModuleCheck.trim() === 'exists') {
      logger.info(`   🧹 Found orphaned .git/modules entry, cleaning up...`)
      await exec(`cd ../.. && rm -rf ${gitModulePath}`)
      logger.info(`   ✓ Cleaned up orphaned entry`)
    }

    await exec(`cd .. && git submodule add ${repoUrl} ${workspacePath}`)
    logger.info(`   ✓ Submodule added`)
  }

  await exec(`cd .. && git submodule update --init --recursive ${workspacePath}`)
  logger.info(`   ✓ Submodule initialized and updated`)
}

/**
 * Process a single file space and sync as submodule
 */
async function processFileSpace(fileSpace: any, apiClient: ApiClient, existingModules: Set<string>): Promise<string | null> {
  if (
    !fileSpace.enabled ||
    !fileSpace.config ||
    typeof fileSpace.config !== 'object' ||
    !('repo' in fileSpace.config)
  ) {
    logger.warn(
      `⚠️  Skipping ${fileSpace.name}: not enabled or missing repo config`
    )
    return null
  }

  const config = fileSpace.config as FileSpaceConfig
  let repoUrl = constructRepoUrl(config)
  repoUrl = await addAuthToUrl(repoUrl, config, apiClient, fileSpace.name)

  const workspaceName = getWorkspaceName(fileSpace.name, fileSpace.id)
  const workspacePath = `workspaces/${workspaceName}`

  logger.info(`\n📦 Syncing workspace: ${fileSpace.name}`)
  logger.info(`   Repository: ${repoUrl}`)

  try {
    validateRepoUrl(repoUrl)
    await syncSubmodule(workspacePath, repoUrl, existingModules)
    return workspacePath
  } catch (error) {
    logger.error(
      `   ❌ Failed to sync ${fileSpace.name}:`,
      error instanceof Error ? error.message : String(error)
    )
    return null
  }
}

/**
 * Process all file spaces and return desired submodules
 */
async function syncAllFileSpaces(fileSpaces: any[], apiClient: ApiClient, existingModules: Set<string>): Promise<Set<string>> {
  const desiredSubmodules = new Set<string>()

  for (const fileSpace of fileSpaces) {
    const workspacePath = await processFileSpace(fileSpace, apiClient, existingModules)
    if (workspacePath) {
      desiredSubmodules.add(workspacePath)
    }
  }

  return desiredSubmodules
}

/**
 * Remove a single submodule completely
 */
async function removeSubmodule(modulePath: string): Promise<void> {
  logger.info(`\n🗑️  Removing old submodule: ${modulePath}`)

  await exec(`cd .. && git submodule deinit -f ${modulePath}`)
  logger.info(`   ✓ Submodule deinitialized`)

  await exec(`cd .. && git rm -f ${modulePath}`)
  logger.info(`   ✓ Removed from git index`)

  await exec(`cd .. && rm -rf .git/modules/${modulePath}`)
  logger.info(`   ✓ Removed .git/modules entry`)

  await exec(`cd .. && rm -rf ${modulePath}`)
  logger.info(`   ✓ Cleaned up directory`)

  logger.info(`   ✅ Submodule completely removed`)
}

/**
 * Remove submodules no longer in file spaces list
 */
async function removeOldSubmodules(existingModules: Set<string>, desiredSubmodules: Set<string>): Promise<void> {
  logger.info('\n🔍 Checking for old submodules to remove...')
  let removedCount = 0

  for (const existingModule of existingModules) {
    if (!existingModule.startsWith('workspaces/')) continue
    if (desiredSubmodules.has(existingModule)) continue

    try {
      await removeSubmodule(existingModule)
      removedCount++
    } catch (error) {
      logger.warn(
        `   ⚠️  Failed to remove submodule ${existingModule}:`,
        error instanceof Error ? error.message : String(error)
      )
    }
  }

  if (removedCount > 0) {
    logger.info(`\n✅ Removed ${removedCount} old submodule(s)`)
  } else {
    logger.info(`\nℹ️  No old submodules to remove`)
  }
}

/**
 * Clean up orphaned workspace directories
 */
async function cleanupOrphanedDirectories(desiredSubmodules: Set<string>): Promise<void> {
  logger.info('\n🧹 Cleaning up orphaned workspace directories...')

  try {
    const { stdout: workspacesList } = await exec('cd .. && ls -1 workspaces 2>/dev/null || true')
    if (!workspacesList.trim()) return

    const physicalDirs = workspacesList.trim().split('\n')
    let cleanedDirs = 0

    for (const dir of physicalDirs) {
      const workspacePath = `workspaces/${dir}`

      if (!desiredSubmodules.has(workspacePath)) {
        logger.info(`   🗑️  Removing orphaned directory: ${workspacePath}`)
        try {
          await exec(`cd .. && rm -rf ${workspacePath}`)
          logger.info(`   ✓ Directory removed`)
          cleanedDirs++
        } catch (error) {
          logger.warn(
            `   ⚠️  Failed to remove directory ${workspacePath}:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }
    }

    if (cleanedDirs > 0) {
      logger.info(`✅ Cleaned up ${cleanedDirs} orphaned workspace director${cleanedDirs === 1 ? 'y' : 'ies'}`)
    } else {
      logger.info(`ℹ️  No orphaned workspace directories found`)
    }
  } catch (error) {
    logger.warn(`⚠️  Failed to clean up workspace directories: ${error instanceof Error ? error.message : String(error)}`)
  }
}

/**
 * Get authenticated push URL if token available
 */
async function getPushUrl(): Promise<string> {
  if (!process.env.WORKER_REPO_TOKEN) {
    return 'origin'
  }

  try {
    const { stdout: remoteUrl } = await exec('cd .. && git remote get-url origin')
    const originalUrl = remoteUrl.trim()
    logger.info(`📍 Original remote URL: ${originalUrl}`)

    if (!originalUrl.startsWith('https://')) {
      return 'origin'
    }

    const url = new URL(originalUrl)
    url.username = 'oauth2'
    url.password = process.env.WORKER_REPO_TOKEN

    logger.info(`✓ ${originalUrl.includes('@') ? 'Replaced' : 'Injected'} authentication in push URL`)
    return url.toString()
  } catch {
    logger.warn('Could not get/modify remote URL, using origin')
    return 'origin'
  }
}

/**
 * Get current branch name, handling detached HEAD state
 */
async function getCurrentBranch(): Promise<string> {
  const { stdout: branchName } = await exec('cd .. && git rev-parse --abbrev-ref HEAD')
  const branch = branchName.trim()

  if (branch === 'HEAD') {
    const fallbackBranch = process.env.CI_COMMIT_REF_NAME || 'main'
    logger.info(`⚠️  Detached HEAD detected, using branch: ${fallbackBranch}`)
    return fallbackBranch
  }

  return branch
}

/**
 * Commit and push changes if any
 */
async function commitAndPushChanges(): Promise<void> {
  try {
    const { stdout: statusOutput } = await exec('cd .. && git status --porcelain')
    if (!statusOutput.trim()) {
      logger.info('\nℹ️  No changes detected')
      return
    }

    logger.info('\n💾 Committing workspace changes...')
    await exec('cd .. && git add .gitmodules workspaces/ 2>/dev/null || true')

    const { stdout: diffOutput } = await exec('cd .. && git diff --cached --name-only')
    if (!diffOutput.trim()) {
      logger.info('ℹ️  No changes staged for commit')
      return
    }

    await exec('cd .. && git commit -m "🔧 Update workspace submodules"')
    logger.info('✓ Changes committed')

    const pushUrl = await getPushUrl()
    const branch = await getCurrentBranch()

    logger.info('📤 Pushing changes to remote...')
    if (pushUrl === 'origin') {
      await exec(`cd .. && git push origin ${branch}`)
    } else {
      await exec(`cd .. && git push ${pushUrl} HEAD:refs/heads/${branch}`)
    }
    logger.info('✓ Changes pushed successfully')
  } catch (error) {
    logger.warn(`⚠️  Could not commit/push changes: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function main() {
  logger.info('🔄 Workspace Sync Started')

  try {
    const context = initializeSyncContext()
    await cleanupOrphanedGitModules()

    const fileSpaces = await fetchFileSpaces(context)
    const existingModules = await prepareWorkspace()
    const desiredSubmodules = await syncAllFileSpaces(fileSpaces, context.apiClient, existingModules)

    await removeOldSubmodules(existingModules, desiredSubmodules)
    await cleanupOrphanedDirectories(desiredSubmodules)
    await commitAndPushChanges()

    logger.info('\n✅ Workspace sync completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Workspace sync failed:', error)
    process.exit(1)
  }
}

main()
