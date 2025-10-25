import { useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from '@adi-simple/ui/input'
import { Label } from '@adi-simple/ui/label'
import { GitlabSecretAutocomplete } from '@adi-simple/ui/gitlab-secret-autocomplete'
import { GitlabRepositorySelect } from '@adi-simple/ui/gitlab-repository-select'
import { createAuthenticatedClient } from "@/lib/client"
import type { Secret } from "../../../types"

type GitlabIssuesConfig = {
  repo: string
  labels: string[]
  host?: string
  access_token_secret_id?: string
}

type GitlabTaskSourceConfigProps = {
  projectId: string
  config: GitlabIssuesConfig
  onChange: (field: keyof GitlabIssuesConfig, value: string | string[]) => void
}

export function GitlabTaskSourceConfig({ projectId, config, onChange }: GitlabTaskSourceConfigProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [gitlabHost, setGitlabHost] = useState(config.host || "https://gitlab.com")
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [selectedRepositoryId, setSelectedRepositoryId] = useState<number | null>(null)

  return (
    <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
      <h3 className="text-xs uppercase tracking-wide font-medium">GITLAB CONFIGURATION</h3>

      <div className="space-y-2">
        <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide">
          GITLAB HOST
        </Label>
        <Input
          id="gitlab_host"
          type="text"
          value={gitlabHost}
          onChange={(e) => {
            setGitlabHost(e.target.value)
            onChange("host", e.target.value)
          }}
          className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
          placeholder="https://gitlab.com"
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
        requiredScopes={["api"]}
        required={true}
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
