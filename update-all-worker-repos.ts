/**
 * Update CI configuration for ALL worker repositories
 * Use this when you need to push CI changes to all projects
 */

import postgres from 'postgres'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { decrypt } from './packages/shared/crypto-utils'

interface WorkerRepo {
  id: string
  project_id: string
  project_name: string
  source_gitlab: {
    host: string
    project_id: string
    project_path: string
    access_token_encrypted: string
  }
  current_version: string
}

async function updateWorkerRepo(repo: WorkerRepo, files: Map<string, string>) {
  console.log(`\n📦 Updating worker repository: ${repo.project_name}`)
  console.log(`   GitLab: ${repo.source_gitlab.project_path}`)

  try {
    // Decrypt access token
    const accessToken = decrypt(repo.source_gitlab.access_token_encrypted)

    // Create GitLab client
    const client = new GitLabApiClient(repo.source_gitlab.host, accessToken)

    // Upload each file
    for (const [filePath, content] of files) {
      const commitMessage = `🔧 Update CI configuration: ${filePath}`

      await client.uploadFile(
        repo.source_gitlab.project_id,
        filePath,
        content,
        commitMessage,
        'main'
      )

      console.log(`   ✓ Updated: ${filePath}`)
    }

    console.log(`   ✅ Successfully updated ${repo.project_name}`)
  } catch (error) {
    console.error(`   ❌ Failed to update ${repo.project_name}:`, error instanceof Error ? error.message : String(error))
  }
}

async function main() {
  console.log('🚀 Updating CI configuration for ALL worker repositories...\n')

  // Connect to database
  const sql = postgres(process.env.DATABASE_URL!)

  try {
    // Get ALL worker repositories with their project names
    const repos = await sql<WorkerRepo[]>`
      SELECT
        wr.id,
        wr.project_id,
        wr.source_gitlab,
        wr.current_version,
        p.name as project_name
      FROM worker_repositories wr
      JOIN projects p ON p.id = wr.project_id
      ORDER BY p.name
    `

    if (repos.length === 0) {
      console.log('⚠️  No worker repositories found')
      return
    }

    console.log(`Found ${repos.length} worker repositories:\n`)
    repos.forEach((repo, i) => {
      console.log(`  ${i + 1}. ${repo.project_name} (${repo.source_gitlab.project_path})`)
    })

    // Prepare files to upload
    console.log('\n📥 Reading template files...')
    const templateDir = 'packages/worker/templates/2025-10-18-01'

    const filesToUpdate = new Map<string, string>()

    // Main CI config (root level)
    const mainCiPath = join(templateDir, '.gitlab-ci.yml')
    filesToUpdate.set('.gitlab-ci.yml', await readFile(mainCiPath, 'utf-8'))

    // Evaluation CI config
    const evalCiPath = join(templateDir, '.gitlab-ci-evaluation.yml')
    filesToUpdate.set('2025-10-18-01/.gitlab-ci-evaluation.yml', await readFile(evalCiPath, 'utf-8'))

    // Upload evaluation results script
    const uploadEvalPath = join(templateDir, 'worker-scripts/upload-evaluation-results.ts')
    filesToUpdate.set('2025-10-18-01/worker-scripts/upload-evaluation-results.ts', await readFile(uploadEvalPath, 'utf-8'))

    // API client
    const apiClientPath = join(templateDir, 'worker-scripts/shared/api-client.ts')
    filesToUpdate.set('2025-10-18-01/worker-scripts/shared/api-client.ts', await readFile(apiClientPath, 'utf-8'))

    // README
    const readmePath = join(templateDir, 'README.md')
    filesToUpdate.set('2025-10-18-01/README.md', await readFile(readmePath, 'utf-8'))

    console.log(`✓ Loaded ${filesToUpdate.size} files to update\n`)

    // Update each worker repository
    for (const repo of repos) {
      await updateWorkerRepo(repo, filesToUpdate)
    }

    console.log('\n✅ All worker repositories updated successfully!')
    console.log(`\n📊 Summary: Updated ${repos.length} worker repositories`)

  } finally {
    await sql.end()
  }
}

main().catch(console.error)
