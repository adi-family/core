#!/usr/bin/env bun
/**
 * Utility script to list all worker repositories
 *
 * Usage:
 *   bun run worker/utils/list-worker-repos.ts
 *
 * Environment variables required:
 *   - DATABASE_URL
 */

import { sql } from '../../db/client'
import * as workerRepoQueries from '../../db/worker-repositories'
import * as projectQueries from '../../db/projects'

async function main() {
  console.log('📦 Worker Repositories')
  console.log('━'.repeat(80))

  try {
    // Fetch all worker repositories
    const repos = await workerRepoQueries.findAllWorkerRepositories(sql)

    if (repos.length === 0) {
      console.log('\nNo worker repositories found.')
      console.log('\nCreate one using:')
      console.log('  bun run worker/utils/create-worker-repo.ts <project-id>')
      return
    }

    console.log(`\nFound ${repos.length} worker ${repos.length === 1 ? 'repository' : 'repositories'}:\n`)

    for (const repo of repos) {
      // Fetch project
      const projectResult = await projectQueries.findProjectById(sql, repo.project_id)
      const projectName = projectResult.ok ? projectResult.data.name : 'Unknown'

      const source = repo.source_gitlab as {
        type: string
        project_path?: string
        host?: string
        project_id?: string
      }

      console.log(`┌─ Repository ID: ${repo.id}`)
      console.log(`├─ Project: ${projectName} (${repo.project_id})`)
      console.log(`├─ Version: ${repo.current_version}`)
      console.log(`├─ Source Type: ${source.type}`)
      if (source.project_path) {
        console.log(`├─ GitLab Project: ${source.host}/${source.project_path}`)
        console.log(`├─ GitLab Project ID: ${source.project_id}`)
      }
      console.log(`├─ Created: ${new Date(repo.created_at).toLocaleString()}`)
      console.log(`└─ Updated: ${new Date(repo.updated_at).toLocaleString()}`)
      console.log('')
    }

    console.log('━'.repeat(80))
    console.log('\n📋 Commands:')
    console.log('  Create new:  bun run worker/utils/create-worker-repo.ts <project-id>')
    console.log('  Update:      bun run worker/utils/update-worker-repo-version.ts <project-id> <version>')

  } catch (error) {
    console.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
