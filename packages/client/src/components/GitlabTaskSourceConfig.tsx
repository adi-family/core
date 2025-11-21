import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { GitlabRepositorySelect } from '@adi-simple/ui/gitlab-repository-select'
import { createAuthenticatedClient } from "@/lib/client"
import type { Secret } from "../../../types"
import { DEFAULT_HOSTS, GITLAB_SCOPES } from '@adi-simple/config/shared'

interface GitlabIssuesConfig {
  repo: string
  labels: string[]
  host?: string
  access_token_secret_id?: string
}

interface GitlabTaskSourceConfigProps {
  projectId: string
  config: GitlabIssuesConfig
  onChange: (field: keyof GitlabIssuesConfig, value: string | string[]) => void
}

export function GitlabTaskSourceConfig({ projectId, config, onChange }: GitlabTaskSourceConfigProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [gitlabHost, setGitlabHost] = useState(config.host || DEFAULT_HOSTS.gitlab)
  const [hostUnlocked, setHostUnlocked] = useState(config.host !== undefined && config.host !== DEFAULT_HOSTS.gitlab)
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null)
  const API_BASE_URL = import.meta.env.VITE_API_URL || '/api'

  return (
    <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
      <h3 className="text-xs uppercase tracking-wide font-medium text-gray-300">GITLAB CONFIGURATION</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide text-gray-300">
            GITLAB HOST
          </Label>
          {!hostUnlocked && (
            <button
              type="button"
              onClick={() => setHostUnlocked(true)}
              className="text-xs text-blue-400 hover:text-blue-300 hover:underline"
            >
              Customize GitLab URL
            </button>
          )}
        </div>
        <Input
          id="gitlab_host"
          type="text"
          value={gitlabHost}
          onChange={(e) => {
            setGitlabHost(e.target.value)
            onChange("host", e.target.value)
          }}
          disabled={!hostUnlocked}
          className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100 disabled:opacity-60 disabled:cursor-not-allowed"
          placeholder={DEFAULT_HOSTS.gitlab}
        />
      </div>

      <GitlabSecretAutocomplete
        client={client}
        projectId={projectId}
        host={gitlabHost}
        value={config.access_token_secret_id || null}
        onChange={(secretId, secret) => {
          onChange("access_token_secret_id", secretId || "")
          setSelectedSecret(secret || null)
        }}
        label="GITLAB ACCESS TOKEN (requires: api scope)"
        requiredScopes={GITLAB_SCOPES.taskSource}
        required={true}
        enableOAuth={true}
        apiBaseUrl={API_BASE_URL}
      />

      {selectedSecret && config.access_token_secret_id && (
        <>
          <GitlabRepositorySelect
            client={client}
            host={gitlabHost}
            secretId={config.access_token_secret_id}
            value={selectedRepositoryId}
            onChange={(repoId, repo) => {
              setSelectedRepositoryId(repoId)
              if (repo) {
                onChange("repo", repo.path_with_namespace)
              }
            }}
            required={true}
          />
        </>
      )}
    </div>
  )
}
