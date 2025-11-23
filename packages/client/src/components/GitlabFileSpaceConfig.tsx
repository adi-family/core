import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { GitlabRepositorySelect } from '@adi-simple/ui/gitlab-repository-select'
import { createAuthenticatedClient } from "@/lib/client"
import type { GitlabFileSpaceConfig as GitlabFileSpaceConfigType, Secret } from "../../../types"
import { DEFAULT_HOSTS } from '@adi-simple/config/shared'

interface GitlabFileSpaceConfigProps {
  projectId: string
  config: GitlabFileSpaceConfigType
  onChange: (field: keyof GitlabFileSpaceConfigType, value: string) => void
}

export function GitlabFileSpaceConfig({ projectId, config, onChange }: GitlabFileSpaceConfigProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [gitlabHost, setGitlabHost] = useState(config.host || DEFAULT_HOSTS.gitlab)
  const [hostUnlocked, setHostUnlocked] = useState(config.host !== undefined && config.host !== DEFAULT_HOSTS.gitlab)
  const [, setSelectedSecret] = useState<Secret | null>(null)
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null)

  return (
    <div className="space-y-4 p-4 rounded-xl border border-neutral-700/60 bg-neutral-900/30 backdrop-blur-sm">
      <h3 className="text-xs uppercase tracking-wide font-medium text-neutral-300">GITLAB FILE SPACE CONFIGURATION</h3>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide text-neutral-300">
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
          id="gitlab_host"
          type="text"
          value={gitlabHost}
          onChange={(e) => {
            setGitlabHost(e.target.value)
            onChange("host", e.target.value)
          }}
          disabled={!hostUnlocked}
          className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500 disabled:opacity-60 disabled:cursor-not-allowed"
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
        label={gitlabHost === DEFAULT_HOSTS.gitlab ? "GITLAB ACCESS TOKEN (OPTIONAL - uses default if not set)" : "GITLAB ACCESS TOKEN (requires: api, write_repository scopes)"}
        requiredScopes={["api", "write_repository"]}
        required={false}
      />

      {config.access_token_secret_id && (
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
      )}

      {!config.access_token_secret_id && gitlabHost === DEFAULT_HOSTS.gitlab && (
        <div className="space-y-2">
          <Label htmlFor="gitlab_repo" className="text-xs uppercase tracking-wide text-neutral-300">
            REPOSITORY (format: owner/repo)
          </Label>
          <Input
            id="gitlab_repo"
            type="text"
            value={config.repo}
            onChange={(e) => onChange("repo", e.target.value)}
            className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
            placeholder="e.g., myorg/myrepo"
            required
          />
        </div>
      )}

      {!config.access_token_secret_id && gitlabHost !== DEFAULT_HOSTS.gitlab && (
        <div className="space-y-2">
          <Label htmlFor="gitlab_repo" className="text-xs uppercase tracking-wide text-neutral-300">
            REPOSITORY (format: owner/repo)
          </Label>
          <Input
            id="gitlab_repo"
            type="text"
            value={config.repo}
            onChange={(e) => onChange("repo", e.target.value)}
            className="bg-neutral-900/50 backdrop-blur-sm border-neutral-700 text-neutral-200 placeholder:text-neutral-500 focus:border-neutral-500 focus:ring-neutral-500"
            placeholder="e.g., myorg/myrepo"
            required
          />
        </div>
      )}
    </div>
  )
}
