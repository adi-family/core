import { useState, useEffect, useCallback, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createAuthenticatedClient } from "@/lib/client"
import { GitlabSecretAutocomplete } from "./GitlabSecretAutocomplete"
import type { Secret } from "../../../types"
import { Search, CheckCircle2, XCircle, Loader2 } from "lucide-react"

type GitlabRepository = {
  id: number
  name: string
  path_with_namespace: string
  description: string | null
}

type GitlabConfigurationProps = {
  projectId: string
}

export function GitlabConfiguration({ projectId }: GitlabConfigurationProps) {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const [gitlabHost, setGitlabHost] = useState("https://gitlab.com")
  const [selectedSecretId, setSelectedSecretId] = useState<string | null>(null)
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [error, setError] = useState<string | null>(null)

  // Repository autocomplete
  const [repositorySearch, setRepositorySearch] = useState("")
  const [repositories, setRepositories] = useState<GitlabRepository[]>([])
  const [searchingRepos, setSearchingRepos] = useState(false)
  const [selectedRepository, setSelectedRepository] = useState<GitlabRepository | null>(null)
  const [showRepositoryDropdown, setShowRepositoryDropdown] = useState(false)

  // Load selected secret details
  useEffect(() => {
    const loadSecret = async () => {
      if (!selectedSecretId) {
        setSelectedSecret(null)
        return
      }

      try {
        const res = await client.secrets[":id"].$get({
          param: { id: selectedSecretId },
        })

        if (res.ok) {
          const secret = await res.json()
          setSelectedSecret(secret)
        }
      } catch (err) {
        console.error("Failed to load secret:", err)
      }
    }

    loadSecret()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSecretId])

  const searchRepositories = useCallback(async (searchTerm: string) => {
    if (!selectedSecret || !searchTerm.trim()) {
      setRepositories([])
      return
    }

    setSearchingRepos(true)
    setError(null)

    try {
      // Search GitLab repositories using the token
      const response = await fetch(`${gitlabHost}/api/v4/projects?search=${encodeURIComponent(searchTerm)}&per_page=10`, {
        headers: {
          "PRIVATE-TOKEN": selectedSecret.value,
        },
      })

      if (!response.ok) {
        throw new Error(`GitLab API error: ${response.statusText}`)
      }

      const data: GitlabRepository[] = await response.json()
      setRepositories(data)
    } catch (err) {
      setError(`Failed to search repositories: ${err instanceof Error ? err.message : "Unknown error"}`)
      setRepositories([])
    } finally {
      setSearchingRepos(false)
    }
  }, [selectedSecret, gitlabHost])

  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (repositorySearch && selectedSecret) {
        searchRepositories(repositorySearch)
      }
    }, 300)

    return () => clearTimeout(timeoutId)
  }, [repositorySearch, selectedSecret, searchRepositories])

  return (
    <div className="space-y-6">
      <div className="border-b border-gray-200/60 pb-4">
        <h3 className="text-lg uppercase tracking-wide bg-gradient-to-r from-gray-800 to-gray-900 bg-clip-text text-transparent">
          GITLAB CONFIGURATION
        </h3>
        <p className="text-xs text-gray-500 uppercase tracking-wide mt-1">
          Configure GitLab integration for this project
        </p>
      </div>

      {error && (
        <div className="bg-red-50/90 text-red-600 px-4 py-3 border border-red-200/60 backdrop-blur-sm text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      <div className="space-y-4 p-6 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
        <div className="space-y-2">
          <Label htmlFor="gitlab_host" className="text-xs uppercase tracking-wide">
            GITLAB HOST
          </Label>
          <Input
            id="gitlab_host"
            type="text"
            value={gitlabHost}
            onChange={(e) => setGitlabHost(e.target.value)}
            className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
            placeholder="https://gitlab.com"
          />
        </div>

        <GitlabSecretAutocomplete
          projectId={projectId}
          host={gitlabHost}
          value={selectedSecretId}
          onChange={(secretId) => setSelectedSecretId(secretId)}
          required
          requiredScopes={["api"]}
        />

        {selectedSecret && (
          <>

            <div className="space-y-2">
              <Label htmlFor="repository" className="text-xs uppercase tracking-wide">
                SEARCH REPOSITORY
              </Label>
              <div className="relative">
                <Input
                  id="repository"
                  type="text"
                  value={repositorySearch}
                  onChange={(e) => {
                    setRepositorySearch(e.target.value)
                    setShowRepositoryDropdown(true)
                  }}
                  onFocus={() => setShowRepositoryDropdown(true)}
                  className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                  placeholder="Start typing to search repositories..."
                />
                <div className="absolute right-3 top-1/2 -translate-y-1/2">
                  {searchingRepos ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <Search className="w-4 h-4 text-gray-400" />
                  )}
                </div>

                {/* Autocomplete Dropdown */}
                {showRepositoryDropdown && repositories.length > 0 && (
                  <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200/60 shadow-lg max-h-60 overflow-auto">
                    {repositories.map((repo) => (
                      <button
                        key={repo.id}
                        type="button"
                        onClick={() => {
                          setSelectedRepository(repo)
                          setRepositorySearch(repo.path_with_namespace)
                          setShowRepositoryDropdown(false)
                        }}
                        className="w-full px-4 py-3 text-left hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-b-0"
                      >
                        <div className="font-medium text-sm">{repo.path_with_namespace}</div>
                        {repo.description && (
                          <div className="text-xs text-gray-500 mt-1">{repo.description}</div>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <p className="text-xs text-gray-500">
                Type to search your GitLab repositories. The token must have <code className="bg-gray-100 px-1">api</code> or <code className="bg-gray-100 px-1">read_api</code> scope.
              </p>
            </div>

            {selectedRepository && (
              <div className="bg-white/90 p-4 border border-gray-200/60">
                <div className="flex items-center gap-2 text-green-600 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <div className="text-xs uppercase tracking-wide font-medium">SELECTED REPOSITORY</div>
                </div>
                <div className="font-medium">{selectedRepository.path_with_namespace}</div>
                {selectedRepository.description && (
                  <div className="text-sm text-gray-600 mt-1">{selectedRepository.description}</div>
                )}
              </div>
            )}

            <div className="pt-4 border-t border-gray-200">
              <p className="text-xs text-gray-500 uppercase tracking-wide mb-2">
                Next steps:
              </p>
              <ul className="text-sm text-gray-600 space-y-1 list-disc list-inside">
                <li>Create a Task Source using this GitLab configuration</li>
                <li>Repository: <code className="bg-gray-100 px-1">{selectedRepository?.path_with_namespace || "Not selected"}</code></li>
                <li>Use the secret ID: <code className="bg-gray-100 px-1 text-xs">{selectedSecret?.id}</code></li>
              </ul>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
