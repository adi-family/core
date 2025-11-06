import { useState, useEffect, useRef, useCallback } from "react"
import { Label } from './label'
import { Input } from './input'
import { Loader2, GitBranch, Check, Search } from "lucide-react"
import { getGitLabRepositoriesConfig } from '@adi/api-contracts/secrets'

type Repository = {
  id: number
  name: string
  path_with_namespace: string
  description: string | null
  web_url: string
}

type GitlabRepositoryMultiSelectProps = {
  client: any
  host: string
  secretId: string
  value: string[]
  onChange: (repositories: string[]) => void
  label?: string
  required?: boolean
}

export function GitlabRepositoryMultiSelect({
  client,
  host,
  secretId,
  value,
  onChange,
  label = "GITLAB REPOSITORIES",
  required = false,
}: GitlabRepositoryMultiSelectProps) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const searchTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  // Load repositories from backend API with search support
  const loadRepositories = useCallback(async (searchQuery?: string) => {
    if (!secretId || !host) {
      setRepositories([])
      return
    }

    setLoading(true)
    setError(null)

    try {
      const data = await client.run(getGitLabRepositoriesConfig, {
        body: {
          secretId,
          host,
          search: searchQuery,
          perPage: 100
        }
      }) as Repository[]

      setRepositories(data)
    } catch (err) {
      setError(`Error loading repositories: ${err instanceof Error ? err.message : "Unknown error"}`)
      setRepositories([])
    } finally {
      setLoading(false)
    }
  }, [secretId, host, client])

  // Debounced search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search on empty string or less than 3 characters
    if (!search.trim() || search.trim().length < 3) {
      setRepositories([])
      return
    }

    // Set new timeout for search
    searchTimeoutRef.current = setTimeout(() => {
      loadRepositories(search)
    }, 500) // 500ms debounce

    return () => {
      if (searchTimeoutRef.current) {
        clearTimeout(searchTimeoutRef.current)
      }
    }
  }, [search, loadRepositories])

  const handleToggleRepository = (pathWithNamespace: string) => {
    if (value.includes(pathWithNamespace)) {
      onChange(value.filter((r) => r !== pathWithNamespace))
    } else {
      onChange([...value, pathWithNamespace])
    }
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label className="text-xs uppercase tracking-wide text-gray-300">
          {label}
          {required && <span className="text-red-400 ml-1">*</span>}
        </Label>
        <p className="text-xs text-gray-400">
          {value.length === 0
            ? "Select repositories to create file spaces"
            : `${value.length} ${value.length === 1 ? 'repository' : 'repositories'} selected`
          }
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 text-red-400 px-4 py-3 rounded-lg border border-red-700/50 backdrop-blur-sm text-sm">
          {error}
        </div>
      )}

      {!secretId || !host ? (
        <div className="bg-yellow-900/20 text-yellow-400 px-4 py-3 rounded-lg border border-yellow-700/50 backdrop-blur-sm text-sm">
          Please provide GitLab host and select a valid access token first
        </div>
      ) : (
        <>
          {/* Search Input */}
          <div className="relative">
            <Input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
              placeholder="Type at least 3 characters to search repositories..."
            />
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
              ) : (
                <Search className="w-4 h-4 text-gray-400" />
              )}
            </div>
          </div>

          {/* Search hint */}
          <div className="text-xs text-gray-400">
            Type at least 3 characters to search GitLab repositories by name or path
          </div>

          {/* Repository Grid or Empty States */}
          {!search.trim() ? (
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50 text-center">
              <div className="text-sm text-gray-400">Start typing to search repositories...</div>
            </div>
          ) : search.trim().length < 3 ? (
            <div className="bg-yellow-900/20 text-yellow-400 px-4 py-3 rounded-lg border border-yellow-700/50 backdrop-blur-sm text-sm text-center">
              Type at least 3 characters to search
            </div>
          ) : loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
              <span className="ml-2 text-sm text-gray-400">Searching repositories...</span>
            </div>
          ) : repositories.length === 0 ? (
            <div className="bg-slate-800/50 p-6 rounded-lg border border-slate-700/50 text-center">
              <div className="text-sm text-gray-400">No repositories found for "{search}"</div>
            </div>
          ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-96 overflow-y-auto pr-2">
          {repositories.map((repo) => {
            const isSelected = value.includes(repo.path_with_namespace)
            return (
              <button
                key={repo.id}
                type="button"
                onClick={() => handleToggleRepository(repo.path_with_namespace)}
                className={`
                  group relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
                  ${isSelected
                    ? 'border-green-500 bg-green-500/20 shadow-lg shadow-green-500/20'
                    : 'border-slate-700/50 bg-slate-800/50 hover:border-green-500/50 hover:bg-slate-700/50 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${isSelected
                      ? 'bg-green-500/30 text-green-400'
                      : 'bg-slate-700/50 text-gray-400 group-hover:bg-green-500/20 group-hover:text-green-400'
                    }
                  `}>
                    {isSelected ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <GitBranch className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`
                      font-medium text-sm mb-1 transition-colors truncate
                      ${isSelected
                        ? 'text-green-300'
                        : 'text-gray-200 group-hover:text-gray-100'
                      }
                    `}>
                      {repo.path_with_namespace}
                    </div>
                    {repo.description && (
                      <div className="text-xs text-gray-400 line-clamp-2">
                        {repo.description}
                      </div>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
          )}
        </>
      )}
    </div>
  )
}
