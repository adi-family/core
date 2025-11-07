/**
 * Configuration for micros-task-ops service
 * All task operation intervals and timeouts in one place
 */

import { TASK_OPS_DEFAULTS, PIPELINE_TIMEOUTS } from '@adi-simple/config'

export interface TaskOpsConfig {
  // Task source sync scheduler
  syncIntervalMinutes: number
  syncThresholdMinutes: number
  queuedTimeoutMinutes: number

  // Evaluation scheduler
  evalIntervalMinutes: number

  // Pipeline monitor
  pipelinePollIntervalMs: number
  pipelineTimeoutMinutes: number

  // Evaluation recovery
  stuckEvalCheckIntervalMinutes: number
  stuckEvalTimeoutMinutes: number
}

// ============================================================================
// Database Configuration
// ============================================================================

export const DATABASE_URL = process.env.DATABASE_URL || ''

/**
 * Load configuration from environment variables with defaults
 */
export function loadConfig(): TaskOpsConfig {
  return {
    // Task source sync - every 15 min, sync if >30 min old, re-queue if stuck >2 hours
    syncIntervalMinutes: parseInt(process.env.TASK_SYNC_INTERVAL_MINUTES || String(TASK_OPS_DEFAULTS.syncIntervalMinutes)),
    syncThresholdMinutes: parseInt(process.env.TASK_SYNC_THRESHOLD_MINUTES || String(TASK_OPS_DEFAULTS.syncThresholdMinutes)),
    queuedTimeoutMinutes: parseInt(process.env.TASK_QUEUED_TIMEOUT_MINUTES || String(TASK_OPS_DEFAULTS.queuedTimeoutMinutes)),

    // Evaluation scheduling - check every 1 min for pending evaluations
    evalIntervalMinutes: parseInt(process.env.EVAL_INTERVAL_MINUTES || String(TASK_OPS_DEFAULTS.evalIntervalMinutes)),

    // Pipeline monitor - check every 10 min, timeout after 30 min
    pipelinePollIntervalMs: parseInt(process.env.PIPELINE_POLL_INTERVAL_MS || String(PIPELINE_TIMEOUTS.monitorPollIntervalMs)),
    pipelineTimeoutMinutes: parseInt(process.env.PIPELINE_STATUS_TIMEOUT_MINUTES || String(PIPELINE_TIMEOUTS.monitorTimeoutMinutes)),

    // Stuck evaluation recovery - check every 15 min, recover if stuck >60 min
    stuckEvalCheckIntervalMinutes: parseInt(process.env.STUCK_EVAL_CHECK_INTERVAL_MINUTES || String(TASK_OPS_DEFAULTS.stuckEvalCheckIntervalMinutes)),
    stuckEvalTimeoutMinutes: parseInt(process.env.STUCK_EVALUATION_TIMEOUT_MINUTES || String(TASK_OPS_DEFAULTS.stuckEvalTimeoutMinutes)),
  }
}

/**
 * Log configuration on startup
 */
export function logConfig(config: TaskOpsConfig): void {
  console.log('Task Operations Configuration:')
  console.log('  Task Source Sync:')
  console.log(`    - Check interval: ${config.syncIntervalMinutes} min`)
  console.log(`    - Sync threshold: ${config.syncThresholdMinutes} min`)
  console.log(`    - Stuck timeout: ${config.queuedTimeoutMinutes} min`)
  console.log('  Evaluation Scheduling:')
  console.log(`    - Check interval: ${config.evalIntervalMinutes} min`)
  console.log('  Pipeline Monitor:')
  console.log(`    - Poll interval: ${config.pipelinePollIntervalMs / 1000}s`)
  console.log(`    - Stale timeout: ${config.pipelineTimeoutMinutes} min`)
  console.log('  Evaluation Recovery:')
  console.log(`    - Check interval: ${config.stuckEvalCheckIntervalMinutes} min`)
  console.log(`    - Stuck timeout: ${config.stuckEvalTimeoutMinutes} min`)
}
