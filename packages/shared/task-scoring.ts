/**
 * Task Scoring Utilities (Shared)
 * Computed metrics derived from task evaluation results
 * Can be used by both frontend and backend
 */

import type { AICapabilityCriteria, SimpleEvaluationResult } from '@types'

export interface ImplementationStatus {
  can_implement: boolean
  can_verify: boolean
  confidence: 'high' | 'medium' | 'low'
  status: 'ready' | 'implementable_with_caveats' | 'blocked'
  caveats: string[]
}

export type PriorityQuadrant = 'quick_win' | 'major_project' | 'fill_in' | 'thankless_task'

/**
 * Determine if AI is blocked from implementing the task
 */
export function isAIBlocked(criteria: AICapabilityCriteria): boolean {
  return (
    criteria.cannot_determine_what_to_implement ||
    criteria.has_contradictory_requirements ||
    criteria.requires_undefined_integration ||
    criteria.requires_human_subjective_choice ||
    criteria.requires_missing_information
  )
}

/**
 * Determine if the task requires human oversight after implementation
 */
export function requiresHumanOversight(criteria: AICapabilityCriteria): boolean {
  return (
    criteria.should_verify_visually ||
    criteria.should_verify_ux_flow ||
    criteria.should_verify_performance ||
    criteria.should_verify_security ||
    criteria.should_verify_accessibility ||
    criteria.high_risk_breaking_change ||
    criteria.requires_manual_testing
  )
}

/**
 * Get detailed implementation status with caveats
 */
export function getImplementationStatus(criteria: AICapabilityCriteria): ImplementationStatus {
  // Hard blockers - cannot even write code
  const hardBlockers = [
    criteria.cannot_determine_what_to_implement,
    criteria.has_contradictory_requirements,
    criteria.requires_undefined_integration,
    criteria.requires_human_subjective_choice,
    criteria.requires_missing_information
  ]

  if (hardBlockers.some(b => b)) {
    return {
      can_implement: false,
      can_verify: false,
      confidence: 'low',
      status: 'blocked',
      caveats: []
    }
  }

  // Uncertainty blockers - can try, but high risk of being wrong
  const uncertaintyBlockers = [
    criteria.integration_has_no_documentation,
    criteria.requires_proprietary_knowledge,
    criteria.requires_advanced_domain_expertise
  ]

  const hasUncertainty = uncertaintyBlockers.some(b => b)

  // Verification limitations - can write code, but can't test
  const verificationBlockers = [
    criteria.cannot_test_without_credentials,
    criteria.cannot_test_without_paid_account,
    criteria.cannot_test_without_hardware,
    criteria.requires_production_access_to_test
  ]

  const cannotVerify = verificationBlockers.some(b => b)

  // Post-implementation verification needs
  const needsHumanVerification = [
    criteria.should_verify_visually,
    criteria.should_verify_ux_flow,
    criteria.should_verify_performance,
    criteria.should_verify_security,
    criteria.should_verify_accessibility
  ]

  const needsVerification = needsHumanVerification.some(b => b)

  // Risk flags
  const hasRisks = criteria.high_risk_breaking_change || criteria.requires_manual_testing

  // Determine status
  const caveats: string[] = []

  if (hasUncertainty) {
    caveats.push('Low confidence - missing docs/knowledge')
  }
  if (cannotVerify) {
    caveats.push('Cannot test without external access')
  }
  if (needsVerification) {
    caveats.push('Needs human verification after implementation')
  }
  if (hasRisks) {
    caveats.push('High risk - careful review needed')
  }

  return {
    can_implement: true,
    can_verify: !cannotVerify,
    confidence: hasUncertainty ? 'low' : (hasRisks ? 'medium' : 'high'),
    status: caveats.length > 0 ? 'implementable_with_caveats' : 'ready',
    caveats
  }
}

/**
 * Compute priority quadrant based on impact and effort
 */
export function computePriorityQuadrant(
  impact: 'low' | 'medium' | 'high',
  effort: 'low' | 'medium' | 'high'
): PriorityQuadrant {
  if (impact === 'high' && effort === 'low') {
    return 'quick_win'
  }

  if (impact === 'high' && (effort === 'medium' || effort === 'high')) {
    return 'major_project'
  }

  if (impact === 'low' && effort === 'low') {
    return 'fill_in'
  }

  return 'thankless_task'
}

/**
 * Compute quick win score (0-100)
 * Higher score = better quick win candidate
 */
export function computeQuickWinScore(result: SimpleEvaluationResult): number {
  // Blocked? Score = 0
  if (isAIBlocked(result.ai_capability)) {
    return 0
  }

  let score = 0

  // Base score from clarity and complexity (60 points total)
  score += result.clarity_score * 0.3  // 30 points max
  score += (100 - result.complexity_score) * 0.3  // 30 points max

  // Effort bonus (40 points max)
  const effortBonus: Record<string, number> = {
    xs: 40,
    s: 30,
    m: 20,
    l: 10,
    xl: 0
  }
  score += effortBonus[result.effort_estimate] || 0

  // Penalize if needs human oversight (-20 points)
  if (requiresHumanOversight(result.ai_capability)) {
    score -= 20
  }

  // Risk penalty
  const riskPenalty: Record<string, number> = {
    low: 0,
    medium: 10,
    high: 25
  }
  score -= riskPenalty[result.risk_level] || 0

  // Impact bonus (if high impact, boost score)
  if (result.estimated_impact === 'high') {
    score += 15
  } else if (result.estimated_impact === 'medium') {
    score += 5
  }

  return Math.max(0, Math.min(100, Math.round(score)))
}

/**
 * Get computed metrics for a task evaluation result
 */
export function getComputedMetrics(result: SimpleEvaluationResult) {
  const implementationStatus = getImplementationStatus(result.ai_capability)
  const priorityQuadrant = computePriorityQuadrant(result.estimated_impact, result.estimated_effort)
  const quickWinScore = computeQuickWinScore(result)
  const isBlocked = isAIBlocked(result.ai_capability)
  const needsOversight = requiresHumanOversight(result.ai_capability)

  return {
    implementation_status: implementationStatus,
    priority_quadrant: priorityQuadrant,
    quick_win_score: quickWinScore,
    is_ai_blocked: isBlocked,
    requires_human_oversight: needsOversight
  }
}
