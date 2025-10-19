#!/usr/bin/env bun

import { sql } from '@db/client.ts'
import * as workerRepoQueries from '../../db/worker-repositories'
import * as projectQueries from '../../db/projects'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'list-worker-repos' })

async function main() {
  logger.info('📦 Worker Repositories')
  logger.info('━'.repeat(80))

  try {
    // Fetch all worker repositories
    const repos = await workerRepoQueries.findAllWorkerRepositories(sql)

    if (repos.length === 0) {
      logger.info('\nNo worker repositories found.')
      logger.info('\nCreate one using:')
      logger.info('  bun run worker/utils/create-worker-repo.ts <project-id>')
      return
    }

    logger.info(`\nFound ${repos.length} worker ${repos.length === 1 ? 'repository' : 'repositories'}:\n`)

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

      logger.info(`┌─ Repository ID: ${repo.id}`)
      logger.info(`├─ Project: ${projectName} (${repo.project_id})`)
      logger.info(`├─ Version: ${repo.current_version}`)
      logger.info(`├─ Source Type: ${source.type}`)
      if (source.project_path) {
        logger.info(`├─ GitLab Project: ${source.host}/${source.project_path}`)
        logger.info(`├─ GitLab Project ID: ${source.project_id}`)
      }
      logger.info(`├─ Created: ${new Date(repo.created_at).toLocaleString()}`)
      logger.info(`└─ Updated: ${new Date(repo.updated_at).toLocaleString()}`)
      logger.info('')
    }

    logger.info('━'.repeat(80))
    logger.info('\n📋 Commands:')
    logger.info('  Create new:  bun run worker/utils/create-worker-repo.ts <project-id>')
    logger.info('  Update:      bun run worker/utils/update-worker-repo-version.ts <project-id> <version>')

  } catch (error) {
    logger.error('\n❌ Error:', error instanceof Error ? error.message : String(error))
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
