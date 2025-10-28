import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { Button } from '@adi-simple/ui/button'
import { createAuthenticatedClient } from "@/lib/client"
import type { AIProviderConfig, AIProviderValidationResult } from "../../../types"
import { CheckCircle2, XCircle, Loader2, AlertCircle, Trash2 } from "lucide-react"
import { siAnthropic, siOpenai, siGoogle } from "simple-icons"
import { toast } from "sonner"

type AIProviderSettingsProps = {
  projectId: string
}

type Provider = 'anthropic' | 'openai' | 'google'
type ProviderType = 'cloud' | 'azure' | 'vertex' | 'self-hosted'

type FormData = {
  type: ProviderType
  api_key: string
  endpoint_url?: string
  deployment_name?: string
  api_version?: string
  organization_id?: string
  project_id?: string
  location?: string
  model?: string
  max_tokens?: number
  temperature?: number
}

export function AIProviderSettings({ projectId }: AIProviderSettingsProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [currentConfigs, setCurrentConfigs] = useState<AIProviderConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedProvider, setSelectedProvider] = useState<Provider | null>(null)
  const [formData, setFormData] = useState<FormData>({
    type: 'cloud',
    api_key: '',
  })
  const [saving, setSaving] = useState(false)
  const [validating, setValidating] = useState(false)
  const [validationResult, setValidationResult] = useState<AIProviderValidationResult | null>(null)

  // Load current configurations
  useEffect(() => {
    const fetchConfigs = async () => {
      try {
        const res = await client.projects[":id"]["ai-providers"].$get({
          param: { id: projectId },
        })

        if (res.ok) {
          const data = await res.json()
          setCurrentConfigs(data)
        }
        setLoading(false)
      } catch (err) {
        console.error("Failed to load AI provider configs:", err)
        setError("Failed to load configurations")
        setLoading(false)
      }
    }

    fetchConfigs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Auto-select first available provider when configs load
  useEffect(() => {
    if (!loading && currentConfigs && !selectedProvider) {
      // Select first supported provider (currently only Anthropic)
      const supportedProviders: Provider[] = ['anthropic', 'openai', 'google']
      const firstSupported = supportedProviders.find(p => p === 'anthropic')
      if (firstSupported) {
        handleProviderSelect(firstSupported)
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, currentConfigs])

  const handleProviderSelect = (provider: Provider) => {
    setSelectedProvider(provider)
    setValidationResult(null)
    setError(null)

    // Pre-fill form if config exists
    const existingConfig = currentConfigs?.[provider]
    if (existingConfig) {
      setFormData({
        type: existingConfig.type as ProviderType,
        api_key: '', // Don't pre-fill API key for security
        endpoint_url: 'endpoint_url' in existingConfig ? existingConfig.endpoint_url : undefined,
        deployment_name: 'deployment_name' in existingConfig ? existingConfig.deployment_name : undefined,
        api_version: 'api_version' in existingConfig ? existingConfig.api_version : undefined,
        organization_id: 'organization_id' in existingConfig ? existingConfig.organization_id : undefined,
        project_id: 'project_id' in existingConfig ? existingConfig.project_id : undefined,
        location: 'location' in existingConfig ? existingConfig.location : undefined,
        model: existingConfig.model,
        max_tokens: existingConfig.max_tokens,
        temperature: existingConfig.temperature,
      })
    } else {
      setFormData({
        type: 'cloud',
        api_key: '',
      })
    }
  }

  const handleTestConnection = async () => {
    if (!selectedProvider) return

    setValidating(true)
    setValidationResult(null)
    setError(null)

    try {
      const res = await client.projects[":id"]["ai-providers"][":provider"].validate.$post({
        param: { id: projectId, provider: selectedProvider },
        json: formData as any,
      })

      if (res.ok) {
        const result = await res.json()
        setValidationResult(result)
      } else {
        const errorData = await res.json()
        setError((errorData as { error?: string }).error || "Validation failed")
      }
    } catch (err) {
      setError(`Validation error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setValidating(false)
    }
  }

  const handleSave = async () => {
    if (!selectedProvider) return

    setSaving(true)
    setError(null)

    try {
      const res = await client.projects[":id"]["ai-providers"][":provider"].$put({
        param: { id: projectId, provider: selectedProvider },
        json: formData as any,
      })

      if (res.ok) {
        const updatedConfig = await res.json()
        setCurrentConfigs(prev => ({
          ...prev,
          [selectedProvider]: updatedConfig,
        }))
        setSelectedProvider(null)
        setValidationResult(null)

        // Reload configs to get the full updated state
        const reloadRes = await client.projects[":id"]["ai-providers"].$get({
          param: { id: projectId },
        })
        if (reloadRes.ok) {
          const data = await reloadRes.json()
          setCurrentConfigs(data)
        }
      } else {
        const errorData = await res.json()
        setError((errorData as { error?: string }).error || "Failed to save configuration")
      }
    } catch (err) {
      setError(`Save error: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (provider: Provider) => {
    if (!confirm(`Are you sure you want to delete the ${provider} configuration?`)) {
      return
    }

    try {
      const res = await client.projects[":id"]["ai-providers"][":provider"].$delete({
        param: { id: projectId, provider },
      })

      if (res.ok) {
        setCurrentConfigs(prev => {
          if (!prev) return null
          const updated = { ...prev }
          delete updated[provider]
          return updated
        })
        if (selectedProvider === provider) {
          setSelectedProvider(null)
        }
      } else {
        toast.error("Failed to delete configuration")
      }
    } catch (err) {
      toast.error(`Delete error: ${err instanceof Error ? err.message : "Unknown error"}`)
    }
  }

  const getProviderLogo = (provider: Provider) => {
    const iconData = provider === 'anthropic' ? siAnthropic : provider === 'openai' ? siOpenai : siGoogle

    return (
      <svg
        role="img"
        viewBox="0 0 24 24"
        className="w-6 h-6"
        fill={`#${iconData.hex}`}
        xmlns="http://www.w3.org/2000/svg"
      >
        <title>{iconData.title}</title>
        <path d={iconData.path} />
      </svg>
    )
  }

  const getProviderTypeOptions = (provider: Provider): { value: ProviderType; label: string }[] => {
    switch (provider) {
      case 'anthropic':
        return [
          { value: 'cloud', label: 'Anthropic Cloud' },
          { value: 'self-hosted', label: 'Self-Hosted' },
        ]
      case 'openai':
        return [
          { value: 'cloud', label: 'OpenAI Cloud' },
          { value: 'azure', label: 'Azure OpenAI' },
          { value: 'self-hosted', label: 'Self-Hosted' },
        ]
      case 'google':
        return [
          { value: 'cloud', label: 'Google Cloud' },
          { value: 'vertex', label: 'Vertex AI' },
          { value: 'self-hosted', label: 'Self-Hosted' },
        ]
    }
  }

  const getApiKeyUrl = (provider: Provider, type: ProviderType): string | null => {
    if (type !== 'cloud') return null

    switch (provider) {
      case 'anthropic':
        return 'https://console.anthropic.com/settings/keys'
      case 'openai':
        return 'https://platform.openai.com/api-keys'
      case 'google':
        return 'https://console.cloud.google.com/apis/credentials'
      default:
        return null
    }
  }

  const renderProviderForm = () => {
    if (!selectedProvider) return null

    const typeOptions = getProviderTypeOptions(selectedProvider)

    return (
      <div className="space-y-4 p-6 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-gray-300">Provider Type</Label>
          <select
            value={formData.type}
            onChange={(e) => setFormData({ ...formData, type: e.target.value as ProviderType })}
            className="w-full px-3 py-2 border border-slate-600 rounded-md bg-slate-800/50 text-gray-100"
          >
            {typeOptions.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className="space-y-2">
          <Label className="text-xs uppercase tracking-wide text-gray-300">API Key *</Label>
          <Input
            type="password"
            value={formData.api_key}
            onChange={(e) => setFormData({ ...formData, api_key: e.target.value })}
            placeholder="Enter API key"
            className="bg-slate-800/50 border-slate-600 text-gray-100"
            required
          />
          {getApiKeyUrl(selectedProvider, formData.type) && (
            <p className="text-xs text-gray-400">
              <a
                href={getApiKeyUrl(selectedProvider, formData.type)!}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
              >
                Create a new API key
              </a>
            </p>
          )}
        </div>

        {/* Endpoint URL for self-hosted, azure, vertex */}
        {(formData.type === 'self-hosted' || formData.type === 'azure') && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">Endpoint URL *</Label>
            <Input
              type="url"
              value={formData.endpoint_url || ''}
              onChange={(e) => setFormData({ ...formData, endpoint_url: e.target.value })}
              placeholder={formData.type === 'azure' ? 'https://myresource.openai.azure.com' : 'https://...'}
              className="bg-slate-800/50 border-slate-600 text-gray-100"
              required
            />
          </div>
        )}

        {/* Azure-specific fields */}
        {formData.type === 'azure' && selectedProvider === 'openai' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-300">Deployment Name *</Label>
              <Input
                value={formData.deployment_name || ''}
                onChange={(e) => setFormData({ ...formData, deployment_name: e.target.value })}
                placeholder="gpt-4"
                className="bg-slate-800/50 border-slate-600 text-gray-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-300">API Version *</Label>
              <Input
                value={formData.api_version || ''}
                onChange={(e) => setFormData({ ...formData, api_version: e.target.value })}
                placeholder="2024-02-15-preview"
                className="bg-slate-800/50 border-slate-600 text-gray-100"
                required
              />
            </div>
          </>
        )}

        {/* Vertex AI-specific fields */}
        {formData.type === 'vertex' && selectedProvider === 'google' && (
          <>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-300">Project ID *</Label>
              <Input
                value={formData.project_id || ''}
                onChange={(e) => setFormData({ ...formData, project_id: e.target.value })}
                placeholder="my-project"
                className="bg-slate-800/50 border-slate-600 text-gray-100"
                required
              />
            </div>
            <div className="space-y-2">
              <Label className="text-xs uppercase tracking-wide text-gray-300">Location *</Label>
              <Input
                value={formData.location || ''}
                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                placeholder="us-central1"
                className="bg-slate-800/50 border-slate-600 text-gray-100"
                required
              />
            </div>
          </>
        )}

        {/* OpenAI Cloud organization ID */}
        {formData.type === 'cloud' && selectedProvider === 'openai' && (
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">Organization ID (Optional)</Label>
            <Input
              value={formData.organization_id || ''}
              onChange={(e) => setFormData({ ...formData, organization_id: e.target.value })}
              placeholder="org-..."
              className="bg-slate-800/50 border-slate-600 text-gray-100"
            />
          </div>
        )}

        {/* Validation Result */}
        {validationResult && (
          <div className={`p-4 border rounded ${validationResult.valid ? 'bg-green-500/10 border-green-500/30' : 'bg-red-500/10 border-red-500/30'}`}>
            <div className="flex items-center gap-2 mb-2">
              {validationResult.valid ? (
                <CheckCircle2 className="w-5 h-5 text-green-400" />
              ) : (
                <XCircle className="w-5 h-5 text-red-400" />
              )}
              <span className={`font-medium ${validationResult.valid ? 'text-green-300' : 'text-red-300'}`}>
                {validationResult.valid ? 'Configuration Valid' : 'Configuration Invalid'}
              </span>
            </div>
            <div className="text-sm space-y-1 text-gray-300">
              <div>Endpoint Reachable: {validationResult.endpoint_reachable ? '✓' : '✗'}</div>
              <div>Authentication Valid: {validationResult.authentication_valid ? '✓' : '✗'}</div>
              {validationResult.error && (
                <div className="text-red-300 mt-2">{validationResult.error}</div>
              )}
            </div>
          </div>
        )}

        {/* Error Display */}
        {error && (
          <div className="bg-red-500/10 text-red-300 px-4 py-3 border border-red-500/30 rounded flex items-center gap-2">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex gap-2 pt-4">
          <Button
            onClick={handleTestConnection}
            disabled={validating || !formData.api_key}
            variant="outline"
          >
            {validating ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Testing...
              </>
            ) : (
              'Test Connection'
            )}
          </Button>
          <Button
            onClick={handleSave}
            disabled={saving || !formData.api_key}
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              'Save Configuration'
            )}
          </Button>
          <Button
            onClick={() => setSelectedProvider(null)}
            variant="ghost"
          >
            Cancel
          </Button>
        </div>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="text-center py-8">
        <Loader2 className="w-8 h-8 animate-spin mx-auto text-gray-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-slate-700/50 pb-4">
        <h3 className="text-lg uppercase tracking-wide text-gray-100">
          AI Provider Configuration
        </h3>
        <p className="text-xs text-gray-400 uppercase tracking-wide mt-1">
          Configure AI provider API keys and settings for pipeline execution
        </p>
      </div>

      {/* Current Configurations */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {(['anthropic', 'openai', 'google'] as Provider[]).map((provider) => {
          const config = currentConfigs?.[provider]
          const isConfigured = !!config
          const isSupported = provider === 'anthropic'

          return (
            <div
              key={provider}
              className={`p-4 border-2 rounded-lg transition-all ${
                !isSupported
                  ? 'border-slate-700/50 bg-slate-800/20 opacity-60 cursor-not-allowed'
                  : selectedProvider === provider
                  ? 'border-blue-500 bg-blue-500/10 cursor-pointer'
                  : isConfigured
                  ? 'border-green-500/40 bg-green-500/10 hover:border-green-400 cursor-pointer'
                  : 'border-slate-700/50 bg-slate-800/20 hover:border-slate-600 cursor-pointer'
              }`}
              onClick={() => isSupported && handleProviderSelect(provider)}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-3">
                  <div className="flex-shrink-0">
                    {getProviderLogo(provider)}
                  </div>
                  <h4 className="font-medium uppercase tracking-wide text-gray-100">
                    {provider === 'anthropic' ? 'Anthropic' : provider === 'openai' ? 'OpenAI' : 'Google'}
                  </h4>
                </div>
                {!isSupported ? (
                  <span className="text-xs font-medium px-2 py-1 bg-amber-500/20 text-amber-300 border border-amber-500/30 rounded uppercase tracking-wide">
                    Private Beta
                  </span>
                ) : isConfigured ? (
                  <div className="flex items-center gap-2">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                    <button
                      onClick={(e) => {
                        e.stopPropagation()
                        handleDelete(provider)
                      }}
                      className="text-red-400 hover:text-red-300 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ) : (
                  <AlertCircle className="w-5 h-5 text-gray-400" />
                )}
              </div>
              <div className="text-sm text-gray-300">
                {!isSupported ? (
                  <div className="text-xs text-gray-400">
                    Available only in private beta
                  </div>
                ) : isConfigured ? (
                  <>
                    <div className="capitalize">{config.type}</div>
                    {config.model && <div className="text-xs text-gray-400">{config.model}</div>}
                  </>
                ) : (
                  <div className="text-gray-400">Not configured</div>
                )}
              </div>
            </div>
          )
        })}
      </div>

      {/* Configuration Form */}
      {selectedProvider && (
        <div className="mt-6">
          <div className="flex items-center gap-3 mb-4">
            {getProviderLogo(selectedProvider)}
            <h4 className="text-md font-medium uppercase tracking-wide text-gray-100">
              Configure {selectedProvider === 'anthropic' ? 'Anthropic' : selectedProvider === 'openai' ? 'OpenAI' : 'Google'}
            </h4>
          </div>
          {renderProviderForm()}
        </div>
      )}

    </div>
  )
}
