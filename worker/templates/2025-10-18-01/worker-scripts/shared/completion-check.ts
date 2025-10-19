/**
 * Completion check utility
 * Verifies if a task has been completed successfully
 */

export interface CompletionCheckResult {
  isComplete: boolean
  reason?: string
  confidence?: number
}

export interface AgentResults {
  exitCode: number
  output?: string
  changes?: unknown
  errors?: string[]
}

/**
 * Run completion check on agent results
 * Determines if the task was completed successfully
 */
export async function runCompletionCheck(
  results: AgentResults
): Promise<CompletionCheckResult> {
  // Check exit code
  if (results.exitCode !== 0) {
    return {
      isComplete: false,
      reason: 'Agent exited with non-zero code',
      confidence: 1.0,
    }
  }

  // Check for errors
  if (results.errors && results.errors.length > 0) {
    return {
      isComplete: false,
      reason: `Agent reported ${results.errors.length} error(s)`,
      confidence: 0.9,
    }
  }

  // Add more sophisticated completion checks here
  // For example:
  // - Check if code compiles
  // - Check if tests pass
  // - Check if changes were made
  // - Analyze agent output for completion signals
  // - Check for merge conflicts
  // etc.

  return {
    isComplete: true,
    confidence: 0.8,
  }
}
