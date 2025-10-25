/**
 * Update CI configuration for a SPECIFIC project's worker repository
 * Use this for testing changes on one project before rolling out to all
 *
 * Usage:
 *   bun run update-worker-repo-by-project.ts "Project Name"
 *   bun run update-worker-repo-by-project.ts "Nosh 2"
 */

import postgres from 'postgres'
import { readFile } from 'fs/promises'
import { join } from 'path'
import { GitLabApiClient } from './packages/shared/gitlab-api-client'
import { decrypt } from './packages/shared/crypto-utils'

async function main() {
  const projectName = process.argv[2]

  if (!projectName) {
    console.error('❌ Usage: bun run update-worker-repo-by-project.ts "Project Name"')
    process.exit(1)
  }

  console.log(`🎯 Updating worker repository for project: "${projectName}"`)

  const sql = postgres(process.env.DATABASE_URL!)

  try {
    // Find worker repository for this project
    const repos = await sql`
      SELECT
        wr.id,
        wr.source_gitlab,
        wr.current_version,
        p.name as project_name
      FROM worker_repositories wr
      JOIN projects p ON p.id = wr.project_id
      WHERE p.name ILIKE ${`%${projectName}%`}
    `

    if (repos.length === 0) {
      console.error(`❌ No worker repository found for project matching: "${projectName}"`)
      console.log('\n💡 Available projects:')
      const allProjects = await sql`
        SELECT p.name
        FROM projects p
        JOIN worker_repositories wr ON wr.project_id = p.id
        ORDER BY p.name
      `
      allProjects.forEach(p => console.log(`   - ${p.name}`))
      process.exit(1)
    }

    if (repos.length > 1) {
      console.log(`⚠️  Found ${repos.length} matching projects:`)
      repos.forEach((r, i) => console.log(`   ${i + 1}. ${r.project_name}`))
      console.log('\n💡 Please be more specific with the project name')
      process.exit(1)
    }

    const repo = repos[0] as any
    console.log(`✓ Found: ${repo.project_name}`)
    console.log(`  GitLab: ${repo.source_gitlab.project_path}`)
    console.log(`  Version: ${repo.current_version}\n`)

    // Decrypt access token
    const accessToken = decrypt(repo.source_gitlab.access_token_encrypted)

    // Create GitLab client
    const client = new GitLabApiClient(repo.source_gitlab.host, accessToken)

    // Read template files
    console.log('📥 Reading template files...')
    const templateDir = 'packages/worker/templates/2025-10-18-01'

    const files = [
      { remote: '.gitlab-ci.yml', local: '.gitlab-ci.yml' },
      { remote: '2025-10-18-01/.gitlab-ci-evaluation.yml', local: '.gitlab-ci-evaluation.yml' },
      { remote: '2025-10-18-01/worker-scripts/evaluation-pipeline.ts', local: 'worker-scripts/evaluation-pipeline.ts' },
      { remote: '2025-10-18-01/worker-scripts/upload-evaluation-results.ts', local: 'worker-scripts/upload-evaluation-results.ts' },
      { remote: '2025-10-18-01/worker-scripts/shared/api-client.ts', local: 'worker-scripts/shared/api-client.ts' },
      { remote: '2025-10-18-01/README.md', local: 'README.md' },
    ]

    for (const file of files) {
      const content = await readFile(join(templateDir, file.local), 'utf-8')
      await client.uploadFile(
        repo.source_gitlab.project_id,
        file.remote,
        content,
        `🔧 Update ${file.remote}`,
        'main'
      )
      console.log(`   ✓ Updated: ${file.remote}`)
    }

    console.log(`\n✅ Successfully updated worker repository for: ${repo.project_name}`)

  } finally {
    await sql.end()
  }
}

main().catch(console.error)
