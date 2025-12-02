/**
 * Simple Evaluation Module
 * Quick gate check for task feasibility without CI overhead
 * Extracted from evaluation-pipeline.ts to run in microservice
 */

import Anthropic, { type ClientOptions } from '@anthropic-ai/sdk'
import { HttpsProxyAgent } from 'https-proxy-agent'
import { createLogger } from '@utils/logger'
import { AI_MODEL_DEFAULTS } from '@adi-simple/config'

const logger = createLogger({ namespace: 'simple-evaluator' })

export interface AICapabilityCriteria {
  // HARD BLOCKERS - AI literally cannot write the code
  cannot_determine_what_to_implement: boolean  // Too vague: "make it better", "fix the issues"
  has_contradictory_requirements: boolean      // "Make it fast AND add 10 features"
  requires_undefined_integration: boolean      // "Integrate with internal Tool X" (no docs, no access, can't research)
  requires_human_subjective_choice: boolean    // "Choose the best color", "Decide which features"
  requires_missing_information: boolean        // "Use the API key from John's email" (no access to it)

  // IMPLEMENTATION POSSIBLE, BUT HIGH UNCERTAINTY
  integration_has_no_documentation: boolean    // Can try, but likely wrong without docs
  requires_proprietary_knowledge: boolean      // Deep internal business logic only team knows
  requires_advanced_domain_expertise: boolean  // Complex ML, cryptography, financial algorithms

  // VERIFICATION/TESTING LIMITATIONS (can implement, but can't verify)
  cannot_test_without_credentials: boolean     // AWS/Stripe integration - code yes, test no
  cannot_test_without_paid_account: boolean    // Can write Stripe code, but can't test without account
  cannot_test_without_hardware: boolean        // Can write IoT code, but can't test without device
  requires_production_access_to_test: boolean  // Needs prod DB/API to verify

  // POST-IMPLEMENTATION VERIFICATION (can implement AND test, but human should verify)
  should_verify_visually: boolean              // CSS changes - can implement, should check appearance
  should_verify_ux_flow: boolean              // User flows - can implement, needs UX testing
  should_verify_performance: boolean           // Can optimize, needs load testing
  should_verify_security: boolean             // Can implement auth, needs security review
  should_verify_accessibility: boolean         // Can add ARIA, needs a11y testing

  // RISK FLAGS
  high_risk_breaking_change: boolean          // Major refactor, likely breaks things
  requires_manual_testing: boolean            // Automated tests insufficient (e.g., email rendering)
}

export interface SimpleEvaluationResult {
  should_evaluate: boolean
  clarity_score: number
  has_acceptance_criteria: boolean
  auto_reject_reason: string | null

  // AI Capability Analysis
  ai_capability: AICapabilityCriteria
  blockers_summary: string[]  // Human-readable list of blockers
  verification_summary: string[]  // Human-readable list of post-implementation verifications
  risk_summary: string[]  // Human-readable list of risk flags

  // Multi-Dimensional Scoring
  complexity_score: number      // 0-100 (higher = more complex)
  effort_estimate: 'xs' | 's' | 'm' | 'l' | 'xl'
  risk_level: 'low' | 'medium' | 'high'
  task_type: 'bug_fix' | 'feature' | 'refactor' | 'docs' | 'test' | 'config' | 'other'

  // Impact vs Effort
  estimated_impact: 'low' | 'medium' | 'high'
  estimated_effort: 'low' | 'medium' | 'high'
}

export interface SimpleEvaluationUsage {
  provider: string
  model: string
  goal: string
  phase: string
  input_tokens: number
  output_tokens: number
  cache_creation_input_tokens: number
  cache_read_input_tokens: number
  duration_seconds: number
}

/**
 * Create Anthropic client with optional proxy support
 */
function createAnthropicClient(aiConfig?: AIProviderConfig): Anthropic {
  const config: ClientOptions = {
    apiKey: aiConfig?.api_key || process.env.ANTHROPIC_API_KEY!
  }

  // Set custom endpoint if provided
  if (aiConfig?.endpoint_url) {
    config.baseURL = aiConfig.endpoint_url
  }

  // Configure proxy if credentials are provided
  if (process.env.PROXY_HOST && process.env.PROXY_USER && process.env.PROXY_PASS) {
    const proxyUrl = `http://${process.env.PROXY_USER}:${process.env.PROXY_PASS}@${process.env.PROXY_HOST}`
    const agent = new HttpsProxyAgent(proxyUrl)
    config.fetchOptions = { dispatcher: agent as unknown as RequestInit['dispatcher'] }
    logger.info(`✓ Using proxy: ${process.env.PROXY_HOST}`)
  }

  return new Anthropic(config)
}

/**
 * Extract JSON from text that might contain markdown code blocks
 */
function extractJSON(text: string): string {
  // Try to find JSON in markdown code blocks first - use greedy match
  const codeBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*)\n?```/)
  if (codeBlockMatch && codeBlockMatch[1]) {
    return codeBlockMatch[1].trim()
  }

  // Try to find JSON object directly - match the outermost braces
  const firstBrace = text.indexOf('{')
  const lastBrace = text.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    return text.substring(firstBrace, lastBrace + 1).trim()
  }

  // Return original text if no patterns found
  return text.trim()
}

/**
 * AI Provider Config for evaluation
 */
export interface AIProviderConfig {
  api_key: string
  model?: string
  max_tokens?: number
  temperature?: number
  endpoint_url?: string
  additional_headers?: Record<string, string>
}

/**
 * Perform simple evaluation gate check
 * This runs in the microservice, not in CI
 */
export async function evaluateSimple(
  task: {
    title: string
    description: string | null
  },
  aiConfig?: AIProviderConfig
): Promise<{
  result: SimpleEvaluationResult
  usage: SimpleEvaluationUsage
}> {
  logger.info('🔍 Running simple evaluation filter...')
  logger.info(`Task: ${task.title}`)

  const startTime = Date.now()

  // Check for MOCK_MODE environment variable
  if (process.env.MOCK_MODE === 'true') {
    logger.info('🎭 MOCK MODE ENABLED - Returning mock simple evaluation')

    return {
      result: {
        should_evaluate: true,
        clarity_score: 85,
        has_acceptance_criteria: true,
        auto_reject_reason: null,
        ai_capability: {
          cannot_determine_what_to_implement: false,
          has_contradictory_requirements: false,
          requires_undefined_integration: false,
          requires_human_subjective_choice: false,
          requires_missing_information: false,
          integration_has_no_documentation: false,
          requires_proprietary_knowledge: false,
          requires_advanced_domain_expertise: false,
          cannot_test_without_credentials: false,
          cannot_test_without_paid_account: false,
          cannot_test_without_hardware: false,
          requires_production_access_to_test: false,
          should_verify_visually: false,
          should_verify_ux_flow: false,
          should_verify_performance: false,
          should_verify_security: false,
          should_verify_accessibility: false,
          high_risk_breaking_change: false,
          requires_manual_testing: false
        },
        blockers_summary: [],
        verification_summary: [],
        risk_summary: [],
        complexity_score: 30,
        effort_estimate: 's' as const,
        risk_level: 'low' as const,
        task_type: 'feature' as const,
        estimated_impact: 'medium' as const,
        estimated_effort: 'low' as const
      },
      usage: {
        provider: 'anthropic',
        model: 'claude-sonnet-4-5',
        goal: 'evaluation',
        phase: 'simple_eval',
        input_tokens: 500,
        output_tokens: 100,
        cache_creation_input_tokens: 0,
        cache_read_input_tokens: 0,
        duration_seconds: 1
      }
    }
  }

  const anthropic = createAnthropicClient(aiConfig)

  // Use model from config or default
  const model = aiConfig?.model || process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-5-20250929'
  const maxTokens = aiConfig?.max_tokens || AI_MODEL_DEFAULTS.maxTokensForEvaluation

  const prompt = `You are a quick filter for automated task evaluation. Your job is to determine if an AI agent can implement this task.

Task Title: ${task.title}
Task Description: ${task.description || 'No description provided'}

Evaluate the task against these criteria:

HARD BLOCKERS (AI cannot write code):
- cannot_determine_what_to_implement: Task is too vague ("make it better", "fix it" without specifics)
- has_contradictory_requirements: Requirements conflict with each other
- requires_undefined_integration: Must integrate with undocumented/unknown system
- requires_human_subjective_choice: AI must decide aesthetic/business choices ("pick a nice color")
- requires_missing_information: Needs information that's not provided and can't be inferred

DESIGN TOOL BLOCKERS (AI cannot access these tools):
Tasks involving design tools like Figma, Sketch, Adobe XD, Photoshop, etc. are HARD BLOCKERS because:
  1. AI cannot open, view, or edit design files
  2. AI cannot see visual designs or component structures
  3. AI cannot organize/create components within design tools
Examples of BLOCKED tasks:
  - "Organize components in Figma" → requires_undefined_integration=true (AI can't edit Figma)
  - "Create design system in Figma" → requires_undefined_integration=true (AI can't use Figma)
  - "Componentize Figma designs" → requires_undefined_integration=true (AI can't access Figma)
  - "Implement from Figma designs" → requires_missing_information=true (AI can't see Figma file)
  - "Match Figma mockups" → requires_missing_information=true (need exported designs/specs)
  - Keywords: Figma, Sketch, Adobe XD, Photoshop, Illustrator, Zeplin, InVision, design file
ONLY EXCEPTION: If task includes exported designs/specs/screenshots AND asks to implement code from them.

UNCERTAINTY (AI can try, but low confidence):
- integration_has_no_documentation: External API exists but poorly documented
- requires_proprietary_knowledge: Needs deep internal business logic only team knows
- requires_advanced_domain_expertise: Complex algorithms (ML, crypto, finance)

VERIFICATION LIMITATIONS (AI can code, but can't test):
- cannot_test_without_credentials: AWS/GCP/Stripe - can write code but can't test (this is OK!)
- cannot_test_without_paid_account: Needs paid service account to test (this is OK!)
- cannot_test_without_hardware: IoT/mobile device needed (this is OK!)
- requires_production_access_to_test: Must test against production systems (this is OK!)

POST-IMPLEMENTATION VERIFICATION (AI can implement and test, human should verify):
- should_verify_visually: CSS/UI changes - human should check appearance
- should_verify_ux_flow: User experience flows need human testing
- should_verify_performance: Performance optimization needs load testing
- should_verify_security: Security changes need security review
- should_verify_accessibility: Accessibility features need a11y testing

RISK FLAGS:
- high_risk_breaking_change: Major refactor likely to break existing features
- requires_manual_testing: Cannot be fully tested automatically

EXAMPLES:
- "Add AWS S3 upload" → can_implement=true, cannot_test_without_credentials=true (PROCEED!)
- "Add configurable pricing via env" → can_implement=true, no blockers (PROCEED!)
- "Make button rounded" → can_implement=true, should_verify_visually=true (PROCEED!)
- "Make it look nice" → cannot_determine_what_to_implement=true (BLOCKED!)
- "Fix the bug" (no details) → cannot_determine_what_to_implement=true (BLOCKED!)
- "Посадить в Фигме все на компоненты" → requires_undefined_integration=true (BLOCKED! AI can't edit Figma)
- "Organize Figma components" → requires_undefined_integration=true (BLOCKED! AI can't access Figma)
- "Implement designs from Figma" → requires_missing_information=true (BLOCKED! No access to Figma file)
- "Implement button from attached screenshot" → can_implement=true (PROCEED! Has visual reference)

Also score:
- clarity_score: 0-100 (how clear are the requirements?)
- complexity_score: 0-100 (how complex is the implementation?)
- effort_estimate: xs/s/m/l/xl (time estimate)
- risk_level: low/medium/high
- task_type: bug_fix/feature/refactor/docs/test/config/other
- estimated_impact: low/medium/high (business value)
- estimated_effort: low/medium/high (coding effort)

Respond ONLY with valid JSON (no markdown, no extra text):
{
  "should_evaluate": true/false,
  "clarity_score": 1-100,
  "has_acceptance_criteria": true/false,
  "auto_reject_reason": "reason or null",
  "ai_capability": {
    "cannot_determine_what_to_implement": true/false,
    "has_contradictory_requirements": true/false,
    "requires_undefined_integration": true/false,
    "requires_human_subjective_choice": true/false,
    "requires_missing_information": true/false,
    "integration_has_no_documentation": true/false,
    "requires_proprietary_knowledge": true/false,
    "requires_advanced_domain_expertise": true/false,
    "cannot_test_without_credentials": true/false,
    "cannot_test_without_paid_account": true/false,
    "cannot_test_without_hardware": true/false,
    "requires_production_access_to_test": true/false,
    "should_verify_visually": true/false,
    "should_verify_ux_flow": true/false,
    "should_verify_performance": true/false,
    "should_verify_security": true/false,
    "should_verify_accessibility": true/false,
    "high_risk_breaking_change": true/false,
    "requires_manual_testing": true/false
  },
  "blockers_summary": ["array of human-readable blocker reasons, empty if none"],
  "verification_summary": ["array of human-readable verification needs, empty if none"],
  "risk_summary": ["array of human-readable risk warnings, empty if none"],
  "complexity_score": 1-100,
  "effort_estimate": "xs/s/m/l/xl",
  "risk_level": "low/medium/high",
  "task_type": "bug_fix/feature/refactor/docs/test/config/other",
  "estimated_impact": "low/medium/high",
  "estimated_effort": "low/medium/high"
}`

  try {
    const message = await anthropic.messages.create({
      model,
      max_tokens: maxTokens,
      messages: [{
        role: 'user',
        content: prompt
      }]
    })

    const content = message.content[0]
    if (!content || content.type !== 'text') {
      throw new Error('Invalid response from Claude')
    }

    const jsonText = extractJSON(content.text)
    const result = JSON.parse(jsonText) as SimpleEvaluationResult

    logger.info(`✓ Simple evaluation: should_evaluate=${result.should_evaluate}, clarity=${result.clarity_score}`)

    const duration = Math.floor((Date.now() - startTime) / 1000)

    const usage: SimpleEvaluationUsage = {
      provider: 'anthropic',
      model,
      goal: 'evaluation',
      phase: 'simple_eval',
      input_tokens: message.usage.input_tokens,
      output_tokens: message.usage.output_tokens,
      cache_creation_input_tokens: message.usage.cache_creation_input_tokens || 0,
      cache_read_input_tokens: message.usage.cache_read_input_tokens || 0,
      duration_seconds: duration
    }

    logger.info('📊 Simple evaluation usage tracked')

    return { result, usage }
  } catch (error) {
    logger.error('Failed to perform simple evaluation:', error)

    if (error instanceof SyntaxError) {
      throw new Error(`JSON parse error in simple evaluation: ${error.message}`)
    }

    throw new Error(`Simple evaluation failed: ${error instanceof Error ? error.message : String(error)}`)
  }
}
