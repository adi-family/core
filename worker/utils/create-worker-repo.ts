#!/usr/bin/env bun

import { sql } from '@db/client.ts'
import * as projectQueries from '../../db/projects'
import * as workerRepoQueries from '../../db/worker-repositories'
import { CIRepositoryManager } from '../ci-repository-manager'
import { printHeader, printError, printSuccess, printSection, printSummary, printNumberedItem, printListItem } from '@utils/print.ts'
import { createLogger } from '@utils/logger.ts'

const logger = createLogger({ namespace: 'create-worker-repo' })

async function main() {
  printHeader('🚀 Worker Repository Creator')

  // Validate environment
  const required = ['DATABASE_URL', 'GITLAB_HOST', 'GITLAB_TOKEN', 'ENCRYPTION_KEY', 'GITLAB_USER']
  const missing = required.filter((key) => !process.env[key])

  if (missing.length > 0) {
    printError(`Missing required environment variables: ${missing.join(', ')}`)
    process.exit(1)
  }

  // Get project ID from command line
  const projectId = process.argv[2]

  if (!projectId) {
    printError('Usage: bun run worker/utils/create-worker-repo.ts <project-id>')
    printSection('Available projects:')
    const projects = await projectQueries.findAllProjects(sql)
    for (const project of projects) {
      printListItem(`- ${project.id}: ${project.name}`)
    }
    process.exit(1)
  }

  try {
    // Fetch project
    logger.info(`\n📋 Fetching project ${projectId}...`)
    const projectResult = await projectQueries.findProjectById(sql, projectId)

    if (!projectResult.ok) {
      printError(`Project not found: ${projectId}`)
      process.exit(1)
    }

    const project = projectResult.data
    printSuccess(`Project: ${project.name}`)

    // Check if worker repository already exists
    const existingRepo = await workerRepoQueries.findWorkerRepositoryByProjectId(sql, projectId)

    if (existingRepo.ok) {
      logger.warn('\n⚠️  Worker repository already exists for this project!')
      logger.info(`   Repository ID: ${existingRepo.data.id}`)
      logger.info(`   Current version: ${existingRepo.data.current_version}`)

      const source = existingRepo.data.source_gitlab as {
        type: string
        project_path?: string
        host?: string
      }

      if (source.project_path) {
        logger.info(`   GitLab project: ${source.host}/${source.project_path}`)
      }

      logger.info('\nTo update the worker repository, use the update script instead.')
      process.exit(0)
    }

    // Create worker repository
    logger.info('\n🔧 Creating GitLab worker repository...')
    const manager = new CIRepositoryManager()

    const source = await manager.createWorkerRepository({
      projectName: project.name,
      sourceType: 'gitlab',
      host: process.env.GITLAB_HOST!,
      accessToken: process.env.GITLAB_TOKEN!,
      user: process.env.GITLAB_USER!,
      customPath: `adi-worker-${project.name.toLowerCase()}`,
    })

    printSuccess(`GitLab repository created: ${source.project_path}`)

    // Upload CI files
    printSection('📤 Uploading CI files...')
    const version = '2025-10-18-01'

    await manager.uploadCIFiles({
      source,
      version,
    })

    printSuccess(`CI files uploaded (version: ${version})`)

    // Save to database
    printSection('💾 Saving to database...')
    const workerRepo = await workerRepoQueries.createWorkerRepository(sql, {
      project_id: projectId,
      source_gitlab: source as unknown,
      current_version: version,
    })

    printSuccess(`Worker repository saved (ID: ${workerRepo.id})`)

    // Display summary
    printHeader('✅ Worker repository created successfully!')
    printSection('📝 Summary:')
    printSummary({
      'Project': `${project.name} (${project.id})`,
      'Worker Repository ID': workerRepo.id,
      'GitLab Project': `${source.host}/${source.project_path}`,
      'CI Version': version,
    })

    printSection('📋 Next steps:')
    printNumberedItem(1, 'Configure GitLab CI/CD variables in the worker repository:')
    printListItem(`${source.host}/${source.project_path}/-/settings/ci_cd`)
    printListItem('Required variables:')
    printListItem('- API_BASE_URL: Your backend API URL', 5)
    printListItem('- API_TOKEN: Your API token (same as in .env)', 5)
    printListItem('- ANTHROPIC_API_KEY: Your Anthropic API key', 5)
    printNumberedItem(2, 'Enable pipeline execution mode:')
    printListItem('export USE_PIPELINE_EXECUTION=true')
    printNumberedItem(3, 'Restart the worker to start using pipelines')

  } catch (error) {
    printError(error instanceof Error ? error.message : String(error))
    if (error instanceof Error && error.stack) {
      printSection('Stack trace:')
      logger.error(error.stack)
    }
    process.exit(1)
  } finally {
    await sql.end()
  }
}

main()
