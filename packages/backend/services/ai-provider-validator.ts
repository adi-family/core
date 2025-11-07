import type { AnthropicConfig, OpenAIConfig, GoogleConfig, AIProviderValidationResult } from '@types'
import { createLogger } from '@utils/logger'
import { AI_MODEL_DEFAULTS } from '@adi-simple/config'

const logger = createLogger({ namespace: 'ai-provider-validator' })

export async function validateAnthropicConfig(
  config: AnthropicConfig,
  apiKey: string
): Promise<AIProviderValidationResult> {
  const result: AIProviderValidationResult = {
    valid: false,
    endpoint_reachable: false,
    authentication_valid: false,
    tested_at: new Date().toISOString()
  }

  try {
    const endpoint = config.type === 'self-hosted'
      ? config.endpoint_url
      : 'https://api.anthropic.com'

    const response = await fetch(`${endpoint}/v1/messages`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        ...(config.type === 'self-hosted' && config.additional_headers ? config.additional_headers : {})
      },
      body: JSON.stringify({
        model: config.model || 'claude-3-haiku-20240307',
        max_tokens: AI_MODEL_DEFAULTS.maxTokensForValidation,
        messages: [{ role: 'user', content: 'test' }]
      })
    })

    result.endpoint_reachable = true

    if (response.ok) {
      result.authentication_valid = true
      result.valid = true
      result.details = {
        status: response.status,
        endpoint
      }
    } else if (response.status === 401 || response.status === 403) {
      result.error = 'Authentication failed: Invalid API key'
      result.details = {
        status: response.status,
        error: await response.text()
      }
    } else {
      const errorText = await response.text()
      result.error = `Request failed with status ${response.status}`
      result.details = {
        status: response.status,
        error: errorText
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Anthropic validation failed: ${result.error}`)
  }

  return result
}

export async function validateOpenAIConfig(
  config: OpenAIConfig,
  apiKey: string
): Promise<AIProviderValidationResult> {
  const result: AIProviderValidationResult = {
    valid: false,
    endpoint_reachable: false,
    authentication_valid: false,
    tested_at: new Date().toISOString()
  }

  try {
    let endpoint = 'https://api.openai.com/v1'
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${apiKey}`
    }

    if (config.type === 'azure') {
      endpoint = config.endpoint_url.replace(/\/$/, '')
      headers['api-key'] = apiKey
      delete headers['Authorization']
    } else if (config.type === 'self-hosted') {
      endpoint = config.endpoint_url.replace(/\/$/, '')
      if (config.additional_headers) {
        Object.assign(headers, config.additional_headers)
      }
    } else if (config.type === 'cloud' && config.organization_id) {
      headers['OpenAI-Organization'] = config.organization_id
    }

    // Test with models endpoint first
    const testEndpoint = config.type === 'azure'
      ? `${endpoint}/openai/deployments/${config.deployment_name}/chat/completions?api-version=${config.api_version}`
      : `${endpoint}/models`

    const response = await fetch(testEndpoint, {
      method: config.type === 'azure' ? 'POST' : 'GET',
      headers,
      ...(config.type === 'azure' ? {
        body: JSON.stringify({
          messages: [{ role: 'user', content: 'test' }],
          max_tokens: 10
        })
      } : {})
    })

    result.endpoint_reachable = true

    if (response.ok) {
      result.authentication_valid = true
      result.valid = true
      const data = await response.json() as any
      result.details = {
        status: response.status,
        endpoint,
        ...(config.type !== 'azure' && data.data ? { models_count: data.data.length } : {})
      }
    } else if (response.status === 401 || response.status === 403) {
      result.error = 'Authentication failed: Invalid API key'
      result.details = {
        status: response.status,
        error: await response.text()
      }
    } else {
      const errorText = await response.text()
      result.error = `Request failed with status ${response.status}`
      result.details = {
        status: response.status,
        error: errorText
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`OpenAI validation failed: ${result.error}`)
  }

  return result
}

export async function validateGoogleConfig(
  config: GoogleConfig,
  apiKey: string
): Promise<AIProviderValidationResult> {
  const result: AIProviderValidationResult = {
    valid: false,
    endpoint_reachable: false,
    authentication_valid: false,
    tested_at: new Date().toISOString()
  }

  try {
    let endpoint: string
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    }

    if (config.type === 'vertex') {
      // Vertex AI uses service account credentials, different auth mechanism
      endpoint = `https://${config.location}-aiplatform.googleapis.com/v1/projects/${config.project_id}/locations/${config.location}/publishers/google/models/${config.model || 'gemini-pro'}:generateContent`
      headers['Authorization'] = `Bearer ${apiKey}`
    } else if (config.type === 'self-hosted') {
      endpoint = `${config.endpoint_url}/v1beta/models`
      if (config.additional_headers) {
        Object.assign(headers, config.additional_headers)
      }
    } else {
      // Cloud
      endpoint = `https://generativelanguage.googleapis.com/v1beta/models`
    }

    const url = config.type === 'cloud' ? `${endpoint}?key=${apiKey}` : endpoint

    const response = await fetch(url, {
      method: config.type === 'vertex' ? 'POST' : 'GET',
      headers,
      ...(config.type === 'vertex' ? {
        body: JSON.stringify({
          contents: [{ parts: [{ text: 'test' }] }],
          generationConfig: { maxOutputTokens: 10 }
        })
      } : {})
    })

    result.endpoint_reachable = true

    if (response.ok) {
      result.authentication_valid = true
      result.valid = true
      const data = await response.json() as any
      result.details = {
        status: response.status,
        endpoint,
        ...(data.models ? { models_count: data.models.length } : {})
      }
    } else if (response.status === 401 || response.status === 403) {
      result.error = 'Authentication failed: Invalid API key or insufficient permissions'
      result.details = {
        status: response.status,
        error: await response.text()
      }
    } else {
      const errorText = await response.text()
      result.error = `Request failed with status ${response.status}`
      result.details = {
        status: response.status,
        error: errorText
      }
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : 'Unknown error'
    logger.error(`Google validation failed: ${result.error}`)
  }

  return result
}

export async function validateAIProviderConfig(
  provider: 'anthropic' | 'openai' | 'google',
  config: AnthropicConfig | OpenAIConfig | GoogleConfig,
  apiKey: string
): Promise<AIProviderValidationResult> {
  switch (provider) {
    case 'anthropic':
      return validateAnthropicConfig(config as AnthropicConfig, apiKey)
    case 'openai':
      return validateOpenAIConfig(config as OpenAIConfig, apiKey)
    case 'google':
      return validateGoogleConfig(config as GoogleConfig, apiKey)
    default:
      throw new Error(`Unknown provider: ${provider}`)
  }
}
