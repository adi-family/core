#!/usr/bin/env bun
/**
 * Update all existing worker repositories with fixed CI configuration files
 * This script force-uploads the latest CI files to all worker repositories
 */

import { sql } from '../packages/db/client'
import { CIRepositoryManager } from '../packages/worker/ci-repository-manager'
import { createLogger } from '../packages/utils/logger'

const logger = createLogger({ namespace: 'update-worker-ci' })

interface WorkerRepository {
  id: string
  project_id: string
  current_version: string
  source_gitlab: any
}

async function updateWorkerRepositories() {
  logger.info('🔄 Starting worker repository CI files update...')

  // Fetch all worker repositories
  const repositories = await sql<WorkerRepository[]>`
    SELECT id, project_id, current_version, source_gitlab
    FROM worker_repositories
    ORDER BY created_at DESC
  `

  if (repositories.length === 0) {
    logger.info('ℹ️  No worker repositories found')
    return
  }

  logger.info(`📦 Found ${repositories.length} worker repository(ies)`)

  const manager = new CIRepositoryManager()
  let successCount = 0
  let errorCount = 0

  for (const repo of repositories) {
    logger.info(`\n📤 Updating repository ${repo.id} (project: ${repo.project_id})`)

    try {
      const source = repo.source_gitlab as any

      if (!source || source.type !== 'gitlab') {
        logger.warn(`⚠️  Skipping repository ${repo.id}: Invalid or missing source`)
        errorCount++
        continue
      }

      if (!repo.current_version) {
        logger.warn(`⚠️  Skipping repository ${repo.id}: No current version`)
        errorCount++
        continue
      }

      logger.info(`   Version: ${repo.current_version}`)
      logger.info(`   Project: ${source.project_path}`)
      logger.info(`   Host: ${source.host}`)

      // Force upload CI files
      const uploadedFiles = await manager.uploadCIFiles({
        source: source,
        version: repo.current_version,
        force: true, // Force upload even if files exist
      })

      logger.info(`   ✅ Successfully uploaded ${uploadedFiles} file(s)`)
      successCount++
    } catch (error) {
      logger.error(`   ❌ Failed to update repository ${repo.id}:`, error)
      errorCount++
    }
  }

  logger.info(`\n✅ Update complete: ${successCount} successful, ${errorCount} failed`)

  // Close database connection
  await sql.end()
}

// Run the update
updateWorkerRepositories().catch((error) => {
  logger.error('❌ Fatal error:', error)
  process.exit(1)
})
