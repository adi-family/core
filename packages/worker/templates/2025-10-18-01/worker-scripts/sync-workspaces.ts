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

      const repoUrl = (fileSpace.config as { repo: string }).repo
      const workspaceName = fileSpace.name
        .replace(/[^a-zA-Z0-9-]/g, '-')
        .toLowerCase()
      const workspacePath = `workspaces/${workspaceName}`

      desiredSubmodules.add(workspacePath)

      logger.info(`\n📦 Syncing workspace: ${fileSpace.name}`)
      logger.info(`   Repository: ${repoUrl}`)

      try {
        // Validate repo URL format
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

    // Commit changes to .gitmodules if any
    try {
      const { stdout: statusOutput } = await exec('cd .. && git status --porcelain .gitmodules')
      if (statusOutput.trim()) {
        logger.info('\n💾 Committing .gitmodules changes...')
        await exec('cd .. && git add .gitmodules')
        await exec('cd .. && git commit -m "🔧 Update workspace submodules"')
        logger.info('✓ Changes committed')
      }
    } catch (error) {
      logger.warn(`⚠️  Could not commit .gitmodules: ${error instanceof Error ? error.message : String(error)}`)
    }

    logger.info('\n✅ Workspace sync completed successfully')
    process.exit(0)
  } catch (error) {
    logger.error('❌ Workspace sync failed:', error)
    process.exit(1)
  }
}

main()
