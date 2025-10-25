/**
 * Upload main .gitlab-ci.yml to worker repository
 * This script uploads the new main CI config that dynamically includes runner-specific configs
 */

import postgres from 'postgres'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { decrypt } from './packages/shared/crypto-utils'

async function main() {
  console.log('Uploading main CI config to worker repository...')

  // Connect to database
  const sql = postgres(process.env.DATABASE_URL!)

  try {
    // Get worker repository
    const repos = await sql`
      SELECT id, source_gitlab
      FROM worker_repositories
      ORDER BY created_at DESC
      LIMIT 1
    `

    if (repos.length === 0) {
      throw new Error('No worker repository found')
    }

    const repo = repos[0]
    const source = repo.source_gitlab as any

    console.log('Worker repository:', source.project_path)

    // Decrypt access token
    const accessToken = decrypt(source.access_token_encrypted)

    // Create GitLab client
    const client = new GitLabApiClient(source.host, accessToken)

    // Read the new main CI config
    const ciConfigPath = join(__dirname, 'packages/worker/templates/2025-10-18-01/.gitlab-ci.yml')
    const content = await readFile(ciConfigPath, 'utf-8')

    // Upload to repository root
    await client.uploadFile(
      source.project_id,
      '.gitlab-ci.yml',
      content,
      '🔧 Add main CI config with dynamic runner selection',
      'main'
    )

    console.log('✅ Main CI config uploaded successfully')

    // Also upload updated README
    const readmePath = join(__dirname, 'packages/worker/templates/2025-10-18-01/README.md')
    const readmeContent = await readFile(readmePath, 'utf-8')

    await client.uploadFile(
      source.project_id,
      '2025-10-18-01/README.md',
      readmeContent,
      '📝 Update README to document CI_RUNNER variable',
      'main'
    )

    console.log('✅ README updated successfully')
  } finally {
    await sql.end()
  }
}

main().catch(console.error)
