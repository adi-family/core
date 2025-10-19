#!/usr/bin/env bun
/**
 * Utility script to update a worker repository to a new version
 *
 * Usage:
 *   bun run worker/utils/update-worker-repo-version.ts <project-id> <new-version>
 *
 * Environment variables required:
 *   - DATABASE_URL
 *   - ENCRYPTION_KEY
 */

import { sql } from '@db/client.ts'
import * as projectQueries from '../../db/projects'
import * as workerRepoQueries from '../../db/worker-repositories'
import { CIRepositoryManager } from '../ci-repository-manager'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'update-worker-repo-version' })

async function main() {
  logger.info('🔄 Worker Repository Version Updater')
  logger.info('━'.repeat(50))

  // Validate environment
  const required = ['DATABASE_URL', 'ENCRYPTION_KEY']
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    logger.error(`❌ Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  // Get arguments
  const projectId = process.argv[2]
  const newVersion = process.argv[3]

  if (!projectId || !newVersion) {
    logger.error('❌ Usage: bun run worker/utils/update-worker-repo-version.ts <project-id> <new-version>')
    logger.info('\nExample:')
    logger.info('  bun run worker/utils/update-worker-repo-version.ts abc123 2025-10-18-02')
    process.exit(1)
  }

  try {
    // Fetch project
    logger.info(`\n📋 Fetching project ${projectId}...`)
    const projectResult = await projectQueries.findProjectById(sql, projectId)

    if (!projectResult.ok) {
      logger.error(`❌ Project not found: ${projectId}`)
      process.exit(1)
    }

    const project = projectResult.data
    logger.info(`✓ Project: ${project.name}`)

    // Fetch worker repository
    logger.info('\n📦 Fetching worker repository...')
    const workerRepoResult = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, projectId)

    if (!workerRepoResult.ok) {
      logger.error(`❌ Worker repository not found for project: ${projectId}`)
      logger.info('\nCreate one first using:')
      logger.info(`  bun run worker/utils/create-worker-repo.ts ${projectId}`)
      process.exit(1)
    }

    const workerRepo = workerRepoResult.data
    logger.info(`✓ Worker repository found (ID: ${workerRepo.id})`)
    logger.info(`  Current version: ${workerRepo.current_version}`)

    const source = workerRepo.source_gitlab as {
      type: string
      project_path?: string
      host?: string
      access_token_encrypted?: string
    }

    logger.info(`  GitLab project: ${source.host}/${source.project_path}`)

    // Update to new version
    logger.info(`\n📤 Uploading CI files for version ${newVersion}...`)
    const manager = new CIRepositoryManager()

    await manager.updateVersion(source as never, newVersion)

    // Update database
    logger.info('\n💾 Updating database...')
    const updateResult = await workerRepoQueries.updateWorkerRepository(sql, workerRepo.id, {
      current_version: newVersion,
    })

    if (!updateResult.ok) {
      throw new Error('Failed to update worker repository in database')
    }

    logger.info(`✓ Database updated`)

    // Display summary
    logger.info('\n━'.repeat(50))
    logger.info('✅ Worker repository updated successfully!')
    logger.info('\n📝 Summary:')
    logger.info(`   Project: ${project.name} (${project.id})`)
    logger.info(`   Worker Repository ID: ${workerRepo.id}`)
    logger.info(`   Previous version: ${workerRepo.current_version}`)
    logger.info(`   New version: ${newVersion}`)
    logger.info(`   GitLab project: ${source.host}/${source.project_path}`)

  } catch (error) {
    logger.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      logger.error('\nStack trace:')
      logger.error(error.stack)
    }
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
