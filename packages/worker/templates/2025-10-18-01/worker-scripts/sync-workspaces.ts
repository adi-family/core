#!/usr/bin/env bun
/**
 * Sync Workspaces - Clone file spaces for worker pipelines
 * This is now just a thin wrapper around the workspace-cloner utility
 */

import { cloneWorkspaces } from './shared/workspace-cloner'
import { createLogger } from './shared/logger'

const logger = createLogger({ namespace: 'sync-workspaces' })

async function main() {
  logger.info('🔄 Workspace Sync Started')

  try {
    const result = await cloneWorkspaces()
    logger.info(`✅ Successfully cloned ${result.successCount}/${result.totalCount} workspace(s)`)
    process.exit(0)
  } catch (error) {
    logger.error('❌ Workspace sync failed:', error)
    process.exit(1)
  }
}

// Export for use in worker binary
export { main as syncWorkspaces }

// Run if called directly (not from worker binary)
if (!process.env.__WORKER_BINARY__ && import.meta.main) {
  main()
}
