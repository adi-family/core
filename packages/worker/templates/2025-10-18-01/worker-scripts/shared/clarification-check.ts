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

export async function runClarificationCheck(_results: AgentResults): Promise<ClarificationCheckResult> {
  // TODO: Implement
  return { needsClarification: false }
}
