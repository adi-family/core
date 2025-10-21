/**
 * Clarification check utility
 * Detects if a task needs clarification or additional information
 */

export interface ClarificationCheckResult {
  needsClarification: boolean
  questions?: string[]
  reason?: string
}

export interface AgentResults {
  exitCode: number
  output?: string
  changes?: unknown
  errors?: string[]
}

/**
 * Run clarification check on agent results
 * Determines if the task needs additional information
 */
export async function runClarificationCheck(
  results: AgentResults
): Promise<ClarificationCheckResult> {
  const questions: string[] = []

  // Check agent output for clarification signals
  if (results.output) {
    const output = results.output.toLowerCase()

    // Common clarification indicators
    const clarificationKeywords = [
      'unclear',
      'ambiguous',
      'need more information',
      'please clarify',
      'what do you mean',
      'can you provide',
      'not sure',
      'uncertain',
    ]

    for (const keyword of clarificationKeywords) {
      if (output.includes(keyword)) {
        questions.push(`Agent indicated: ${keyword}`)
      }
    }
  }

  // Check for specific error patterns that indicate missing information
  if (results.errors) {
    for (const error of results.errors) {
      if (
        error.includes('missing') ||
        error.includes('not found') ||
        error.includes('undefined')
      ) {
        questions.push(`Missing information: ${error}`)
      }
    }
  }

  // Add more sophisticated clarification detection here
  // For example:
  // - Analyze task description for incomplete requirements
  // - Check for missing dependencies
  // - Detect incomplete specifications
  // - Identify edge cases that need handling
  // etc.

  if (questions.length > 0) {
    return {
      needsClarification: true,
      questions,
      reason: `Found ${questions.length} clarification point(s)`,
    }
  }

  return {
    needsClarification: false,
  }
}
