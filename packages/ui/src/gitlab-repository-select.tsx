import { useState, useEffect, useRef, useCallback } from "react"
import { Label } from './label'
import { Input } from './input'
import { Portal } from './portal'
import { Loader2, Search, GitBranch } from "lucide-react"
import { getGitLabRepositoriesConfig } from '@adi/api-contracts/secrets'

interface Repository {
  id: number
  name: string
  path_with_namespace: string
  description: string | null
  web_url: string
}

interface GitlabRepositorySelectProps {
  client: any
  host: string
  secretId: string
  value?: number | null
  onChange: (repositoryId: number | null, repository: Repository | null) => void
  label?: string
  required?: boolean
}

export function GitlabRepositorySelect({
  client,
  host,
  secretId,
  value,
  onChange,
  label = "GITLAB REPOSITORY",
  required = false,
}: GitlabRepositorySelectProps) {
  const [repositories, setRepositories] = useState<Repository[]>([])
  const [selectedRepository, setSelectedRepository] = useState<Repository | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState("")
  const [showDropdown, setShowDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const inputContainerRef = useRef<HTMLDivElement>(null)
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
          perPage: 50
        }
      }) as Repository[]

      setRepositories(data)

      // If value is provided and no search, find and select that repository
      if (value && !searchQuery) {
        const repo = data.find((r) => r.id === value)
        if (repo) {
          setSelectedRepository(repo)
          setSearch(repo.path_with_namespace)
        }
      }
    } catch (err) {
      setError(`Error loading repositories: ${err instanceof Error ? err.message : "Unknown error"}`)
      setRepositories([])
    } finally {
      setLoading(false)
    }
  }, [secretId, host, value, client])

  // Debounced search
  useEffect(() => {
    // Clear previous timeout
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current)
    }

    // Don't search if the search matches the selected repository
    if (selectedRepository && search === selectedRepository.path_with_namespace) {
      return
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
  }, [search, selectedRepository, loadRepositories])

  const handleSelectRepository = (repository: Repository) => {
    setSelectedRepository(repository)
    setSearch(repository.path_with_namespace)
    setShowDropdown(false)
    onChange(repository.id, repository)
  }

  const handleClear = () => {
    setSelectedRepository(null)
    setSearch("")
    onChange(null, null)
  }

  const updateDropdownPosition = () => {
    if (inputContainerRef.current) {
      const rect = inputContainerRef.current.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      setDropdownPosition({
        top: rect.bottom + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width
      })
    }
  }

  const handleFocus = () => {
    updateDropdownPosition()
    setShowDropdown(true)
  }

  // Note: Server-side filtering is now handled by the API
  // This is just for display purposes
  const filteredRepositories = repositories

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>

      {error && (
        <div className="bg-red-500/10 text-red-300 px-4 py-3 border border-red-500/30 backdrop-blur-sm text-sm">
          {error}
        </div>
      )}

      {!secretId || !host ? (
        <div className="bg-yellow-500/10 text-yellow-300 px-4 py-3 border border-yellow-500/30 backdrop-blur-sm text-sm">
          Please provide GitLab host and select a valid access token first
        </div>
      ) : (
        <>
          <div className="text-xs text-gray-400 mb-2">
            Type at least 3 characters to search GitLab repositories by name or path
          </div>
        <div ref={inputContainerRef} className="relative">
          <Input
            type="text"
            value={search}
            onChange={(e) => {
              setSearch(e.target.value)
              updateDropdownPosition()
              setShowDropdown(true)
              if (!e.target.value) {
                handleClear()
              }
            }}
            onFocus={handleFocus}
            onBlur={() => setTimeout(() => setShowDropdown(false), 200)}
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

          {/* Dropdown */}
          {showDropdown && !loading && (
            <Portal>
              <div
                className="absolute bg-slate-800 border border-slate-700 shadow-lg max-h-80 overflow-auto rounded"
                style={{
                  top: `${dropdownPosition.top}px`,
                  left: `${dropdownPosition.left}px`,
                  width: `${dropdownPosition.width}px`,
                  zIndex: 9999
                }}
              >
              {!search.trim() ? (
                <div className="px-4 py-3 text-sm text-gray-400">
                  Start typing to search repositories...
                </div>
              ) : search.trim().length < 3 ? (
                <div className="px-4 py-3 text-sm text-yellow-400">
                  Type at least 3 characters to search
                </div>
              ) : loading ? (
                <div className="px-4 py-3 text-sm text-gray-400 flex items-center gap-2">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Searching...
                </div>
              ) : filteredRepositories.length > 0 ? (
                filteredRepositories.map((repo) => (
                  <button
                    key={repo.id}
                    type="button"
                    onClick={() => handleSelectRepository(repo)}
                    className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700 last:border-b-0"
                  >
                    <div className="flex items-center gap-2">
                      <GitBranch className="w-4 h-4 text-gray-400 flex-shrink-0" />
                      <div className="flex-1 min-w-0">
                        <div className="font-medium text-sm text-gray-100 truncate">{repo.path_with_namespace}</div>
                        {repo.description && (
                          <div className="text-xs text-gray-400 mt-1 truncate">{repo.description}</div>
                        )}
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <div className="px-4 py-3 text-sm text-gray-400">
                  {repositories.length === 0 ? "No repositories found" : "Nothing found"}
                </div>
              )}
              </div>
            </Portal>
          )}
        </div>
        </>
      )}

      {/* Selected Repository Display */}
      {selectedRepository && (
        <div className="bg-slate-800/50 p-3 border border-green-500/40 rounded flex items-start gap-2">
          <GitBranch className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <div className="text-xs uppercase tracking-wide text-green-400 font-medium">
              SELECTED REPOSITORY
            </div>
            <div className="text-sm font-medium text-gray-100 truncate">{selectedRepository.path_with_namespace}</div>
            {selectedRepository.description && (
              <div className="text-xs text-gray-400 truncate">{selectedRepository.description}</div>
            )}
            <div className="text-xs text-gray-500 mt-1">ID: {selectedRepository.id}</div>
          </div>
        </div>
      )}
    </div>
  )
}
