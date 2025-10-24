import { useState, useEffect } from "react"
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { CheckCircle2, XCircle, Loader2, Plus, AlertCircle, Search } from "lucide-react"

export type Secret = {
  id: string
  project_id: string
  name: string
  value: string
  created_at: string
  updated_at: string
}

export type ApiClient = {
  secrets: {
    $get: () => Promise<Response>
    "by-project": {
      [key: string]: {
        $get: (params: any) => Promise<Response>
      }
    }
    $post: (data: any) => Promise<Response>
  }
}

type GitlabSecretAutocompleteProps = {
  client: ApiClient
  projectId?: string
  host: string
  value?: string | null
  onChange: (secretId: string | null, secret?: Secret | null) => void
  onSecretCreated?: (secret: Secret) => void
  label?: string
  required?: boolean
  requiredScopes?: string[]
}

export function GitlabSecretAutocomplete({
  client,
  projectId,
  host,
  value,
  onChange,
  onSecretCreated,
  label = "GITLAB ACCESS TOKEN SECRET",
  required = false,
  requiredScopes = ["api"],
}: GitlabSecretAutocompleteProps) {

  const [mode, setMode] = useState<"select" | "create" | "confirm">("select")
  const [existingSecrets, setExistingSecrets] = useState<Secret[]>([])
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete for existing secrets
  const [secretSearch, setSecretSearch] = useState("")
  const [showSecretDropdown, setShowSecretDropdown] = useState(false)

  // Create form state
  const [newToken, setNewToken] = useState("")
  const [secretName, setSecretName] = useState("")
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenScopes, setTokenScopes] = useState<string[]>([])
  const [scopesValid, setScopesValid] = useState<boolean | null>(null)
  const [tokenInfo, setTokenInfo] = useState<{ name: string; expiresAt: string | null } | null>(null)

  // Selected secret validation state
  const [selectedSecretValidating, setSelectedSecretValidating] = useState(false)
  const [selectedSecretValid, setSelectedSecretValid] = useState<boolean | null>(null)
  const [selectedSecretScopes, setSelectedSecretScopes] = useState<string[]>([])
  const [selectedSecretScopesValid, setSelectedSecretScopesValid] = useState<boolean | null>(null)
  const [selectedSecretInfo, setSelectedSecretInfo] = useState<{ name: string; expiresAt: string | null } | null>(null)

  // Load existing secrets
  useEffect(() => {
    const loadSecrets = async () => {
      try {
        let res
        if (projectId) {
          // Load secrets for specific project
          res = await client.secrets["by-project"][":projectId"].$get({
            param: { projectId },
          })
        } else {
          // Load all user secrets
          res = await client.secrets.$get()
        }

        if (res.ok) {
          const secrets = await res.json()
          setExistingSecrets(secrets)

          // If value is provided, find and select that secret
          if (value) {
            const secret = secrets.find((s: Secret) => s.id === value)
            if (secret) {
              setSelectedSecret(secret)
            }
          }

          // If no secrets exist, go to create mode
          if (secrets.length === 0) {
            setMode("create")
          }
        }
      } catch (err) {
        console.error("Failed to load secrets:", err)
      }
    }

    loadSecrets()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId])

  // Validate token with GitLab API
  const validateToken = async (token: string) => {
    if (!token.trim()) {
      setTokenValid(null)
      setScopesValid(null)
      setTokenScopes([])
      setTokenInfo(null)
      return
    }

    setTokenValidating(true)
    setError(null)

    try {
      // Get token information including scopes from GitLab's self endpoint
      const tokenResponse = await fetch(`${host}/api/v4/personal_access_tokens/self`, {
        headers: {
          "PRIVATE-TOKEN": token,
        },
      })

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        setTokenValid(true)

        // Extract scopes from token data
        const scopes = tokenData.scopes || []
        setTokenScopes(scopes)

        // Store token info
        setTokenInfo({
          name: tokenData.name,
          expiresAt: tokenData.expires_at,
        })

        // Validate required scopes
        const hasAllScopes = requiredScopes.every(reqScope =>
          scopes.includes(reqScope) || scopes.includes("api") || scopes.includes("sudo")
        )
        setScopesValid(hasAllScopes)

        // Get user info for username and better success message
        const userResponse = await fetch(`${host}/api/v4/user`, {
          headers: {
            "PRIVATE-TOKEN": token,
          },
        })

        let username = "user"
        if (userResponse.ok) {
          const userData = await userResponse.json()
          username = userData.username || userData.name || "user"
        }

        if (!hasAllScopes) {
          const missingScopes = requiredScopes.filter(rs => !scopes.includes(rs) && !scopes.includes("api") && !scopes.includes("sudo"))
          setError(`Token is missing required scopes: ${missingScopes.join(", ")}. Current scopes: ${scopes.join(", ")}`)
        }

        // Auto-generate secret name if not set (include username)
        if (!secretName) {
          setSecretName(`GitLab Token [${username}]`)
        }
      } else {
        setTokenValid(false)
        setScopesValid(false)
      }
    } catch (err) {
      setTokenValid(false)
      setScopesValid(false)
      setError(`Failed to validate token: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setTokenValidating(false)
    }
  }

  // Validate selected secret with GitLab API
  const validateSelectedSecret = async (secret: Secret) => {
    setSelectedSecretValidating(true)
    setError(null)

    try {
      // Fetch the secret value
      const secretRes = await (client.secrets as any)[":id"].$get({
        param: { id: secret.id },
      })

      if (!secretRes.ok) {
        setSelectedSecretValid(false)
        setSelectedSecretScopesValid(false)
        setError("Failed to fetch secret value")
        return
      }

      const secretData = await secretRes.json()
      const token = secretData.value

      // Validate token with GitLab
      const tokenResponse = await fetch(`${host}/api/v4/personal_access_tokens/self`, {
        headers: {
          "PRIVATE-TOKEN": token,
        },
      })

      if (tokenResponse.ok) {
        const tokenData = await tokenResponse.json()
        setSelectedSecretValid(true)

        // Extract scopes
        const scopes = tokenData.scopes || []
        setSelectedSecretScopes(scopes)

        // Store token info
        setSelectedSecretInfo({
          name: tokenData.name,
          expiresAt: tokenData.expires_at,
        })

        // Validate required scopes
        const hasAllScopes = requiredScopes.every(reqScope =>
          scopes.includes(reqScope) || scopes.includes("api") || scopes.includes("sudo")
        )
        setSelectedSecretScopesValid(hasAllScopes)

        if (!hasAllScopes) {
          const missingScopes = requiredScopes.filter(rs => !scopes.includes(rs) && !scopes.includes("api") && !scopes.includes("sudo"))
          setError(`Token is missing required scopes: ${missingScopes.join(", ")}. Current scopes: ${scopes.join(", ")}`)
        }
      } else {
        setSelectedSecretValid(false)
        setSelectedSecretScopesValid(false)
        setError("Token validation failed. The token may be invalid or expired.")
      }
    } catch (err) {
      setSelectedSecretValid(false)
      setSelectedSecretScopesValid(false)
      setError(`Failed to validate secret: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setSelectedSecretValidating(false)
    }
  }

  // Auto-validate token when it changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newToken && mode === "create") {
        validateToken(newToken)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newToken, mode])

  // Re-validate token when host changes
  useEffect(() => {
    if (mode === "create") {
      if (newToken && tokenValid !== null) {
        // Reset validation state and re-validate
        setTokenValid(null)
        setScopesValid(null)
        setTokenScopes([])
        setTokenInfo(null)
        setError(null)
        validateToken(newToken)
      }
    } else {
      // Clear validation state when not in create mode
      setTokenValid(null)
      setScopesValid(null)
      setTokenScopes([])
      setTokenInfo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  // Clear validation state when switching away from create mode
  useEffect(() => {
    if (mode !== "create") {
      setTokenValid(null)
      setScopesValid(null)
      setTokenScopes([])
      setTokenInfo(null)
      setTokenValidating(false)
      setError(null)
    }
  }, [mode])

  // Validate selected secret when it's selected or host changes (with debounce)
  useEffect(() => {
    if (!selectedSecret || mode !== "select") return

    const timeoutId = setTimeout(() => {
      validateSelectedSecret(selectedSecret)
    }, 500)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedSecret, host, mode])

  // Clear selected secret validation when deselected
  useEffect(() => {
    if (!selectedSecret) {
      setSelectedSecretValid(null)
      setSelectedSecretScopesValid(null)
      setSelectedSecretScopes([])
      setSelectedSecretInfo(null)
      setSelectedSecretValidating(false)
    }
  }, [selectedSecret])

  const handleCreateSecret = async () => {
    if (!projectId) {
      setError("Project ID is required to create a secret")
      return
    }

    if (!newToken.trim() || !secretName.trim()) {
      setError("Token and secret name are required")
      return
    }

    if (!tokenValid || !scopesValid) {
      setError("Please provide a valid token with the required scopes")
      return
    }

    setLoading(true)
    setError(null)

    try {
      const res = await client.secrets.$post({
        json: {
          project_id: projectId,
          name: secretName,
          value: newToken,
          description: `GitLab access token for ${host}`,
        },
      })

      if (!res.ok) {
        const errorText = await res.text()
        setError(`Failed to create secret: ${errorText}`)
        setLoading(false)
        return
      }

      const secret = await res.json()
      setSelectedSecret(secret)
      setExistingSecrets((prev) => [...prev, secret])
      onChange(secret.id, secret)
      onSecretCreated?.(secret)
      setNewToken("")
      setSecretName("")
      setTokenValid(null)
      setMode("select")
    } catch (err) {
      setError("Error creating secret")
      console.error(err)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectSecret = (secret: Secret) => {
    setSelectedSecret(secret)
    setSecretSearch(secret.name)
    setShowSecretDropdown(false)
    onChange(secret.id, secret)
  }

  // Filter secrets based on search
  const filteredSecrets = existingSecrets.filter((secret) =>
    secret.name.toLowerCase().includes(secretSearch.toLowerCase()) ||
    (secret as any).description?.toLowerCase().includes(secretSearch.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wide">
        {label}
        {required && <span className="text-red-500 ml-1">*</span>}
      </Label>

      {error && mode !== "select" && (
        <div className="bg-red-50/90 text-red-600 px-4 py-3 border border-red-200/60 backdrop-blur-sm text-sm flex items-center gap-2">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Select Mode */}
      {mode === "select" && (
        <div className="space-y-3">
          {selectedSecret ? (
            <div className={`bg-white/90 p-4 border ${
              selectedSecretValidating
                ? "border-gray-200/60"
                : selectedSecretValid === true && selectedSecretScopesValid === true
                ? "border-green-200/60"
                : selectedSecretValid === false || selectedSecretScopesValid === false
                ? "border-red-200/60"
                : "border-gray-200/60"
            } space-y-3`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative group mt-1">
                    {selectedSecretValidating && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                    {!selectedSecretValidating && selectedSecretValid === true && selectedSecretScopesValid === true && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-600" />
                        {/* Tooltip */}
                        {selectedSecretInfo && (
                          <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                            <div className="space-y-1">
                              <div className="font-semibold border-b border-gray-700 pb-1 mb-2">Token Information</div>
                              <div><span className="text-gray-400">Name:</span> {selectedSecretInfo.name}</div>
                              <div><span className="text-gray-400">Scopes:</span> {selectedSecretScopes.join(", ")}</div>
                              {selectedSecretInfo.expiresAt && (
                                <div><span className="text-gray-400">Expires:</span> {new Date(selectedSecretInfo.expiresAt).toLocaleDateString()}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!selectedSecretValidating && selectedSecretValid === true && selectedSecretScopesValid === false && (
                      <AlertCircle className="w-5 h-5 text-yellow-600" />
                    )}
                    {!selectedSecretValidating && selectedSecretValid === false && (
                      <XCircle className="w-5 h-5 text-red-600" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs uppercase tracking-wide font-medium ${
                      selectedSecretValidating
                        ? "text-gray-500"
                        : selectedSecretValid === true && selectedSecretScopesValid === true
                        ? "text-green-600"
                        : selectedSecretValid === false || selectedSecretScopesValid === false
                        ? "text-red-600"
                        : "text-gray-500"
                    }`}>
                      {selectedSecretValidating ? "VALIDATING SECRET..." : "SELECTED SECRET"}
                    </div>
                    <div className="text-sm font-medium mt-1">{selectedSecret.name}</div>
                    {(selectedSecret as any).description && (
                      <div className="text-xs text-gray-500 mt-0.5">{(selectedSecret as any).description}</div>
                    )}
                    {selectedSecretValid === true && selectedSecretScopesValid === false && (
                      <div className="text-xs text-yellow-600 mt-2">
                        Missing required scopes
                      </div>
                    )}
                    {selectedSecretValid === false && (
                      <div className="text-xs text-red-600 mt-2">
                        Token validation failed
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    setSelectedSecret(null)
                    setSecretSearch("")
                    onChange(null, null)
                  }}
                  variant="outline"
                  size="sm"
                  className="text-xs uppercase tracking-wide ml-2"
                >
                  CHANGE
                </Button>
              </div>
            </div>
          ) : (
            <>
              {existingSecrets.length > 0 && (
                <div className="relative">
                    <Input
                      type="text"
                      value={secretSearch}
                      onChange={(e) => {
                        setSecretSearch(e.target.value)
                        setShowSecretDropdown(true)
                      }}
                      onFocus={() => setShowSecretDropdown(true)}
                      onBlur={() => setTimeout(() => setShowSecretDropdown(false), 200)}
                      className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                      placeholder="Search existing secrets..."
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showSecretDropdown && (
                      <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200/60 shadow-lg max-h-60 overflow-auto">
                        {filteredSecrets.length > 0 ? (
                          filteredSecrets.map((secret) => (
                            <button
                              key={secret.id}
                              type="button"
                              onClick={() => handleSelectSecret(secret)}
                              className="w-full px-4 py-3 text-left hover:bg-blue-50/50 transition-colors border-b border-gray-100 last:border-b-0"
                            >
                              <div className="font-medium text-sm">{secret.name}</div>
                              {(secret as any).description && (
                                <div className="text-xs text-gray-500 mt-1">{(secret as any).description}</div>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-500">
                            Nothing found
                          </div>
                        )}
                      </div>
                    )}
                </div>
              )}

              <Button
                type="button"
                onClick={() => setMode("create")}
                variant="outline"
                className="w-full uppercase tracking-wide"
                disabled={!projectId}
                title={!projectId ? "Project ID required to create new secrets" : ""}
              >
                <Plus className="w-4 h-4 mr-2" />
                CREATE NEW SECRET {!projectId && "(Requires Project)"}
              </Button>
            </>
          )}
        </div>
      )}

      {/* Create Mode */}
      {mode === "create" && (
        <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
          <div className="space-y-2">
            <Label htmlFor="gitlab_token" className="text-xs uppercase tracking-wide">
              GITLAB ACCESS TOKEN
            </Label>
            <div className="relative group">
              <Input
                id="gitlab_token"
                type="password"
                value={newToken}
                onChange={(e) => {
                  setNewToken(e.target.value)
                  setTokenValid(null)
                  setError(null)
                }}
                className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500 pr-10"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {tokenValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!tokenValidating && tokenValid === true && scopesValid === true && (
                  <div className="relative cursor-help">
                    <CheckCircle2 className="w-4 h-4 text-green-600" />
                    {/* Tooltip */}
                    {tokenInfo && (
                      <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                        <div className="space-y-1">
                          <div className="font-semibold border-b border-gray-700 pb-1 mb-2">Token Information</div>
                          <div><span className="text-gray-400">Name:</span> {tokenInfo.name}</div>
                          <div><span className="text-gray-400">Scopes:</span> {tokenScopes.join(", ")}</div>
                          {tokenInfo.expiresAt && (
                            <div><span className="text-gray-400">Expires:</span> {new Date(tokenInfo.expiresAt).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!tokenValidating && tokenValid === true && scopesValid === false && (
                  <AlertCircle className="w-4 h-4 text-yellow-600" />
                )}
                {!tokenValidating && tokenValid === false && (
                  <XCircle className="w-4 h-4 text-red-600" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-500">
              <a
                href={`${host}/-/user_settings/personal_access_tokens?name=${encodeURIComponent("ADI Simple Access Token")}&scopes=${requiredScopes.join(",")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-500 hover:underline font-medium"
              >
                Create a new GitLab token
              </a>{" "}
              with scopes: {requiredScopes.map(s => <code key={s} className="bg-gray-100 px-1 mx-0.5">{s}</code>)}
            </p>
          </div>

          {/* Secret Name - Only show when token is valid */}
          {tokenValid === true && scopesValid === true && (
            <div className="space-y-2">
              <Label htmlFor="secret_name" className="text-xs uppercase tracking-wide">
                SECRET NAME
              </Label>
              <Input
                id="secret_name"
                type="text"
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                className="bg-white/90 backdrop-blur-sm border-gray-300 focus:border-blue-500 focus:ring-blue-500"
                placeholder="GitLab Token [username]"
              />
            </div>
          )}

          {tokenValid === false && (
            <div className="bg-yellow-50/90 text-yellow-800 px-4 py-3 border border-yellow-200/60 backdrop-blur-sm text-sm flex items-start gap-2">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Token Validation Failed</div>
                <div className="text-xs mt-1">
                  Make sure the token has the correct permissions and is for {host}
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            {existingSecrets.length > 0 && (
              <Button
                type="button"
                onClick={() => {
                  setMode("select")
                  setNewToken("")
                  setSecretName("")
                  setTokenValid(null)
                  setError(null)
                }}
                variant="outline"
                className="flex-1 uppercase tracking-wide"
              >
                CANCEL
              </Button>
            )}
            <Button
              type="button"
              onClick={() => setMode("confirm")}
              disabled={!newToken.trim() || !secretName.trim() || tokenValid !== true || scopesValid !== true}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Mode */}
      {mode === "confirm" && (
        <div className="space-y-4 p-4 border border-gray-200/60 bg-gray-50/50 backdrop-blur-sm">
          <div className="bg-white/90 p-4 border border-gray-200/60 space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">SECRET NAME</div>
              <div className="font-medium">{secretName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">GITLAB HOST</div>
              <div className="font-medium">{host}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-500">TOKEN</div>
              <div className="font-mono text-sm">•••••••••••••••••••</div>
            </div>
            <div className="flex items-center gap-2 text-green-600">
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-xs uppercase tracking-wide font-medium">TOKEN VALIDATED</div>
            </div>
          </div>

          <p className="text-sm text-gray-600">
            This will create a secret in your project for GitLab authentication.
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => setMode("create")}
              variant="outline"
              className="flex-1 uppercase tracking-wide"
            >
              BACK
            </Button>
            <Button
              type="button"
              onClick={handleCreateSecret}
              disabled={loading}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  CREATING...
                </>
              ) : (
                "CONFIRM & CREATE"
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  )
}
