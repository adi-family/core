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

      const workspaceName = fileSpace.name
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase()
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
    for (const existingModule of existingModules) {
      if (existingModule.startsWith('workspaces/') && !desiredSubmodules.has(existingModule)) {
        logger.info(`\n🗑️  Removing old submodule: ${existingModule}`)
        try {
          await exec(`cd .. && git submodule deinit -f ${existingModule}`)
          await exec(`cd .. && git rm -f ${existingModule}`)
          await exec(`cd .. && rm -rf .git/modules/${existingModule}`)
          logger.info(`   ✓ Submodule removed`)
        } catch (error) {
          logger.warn(
            `   ⚠️  Failed to remove submodule ${existingModule}:`,
            error instanceof Error ? error.message : String(error)
          )
        }
      }
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
            } catch (e) {
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
