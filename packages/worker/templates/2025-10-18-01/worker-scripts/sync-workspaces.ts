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

async function main() {
  logger.info('🔄 Workspace Sync Started')

  try {
    // Validate environment
    validateEnvironment()

    const projectId = process.env.PROJECT_ID!

    logger.info(`Project ID: ${projectId}`)

    const apiClient = new ApiClient(
      process.env.API_BASE_URL!,
      process.env.API_TOKEN!
    )

    // Clean up orphaned git modules before starting
    await cleanupOrphanedGitModules()

    // Fetch all file spaces for this project
    logger.info('📥 Fetching file spaces from API...')
    const fileSpaces = await apiClient.getFileSpacesByProject(projectId)
    logger.info(`✓ Found ${fileSpaces.length} file space(s)`)

    if (fileSpaces.length === 0) {
      logger.info('ℹ️  No file spaces to sync')
      process.exit(0)
    }

    // Create workspaces directory
    await mkdir('../workspaces', { recursive: true })
    logger.info('✓ Workspaces directory ready')

    // Read or initialize .gitmodules file
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

    // Track which submodules should exist
    const desiredSubmodules = new Set<string>()

    // Add or update each workspace as a submodule
    for (const fileSpace of fileSpaces) {
      if (
        !fileSpace.enabled ||
        !fileSpace.config ||
        typeof fileSpace.config !== 'object' ||
        !('repo' in fileSpace.config)
      ) {
        logger.warn(
          `⚠️  Skipping ${fileSpace.name}: not enabled or missing repo config`
        )
        continue
      }

      const config = fileSpace.config as { repo: string; host?: string; access_token_secret_id?: string }
      let repoUrl = config.repo

      // If repo is not a full URL, construct it from host + repo path
      if (
        !repoUrl.startsWith('http://') &&
        !repoUrl.startsWith('https://') &&
        !repoUrl.startsWith('git@')
      ) {
        const host = config.host || 'https://gitlab.com'
        // Ensure host doesn't end with slash
        const cleanHost = host.replace(/\/$/, '')
        // Ensure repo doesn't start with slash
        const cleanRepo = repoUrl.replace(/^\//, '')
        repoUrl = `${cleanHost}/${cleanRepo}.git`
        logger.info(`   Constructed URL from host: ${repoUrl}`)
      }

      // Inject authentication token into HTTPS URLs for private repos
      // For GitLab, use oauth2 token format: https://oauth2:TOKEN@gitlab.com/repo.git
      if (repoUrl.startsWith('https://') && process.env.GITLAB_TOKEN) {
        const url = new URL(repoUrl)
        // Only inject if no auth is already present
        if (!url.username && !url.password) {
          url.username = 'oauth2'
          url.password = process.env.GITLAB_TOKEN
          repoUrl = url.toString()
          logger.info(`   ✓ Added authentication to URL`)
        }
      }

      const workspaceName = getWorkspaceName(fileSpace.name, fileSpace.id)
      const workspacePath = `workspaces/${workspaceName}`

      desiredSubmodules.add(workspacePath)

      logger.info(`\n📦 Syncing workspace: ${fileSpace.name}`)
      logger.info(`   Repository: ${repoUrl}`)

      try {
        // Final validation - should now always be a valid URL
        if (
          !repoUrl.startsWith('http://') &&
          !repoUrl.startsWith('https://') &&
          !repoUrl.startsWith('git@')
        ) {
          throw new Error(
            `Invalid repository URL format: ${repoUrl}. Must start with http://, https://, or git@`
          )
        }

        // Check if submodule already exists
        if (existingModules.has(workspacePath)) {
          logger.info(`   ✓ Submodule already registered`)

          // Update submodule URL in case it changed
          await exec(`cd .. && git config submodule.${workspacePath}.url ${repoUrl}`)
          logger.info(`   ✓ Submodule URL updated`)
        } else {
          // Add new submodule
          logger.info(`   📦 Adding submodule...`)

          // Check if there's an orphaned .git/modules entry for this specific submodule
          // Git root is parent of template directory, and modules are at .git/modules/<template>/workspaces/
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

        // Initialize and update submodule
        await exec(`cd .. && git submodule update --init --recursive ${workspacePath}`)
        logger.info(`   ✓ Submodule initialized and updated`)
      } catch (error) {
        logger.error(
          `   ❌ Failed to sync ${fileSpace.name}:`,
          error instanceof Error ? error.message : String(error)
        )
        // Continue with other workspaces even if one fails
      }
    }

    // Remove submodules that are no longer in the file spaces list
    logger.info('\n🔍 Checking for old submodules to remove...')
    let removedCount = 0

    for (const existingModule of existingModules) {
      if (existingModule.startsWith('workspaces/') && !desiredSubmodules.has(existingModule)) {
        logger.info(`\n🗑️  Removing old submodule: ${existingModule}`)
        try {
          // Step 1: Deinitialize the submodule
          await exec(`cd .. && git submodule deinit -f ${existingModule}`)
          logger.info(`   ✓ Submodule deinitialized`)

          // Step 2: Remove from git index and working tree
          await exec(`cd .. && git rm -f ${existingModule}`)
          logger.info(`   ✓ Removed from git index`)

          // Step 3: Remove .git/modules entry
          await exec(`cd .. && rm -rf .git/modules/${existingModule}`)
          logger.info(`   ✓ Removed .git/modules entry`)

          // Step 4: Clean up any remaining directory
          await exec(`cd .. && rm -rf ${existingModule}`)
          logger.info(`   ✓ Cleaned up directory`)

          removedCount++
          logger.info(`   ✅ Submodule completely removed`)
        } catch (error) {
          logger.warn(
            `   ⚠️  Failed to remove submodule ${existingModule}:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }
    }

    if (removedCount > 0) {
      logger.info(`\n✅ Removed ${removedCount} old submodule(s)`)
    } else {
      logger.info(`\nℹ️  No old submodules to remove`)
    }

    // Clean up orphaned physical directories in workspaces folder
    logger.info('\n🧹 Cleaning up orphaned workspace directories...')
    try {
      const { stdout: workspacesList } = await exec('cd .. && ls -1 workspaces 2>/dev/null || true')

      if (workspacesList.trim()) {
        const physicalDirs = workspacesList.trim().split('\n')
        let cleanedDirs = 0

        for (const dir of physicalDirs) {
          const workspacePath = `workspaces/${dir}`

          // If this directory is not in our desired submodules list, remove it
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
      }
    } catch (error) {
      logger.warn(`⚠️  Failed to clean up workspace directories: ${error instanceof Error ? error.message : String(error)}`)
    }

    // Commit and push changes to .gitmodules and workspaces if any
    try {
      const { stdout: statusOutput } = await exec('cd .. && git status --porcelain')
      if (statusOutput.trim()) {
        logger.info('\n💾 Committing workspace changes...')

        // Add .gitmodules and workspaces directory
        await exec('cd .. && git add .gitmodules workspaces/ 2>/dev/null || true')

        // Check if there are changes to commit
        const { stdout: diffOutput } = await exec('cd .. && git diff --cached --name-only')
        if (diffOutput.trim()) {
          await exec('cd .. && git commit -m "🔧 Update workspace submodules"')
          logger.info('✓ Changes committed')

          // Get current remote URL and inject token if needed
          let pushUrl = 'origin'
          if (process.env.WORKER_REPO_TOKEN) {
            try {
              const { stdout: remoteUrl } = await exec('cd .. && git remote get-url origin')
              const originalUrl = remoteUrl.trim()
              logger.info(`📍 Original remote URL: ${originalUrl}`)

              // If URL is HTTPS and doesn't have auth, inject the token
              if (originalUrl.startsWith('https://') && !originalUrl.includes('@')) {
                const url = new URL(originalUrl)
                url.username = 'oauth2'
                url.password = process.env.WORKER_REPO_TOKEN
                pushUrl = url.toString()
                logger.info(`✓ Injected authentication into push URL`)
              } else if (originalUrl.startsWith('https://') && originalUrl.includes('@')) {
                // URL already has auth, replace it
                const url = new URL(originalUrl)
                url.username = 'oauth2'
                url.password = process.env.WORKER_REPO_TOKEN
                pushUrl = url.toString()
                logger.info(`✓ Replaced authentication in push URL`)
              }
            } catch {
              logger.warn('Could not get/modify remote URL, using origin')
            }
          }

          // Push changes to remote
          logger.info('📤 Pushing changes to remote...')
          // When pushing to a URL, we need to specify the full refspec
          // Get current branch name - handle detached HEAD state in CI
          const { stdout: branchName } = await exec('cd .. && git rev-parse --abbrev-ref HEAD')
          let branch = branchName.trim()

          // In CI, we might be in detached HEAD state
          // Use CI_COMMIT_REF_NAME or fall back to main/master
          if (branch === 'HEAD') {
            branch = process.env.CI_COMMIT_REF_NAME || 'main'
            logger.info(`⚠️  Detached HEAD detected, using branch: ${branch}`)
          }

          if (pushUrl === 'origin') {
            // Push to named remote
            await exec(`cd .. && git push origin ${branch}`)
          } else {
            // Push to URL with full refspec
            await exec(`cd .. && git push ${pushUrl} HEAD:refs/heads/${branch}`)
          }
          logger.info('✓ Changes pushed successfully')
        } else {
          logger.info('ℹ️  No changes staged for commit')
        }
      } else {
        logger.info('\nℹ️  No changes detected')
      }
    } catch (error) {
      logger.warn(`⚠️  Could not commit/push changes: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info('\n✅ Workspace sync completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Workspace sync failed:', error)
    process.exit(1)
  }
}

main()
