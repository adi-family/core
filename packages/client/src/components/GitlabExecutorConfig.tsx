import { useState, useEffect, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { createAuthenticatedClient } from "@/lib/client"
import { getProjectGitLabExecutorConfig, createProjectGitLabExecutorConfig, deleteProjectGitLabExecutorConfig } from '@adi/api-contracts/projects'
import { CheckCircle2, XCircle, Loader2, Trash2 } from "lucide-react"

interface GitlabExecutorConfigProps {
  projectId: string
}

interface ExecutorConfig {
  host: string
  user: string
  verified_at: string
  access_token: string
}

export function GitlabExecutorConfig({ projectId }: GitlabExecutorConfigProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [existingConfig, setExistingConfig] = useState<ExecutorConfig | null>(null)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState<string | null>(null)

  // Form state
  const [host, setHost] = useState("https://gitlab.com")
  const [hostUnlocked, setHostUnlocked] = useState(false)
  const [accessTokenSecretId, setAccessTokenSecretId] = useState<string | null>(null)

  // Load existing config
  useEffect(() => {
    const loadConfig = async () => {
      try {
        const data = await client.run(getProjectGitLabExecutorConfig, {
          params: { id: projectId },
        })
        if (data && typeof data === 'object' && 'host' in data) {
          setExistingConfig(data as unknown as ExecutorConfig)
          setHost(data.host)
          setHostUnlocked(data.host !== "https://gitlab.com")
        }
      } catch (err) {
        console.error("Failed to load executor config:", err)
      } finally {
        setLoading(false)
      }
    }

    loadConfig()
     
  }, [projectId])

  const handleSave = async () => {
    if (!host || !accessTokenSecretId) {
      setError("Host and access token are required")
      return
    }

    setSaving(true)
    setError(null)
    setSuccess(null)

    try {
      const data = await client.run(createProjectGitLabExecutorConfig, {
        params: { id: projectId },
        body: { host, access_token_secret_id: accessTokenSecretId },
      }) as unknown as ExecutorConfig
      setExistingConfig(data)
      setAccessTokenSecretId(null) // Clear selection after successful save
      setSuccess("GitLab executor configured successfully!")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save executor config")
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    if (!confirm("Are you sure you want to remove the GitLab executor configuration? The project will fall back to the default worker repository executor.")) {
      return
    }

    setDeleting(true)
    setError(null)
    setSuccess(null)

    try {
      await client.run(deleteProjectGitLabExecutorConfig, {
        params: { id: projectId },
      })
      setExistingConfig(null)
      setAccessTokenSecretId(null)
      setSuccess("GitLab executor configuration removed")
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete executor config")
    } finally {
      setDeleting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="w-6 h-6 animate-spin text-neutral-400" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="border-b border-neutral-700/50 pb-4">
        <h3 className="text-lg uppercase tracking-wide text-neutral-100">
          GITLAB PIPELINE EXECUTOR
        </h3>
        <p className="text-xs text-neutral-400 uppercase tracking-wide mt-1">
          Configure custom GitLab instance for pipeline execution
        </p>
      </div>

      {error && (
        <div className="bg-neutral-700/10 text-neutral-300 px-4 py-3 border border-neutral-700/30 backdrop-blur-sm text-sm flex items-center gap-2 rounded">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {success && (
        <div className="bg-neutral-500/10 text-neutral-300 px-4 py-3 border border-neutral-500/30 backdrop-blur-sm text-sm flex items-center gap-2 rounded">
          <CheckCircle2 className="w-4 h-4" />
          {success}
        </div>
      )}

      {existingConfig && (
        <div className="bg-neutral-500/10 p-4 border border-neutral-500/30 backdrop-blur-sm rounded">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2 text-neutral-400">
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-xs uppercase tracking-wide font-medium">CONFIGURED</div>
            </div>
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="text-neutral-500 hover:text-neutral-400 disabled:opacity-50 transition-colors"
              title="Remove executor configuration"
            >
              {deleting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Trash2 className="w-4 h-4" />
              )}
            </button>
          </div>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-neutral-400 text-xs uppercase tracking-wide">Host:</span>
              <div className="font-mono mt-1 text-neutral-100">{existingConfig.host}</div>
            </div>
            {existingConfig.user && (
              <div>
                <span className="text-neutral-400 text-xs uppercase tracking-wide">User:</span>
                <div className="font-mono mt-1 text-neutral-100">{existingConfig.user}</div>
              </div>
            )}
            {existingConfig.verified_at && (
              <div>
                <span className="text-neutral-400 text-xs uppercase tracking-wide">Verified:</span>
                <div className="mt-1 text-neutral-100">{new Date(existingConfig.verified_at).toLocaleString()}</div>
              </div>
            )}
          </div>
        </div>
      )}

      <div className="space-y-4 p-6 border border-neutral-700/50 bg-neutral-900/30 backdrop-blur-sm rounded">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label htmlFor="executor_host" className="text-xs uppercase tracking-wide text-neutral-300">
              GITLAB HOST
            </Label>
            {!hostUnlocked && (
              <button
                type="button"
                onClick={() => setHostUnlocked(true)}
                className="text-xs text-neutral-400 hover:text-neutral-300 hover:underline"
              >
                Customize GitLab URL
              </button>
            )}
          </div>
          <Input
            id="executor_host"
            type="text"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            disabled={!hostUnlocked}
            className="bg-neutral-800/50 backdrop-blur-sm border-neutral-600 focus:border-neutral-400 focus:ring-neutral-400 text-neutral-100 disabled:opacity-60 disabled:cursor-not-allowed"
            placeholder="https://gitlab.com"
          />
          <p className="text-xs text-neutral-400">
            The GitLab instance URL where pipelines will be executed
          </p>
        </div>

        <GitlabSecretAutocomplete
          client={client}
          projectId={projectId}
          host={host}
          value={accessTokenSecretId}
          onChange={(secretId) => setAccessTokenSecretId(secretId)}
          label="GITLAB ACCESS TOKEN"
          required
          requiredScopes={["api"]}
        />

        <button
          onClick={handleSave}
          disabled={saving || !host || !accessTokenSecretId}
          className="px-4 py-2 bg-neutral-500 text-white text-sm font-medium uppercase tracking-wide hover:bg-neutral-600 disabled:opacity-50 disabled:cursor-not-allowed shadow-sm active:scale-95 transition-all duration-200"
        >
          {saving ? (
            <span className="flex items-center gap-2">
              <Loader2 className="w-4 h-4 animate-spin" />
              Verifying & Saving...
            </span>
          ) : existingConfig ? (
            "Update Executor"
          ) : (
            "Configure Executor"
          )}
        </button>
      </div>
    </div>
  )
}
