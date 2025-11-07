#!/usr/bin/env bun
/**
 * Bundles worker pipeline scripts for GitLab CI deployment
 * Eliminates duplication by bundling from packages/shared
 */

import { $ } from 'bun'
import { mkdir, rm } from 'fs/promises'
import { join } from 'path'
import { existsSync } from 'fs'
import { watch } from 'fs'

const VERSION = '2025-10-18-01'
const SCRIPTS_DIR = `packages/worker/templates/${VERSION}/worker-scripts`
const BUNDLES_DIR = `packages/worker/templates/${VERSION}/bundles`

const PIPELINES = [
  'evaluation-pipeline',
  'claude-pipeline',
  'gemini-pipeline',
  'codex-pipeline',
  'upload-evaluation-results',
  'upload-results',
  'push-to-file-spaces',
  'sync-workspaces',
]

async function buildBundles() {
  const startTime = Date.now()

  // Create bundles directory
  await mkdir(BUNDLES_DIR, { recursive: true })

  console.log('📦 Building worker pipeline bundles...\n')

  let totalSize = 0
  let successCount = 0

  for (const pipeline of PIPELINES) {
    const input = join(SCRIPTS_DIR, `${pipeline}.ts`)
    const output = join(BUNDLES_DIR, `${pipeline}.js`)

    // Check if input file exists
    if (!existsSync(input)) {
      console.log(`  ⏭️  Skipping ${pipeline} (not found)`)
      continue
    }

    console.log(`  Bundling ${pipeline}...`)

    try {
      const result = await $`bun build ${input} --outfile=${output} --target=bun --format=esm`.quiet()

      if (result.exitCode === 0) {
        const size = Bun.file(output).size
        totalSize += size
        successCount++
        console.log(`    ✅ ${(size / 1024).toFixed(1)} KB`)
      } else {
        console.error(`    ❌ Failed to bundle ${pipeline}`)
        console.error(result.stderr.toString())
      }
    } catch (error) {
      console.error(`    ❌ Error bundling ${pipeline}:`, error)
    }
  }

  const duration = Date.now() - startTime

  console.log(`\n✅ Built ${successCount}/${PIPELINES.length} bundles in ${duration}ms`)
  console.log(`📁 Total size: ${(totalSize / 1024).toFixed(1)} KB`)
  console.log(`📂 Output: ${BUNDLES_DIR}/\n`)

  // Always return true - missing pipelines are optional
  return true
}

async function watchMode() {
  console.log('👀 Watch mode enabled\n')
  console.log('Watching:')
  console.log(`  - ${SCRIPTS_DIR}`)
  console.log('  - packages/shared/')
  console.log('\nPress Ctrl+C to stop\n')

  // Initial build
  await buildBundles()

  let rebuildTimeout: Timer | null = null

  const triggerRebuild = (path: string) => {
    if (rebuildTimeout) clearTimeout(rebuildTimeout)

    rebuildTimeout = setTimeout(async () => {
      console.log(`\n🔄 Change detected: ${path}`)
      await buildBundles()
    }, 100)
  }

  // Watch worker scripts
  if (existsSync(SCRIPTS_DIR)) {
    watch(SCRIPTS_DIR, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith('.ts')) {
        triggerRebuild(join(SCRIPTS_DIR, filename))
      }
    })
  }

  // Watch shared packages
  const sharedDir = 'packages/shared'
  if (existsSync(sharedDir)) {
    watch(sharedDir, { recursive: true }, (event, filename) => {
      if (filename && filename.endsWith('.ts')) {
        triggerRebuild(join(sharedDir, filename))
      }
    })
  }

  // Keep process alive
  await new Promise(() => {})
}

async function cleanBundles() {
  console.log('🧹 Cleaning bundles directory...')
  if (existsSync(BUNDLES_DIR)) {
    await rm(BUNDLES_DIR, { recursive: true, force: true })
    console.log('✅ Bundles cleaned')
  } else {
    console.log('ℹ️  Nothing to clean')
  }
}

// CLI
const args = process.argv.slice(2)
const command = args[0]

switch (command) {
  case 'watch':
    await watchMode()
    break
  case 'clean':
    await cleanBundles()
    break
  default: {
    const success = await buildBundles()
    process.exit(success ? 0 : 1)
  }
}
