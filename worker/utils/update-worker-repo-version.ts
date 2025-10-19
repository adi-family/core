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

import { sql } from '../../db/client'
import * as projectQueries from '../../db/projects'
import * as workerRepoQueries from '../../db/worker-repositories'
import { CIRepositoryManager } from '../ci-repository-manager'

async function main() {
  console.log('🔄 Worker Repository Version Updater')
  console.log('━'.repeat(50))

  // Validate environment
  const required = ['DATABASE_URL', 'ENCRYPTION_KEY']
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    console.error(`❌ Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  // Get arguments
  const projectId = process.argv[2]
  const newVersion = process.argv[3]

  if (!projectId || !newVersion) {
    console.error('❌ Usage: bun run worker/utils/update-worker-repo-version.ts <project-id> <new-version>')
    console.log('\nExample:')
    console.log('  bun run worker/utils/update-worker-repo-version.ts abc123 2025-10-18-02')
    process.exit(1)
  }

  try {
    // Fetch project
    console.log(`\n📋 Fetching project ${projectId}...`)
    const projectResult = await projectQueries.findProjectById(sql, projectId)

    if (!projectResult.ok) {
      console.error(`❌ Project not found: ${projectId}`)
      process.exit(1)
    }

    const project = projectResult.data
    console.log(`✓ Project: ${project.name}`)

    // Fetch worker repository
    console.log('\n📦 Fetching worker repository...')
    const workerRepoResult = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, projectId)

    if (!workerRepoResult.ok) {
      console.error(`❌ Worker repository not found for project: ${projectId}`)
      console.log('\nCreate one first using:')
      console.log(`  bun run worker/utils/create-worker-repo.ts ${projectId}`)
      process.exit(1)
    }

    const workerRepo = workerRepoResult.data
    console.log(`✓ Worker repository found (ID: ${workerRepo.id})`)
    console.log(`  Current version: ${workerRepo.current_version}`)

    const source = workerRepo.source_gitlab as {
      type: string
      project_path?: string
      host?: string
      access_token_encrypted?: string
    }

    console.log(`  GitLab project: ${source.host}/${source.project_path}`)

    // Update to new version
    console.log(`\n📤 Uploading CI files for version ${newVersion}...`)
    const manager = new CIRepositoryManager()

    await manager.updateVersion(source as never, newVersion)

    // Update database
    console.log('\n💾 Updating database...')
    const updateResult = await workerRepoQueries.updateWorkerRepository(sql, workerRepo.id, {
      current_version: newVersion,
    })

    if (!updateResult.ok) {
      throw new Error('Failed to update worker repository in database')
    }

    console.log(`✓ Database updated`)

    // Display summary
    console.log('\n━'.repeat(50))
    console.log('✅ Worker repository updated successfully!')
    console.log('\n📝 Summary:')
    console.log(`   Project: ${project.name} (${project.id})`)
    console.log(`   Worker Repository ID: ${workerRepo.id}`)
    console.log(`   Previous version: ${workerRepo.current_version}`)
    console.log(`   New version: ${newVersion}`)
    console.log(`   GitLab project: ${source.host}/${source.project_path}`)

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      console.error('\nStack trace:')
      console.error(error.stack)
    }
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
