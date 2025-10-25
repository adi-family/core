/**
 * Migrate ALL worker repositories to a new version
 * This uploads new version files and updates the database
 *
 * Usage:
 *   bun run migrate-worker-repos-version.ts 2025-10-25-01
 */

import postgres from 'postgres'
import { CIRepositoryManager } from './packages/worker/ci-repository-manager'

async function main() {
  const newVersion = process.argv[2]

  if (!newVersion) {
    console.error('❌ Usage: bun run migrate-worker-repos-version.ts <new-version>')
    console.error('   Example: bun run migrate-worker-repos-version.ts 2025-10-25-01')
    process.exit(1)
  }

  console.log(`🚀 Migrating ALL worker repositories to version: ${newVersion}\n`)

  const sql = postgres(process.env.DATABASE_URL!)
  const manager = new CIRepositoryManager()

  try {
    // Get all worker repositories
    const repos = await sql`
      SELECT
        wr.id,
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

    console.log(`Found ${repos.length} worker repositories to migrate:\n`)
    repos.forEach((repo: any, i) => {
      console.log(`  ${i + 1}. ${repo.project_name}`)
      console.log(`     Current: ${repo.current_version} → New: ${newVersion}`)
    })

    console.log('\n⚠️  This will:')
    console.log('   1. Upload new version files to each GitLab repository')
    console.log('   2. Update database current_version field')
    console.log('   3. Keep old version files (for rollback)\n')

    // Confirm before proceeding
    console.log('Press Ctrl+C to cancel, or wait 5 seconds to continue...')
    await new Promise(resolve => setTimeout(resolve, 5000))

    console.log('\n📤 Starting migration...\n')

    let successCount = 0
    let failCount = 0

    for (const repo of repos as any[]) {
      console.log(`📦 Migrating: ${repo.project_name}`)

      try {
        // Upload CI files for new version
        await manager.uploadCIFiles({
          source: repo.source_gitlab,
          version: newVersion
        })

        // Update database
        await sql`
          UPDATE worker_repositories
          SET current_version = ${newVersion},
              updated_at = NOW()
          WHERE id = ${repo.id}
        `

        console.log(`   ✅ Migrated to ${newVersion}\n`)
        successCount++
      } catch (error) {
        console.error(`   ❌ Failed:`, error instanceof Error ? error.message : String(error))
        console.log()
        failCount++
      }
    }

    console.log('✅ Migration complete!')
    console.log(`\n📊 Summary:`)
    console.log(`   ✓ Success: ${successCount}`)
    if (failCount > 0) {
      console.log(`   ✗ Failed:  ${failCount}`)
    }

    if (failCount === 0) {
      console.log('\n💡 All worker repositories are now using version:', newVersion)
      console.log('   Old version files remain in GitLab for rollback if needed')
    }

  } finally {
    await sql.end()
  }
}

main().catch(console.error)
