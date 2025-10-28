import { useState, useEffect, useRef } from "react"
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Portal } from './portal'
import { CheckCircle2, XCircle, Loader2, Plus, AlertCircle, Search } from "lucide-react"
import { JiraOAuthButton, type OAuthResult } from './jira-oauth-button'
import { JiraSiteSelector } from './jira-site-selector'

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

type JiraSecretAutocompleteProps = {
  client: ApiClient
  projectId?: string
  host: string
  value?: string | null
  onChange: (secretId: string | null, secret?: Secret | null) => void
  onSecretCreated?: (secret: Secret) => void
  onCloudIdChange?: (cloudId: string) => void
  label?: string
  required?: boolean
  apiBaseUrl?: string
  enableOAuth?: boolean
}

export function JiraSecretAutocomplete({
  client,
  projectId,
  host,
  value,
  onChange,
  onSecretCreated,
  onCloudIdChange,
  label = "JIRA API TOKEN SECRET",
  required = false,
  apiBaseUrl = '',
  enableOAuth = true,
}: JiraSecretAutocompleteProps) {

  const [mode, setMode] = useState<"select" | "create" | "oauth" | "confirm">("select")
  const [existingSecrets, setExistingSecrets] = useState<Secret[]>([])
  const [selectedSecret, setSelectedSecret] = useState<Secret | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Autocomplete for existing secrets
  const [secretSearch, setSecretSearch] = useState("")
  const [showSecretDropdown, setShowSecretDropdown] = useState(false)
  const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0, width: 0 })
  const secretInputRef = useRef<HTMLDivElement>(null)

  // Create form state
  const [email, setEmail] = useState("")
  const [newToken, setNewToken] = useState("")
  const [secretName, setSecretName] = useState("")
  const [tokenValidating, setTokenValidating] = useState(false)
  const [tokenValid, setTokenValid] = useState<boolean | null>(null)
  const [tokenInfo, setTokenInfo] = useState<{ username: string; email: string | null } | null>(null)

  // Selected secret validation state
  const [selectedSecretValidating, setSelectedSecretValidating] = useState(false)
  const [selectedSecretValid, setSelectedSecretValid] = useState<boolean | null>(null)
  const [selectedSecretInfo, setSelectedSecretInfo] = useState<{ username: string; email: string | null } | null>(null)

  // OAuth state
  const [oauthResult, setOAuthResult] = useState<OAuthResult | null>(null)
  const [selectedCloudId, setSelectedCloudId] = useState<string | null>(null)

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

  // Validate token with backend API
  const validateToken = async (token: string, userEmail: string) => {
    if (!token.trim()) {
      setTokenValid(null)
      setTokenInfo(null)
      return
    }

    setTokenValidating(true)
    setError(null)

    try {
      // Validate token using backend endpoint
      const response = await (client.secrets as any)['validate-jira-raw-token'].$post({
        json: {
          token,
          email: userEmail || undefined,
          hostname: host,
        }
      })

      if (response.ok) {
        const result = await response.json()
        setTokenValid(true)

        // Store token info
        setTokenInfo({
          username: result.username || 'Unknown User',
          email: result.email || null,
        })

        // Auto-generate secret name if not set
        if (!secretName) {
          setSecretName(`Jira Token [${result.username}]`)
        }
      } else {
        const errorData = await response.json()
        setTokenValid(false)
        setError(errorData.error || 'Token validation failed')
      }
    } catch (err) {
      setTokenValid(false)
      setError(`Failed to validate token: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setTokenValidating(false)
    }
  }

  // Validate selected secret with backend API
  const validateSelectedSecret = async (secret: Secret) => {
    setSelectedSecretValidating(true)
    setError(null)

    try {
      // Validate secret using backend endpoint
      const response = await (client.secrets as any)['validate-jira-token'].$post({
        json: {
          secretId: secret.id,
          hostname: host,
        }
      })

      if (response.ok) {
        const result = await response.json()
        setSelectedSecretValid(true)

        // Store token info
        setSelectedSecretInfo({
          username: result.username || 'Unknown User',
          email: result.email || null,
        })
      } else {
        const errorData = await response.json()
        setSelectedSecretValid(false)
        setError(errorData.error || 'Token validation failed. The token may be invalid or expired.')
      }
    } catch (err) {
      setSelectedSecretValid(false)
      setError(`Failed to validate secret: ${err instanceof Error ? err.message : "Unknown error"}`)
    } finally {
      setSelectedSecretValidating(false)
    }
  }

  // Auto-validate token when it changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (newToken && mode === "create") {
        validateToken(newToken, email)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [newToken, email, mode])

  // Re-validate token when host changes
  useEffect(() => {
    if (mode === "create") {
      if (newToken && tokenValid !== null) {
        // Reset validation state and re-validate
        setTokenValid(null)
        setTokenInfo(null)
        setError(null)
        validateToken(newToken, email)
      }
    } else {
      // Clear validation state when not in create mode
      setTokenValid(null)
      setTokenInfo(null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [host])

  // Clear validation state when switching away from create mode
  useEffect(() => {
    if (mode !== "create") {
      setTokenValid(null)
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

    setLoading(true)
    setError(null)

    try {
      // Store token in email:token format if email is provided
      const tokenValue = email ? `${email}:${newToken}` : newToken

      const res = await client.secrets.$post({
        json: {
          project_id: projectId,
          name: secretName,
          value: tokenValue,
          description: `Jira API token for ${host}`,
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
      setEmail("")
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

  const updateDropdownPosition = () => {
    if (secretInputRef.current) {
      const rect = secretInputRef.current.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      setDropdownPosition({
        top: rect.bottom + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width
      })
    }
  }

  const handleSecretInputFocus = () => {
    updateDropdownPosition()
    setShowSecretDropdown(true)
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
      <Label className="text-xs uppercase tracking-wide text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>

      {error && mode !== "select" && (
        <div className="bg-red-500/10 text-red-300 px-4 py-3 border border-red-500/30 backdrop-blur-sm text-sm flex items-center gap-2 rounded">
          <XCircle className="w-4 h-4" />
          {error}
        </div>
      )}

      {/* Select Mode */}
      {mode === "select" && (
        <div className="space-y-3">
          {selectedSecret ? (
            <div className={`bg-slate-800/50 p-4 border rounded ${
              selectedSecretValidating
                ? "border-slate-600"
                : selectedSecretValid === true
                ? "border-green-500/40"
                : selectedSecretValid === false
                ? "border-red-500/40"
                : "border-slate-600"
            } space-y-3`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative group mt-1">
                    {selectedSecretValidating && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                    {!selectedSecretValidating && selectedSecretValid === true && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        {/* Tooltip */}
                        {selectedSecretInfo && (
                          <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                            <div className="space-y-1">
                              <div className="font-semibold border-b border-slate-700 pb-1 mb-2">Token Information</div>
                              <div><span className="text-gray-400">User:</span> {selectedSecretInfo.username}</div>
                              {selectedSecretInfo.email && (
                                <div><span className="text-gray-400">Email:</span> {selectedSecretInfo.email}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!selectedSecretValidating && selectedSecretValid === false && (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs uppercase tracking-wide font-medium ${
                      selectedSecretValidating
                        ? "text-gray-400"
                        : selectedSecretValid === true
                        ? "text-green-400"
                        : selectedSecretValid === false
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}>
                      {selectedSecretValidating ? "VALIDATING SECRET..." : "SELECTED SECRET"}
                    </div>
                    <div className="text-sm font-medium mt-1 text-gray-100">{selectedSecret.name}</div>
                    {(selectedSecret as any).description && (
                      <div className="text-xs text-gray-400 mt-0.5">{(selectedSecret as any).description}</div>
                    )}
                    {selectedSecretValid === false && (
                      <div className="text-xs text-red-400 mt-2">
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
                <div ref={secretInputRef} className="relative">
                    <Input
                      type="text"
                      value={secretSearch}
                      onChange={(e) => {
                        setSecretSearch(e.target.value)
                        updateDropdownPosition()
                        setShowSecretDropdown(true)
                      }}
                      onFocus={handleSecretInputFocus}
                      onBlur={() => setTimeout(() => setShowSecretDropdown(false), 200)}
                      className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
                      placeholder="Search existing secrets..."
                    />
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {showSecretDropdown && (
                      <Portal>
                        <div
                          className="absolute bg-slate-800 border border-slate-700 shadow-lg max-h-60 overflow-auto rounded"
                          style={{
                            top: `${dropdownPosition.top}px`,
                            left: `${dropdownPosition.left}px`,
                            width: `${dropdownPosition.width}px`,
                            zIndex: 9999
                          }}
                        >
                        {filteredSecrets.length > 0 ? (
                          filteredSecrets.map((secret) => (
                            <button
                              key={secret.id}
                              type="button"
                              onClick={() => handleSelectSecret(secret)}
                              className="w-full px-4 py-3 text-left hover:bg-slate-700/50 transition-colors border-b border-slate-700 last:border-b-0"
                            >
                              <div className="font-medium text-sm text-gray-100">{secret.name}</div>
                              {(secret as any).description && (
                                <div className="text-xs text-gray-400 mt-1">{(secret as any).description}</div>
                              )}
                            </button>
                          ))
                        ) : (
                          <div className="px-4 py-3 text-sm text-gray-400">
                            Nothing found
                          </div>
                        )}
                        </div>
                      </Portal>
                    )}
                </div>
              )}

              {enableOAuth ? (
                <div className="space-y-2">
                  <Button
                    type="button"
                    onClick={() => {
                      setAuthMethod("api_token")
                      setMode("create")
                    }}
                    variant="outline"
                    className="w-full uppercase tracking-wide"
                    disabled={!projectId}
                    title={!projectId ? "Project ID required to create new secrets" : ""}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    CREATE WITH API TOKEN
                  </Button>
                  <Button
                    type="button"
                    onClick={() => {
                      setAuthMethod("oauth")
                      setMode("oauth")
                    }}
                    variant="default"
                    className="w-full uppercase tracking-wide"
                    disabled={!projectId}
                    title={!projectId ? "Project ID required for OAuth" : ""}
                  >
                    <Plus className="w-4 h-4 mr-2" />
                    CONNECT WITH OAUTH
                  </Button>
                </div>
              ) : (
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
              )}
            </>
          )}
        </div>
      )}

      {/* Create Mode */}
      {mode === "create" && (
        <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
          <div className="space-y-2">
            <Label htmlFor="jira_email" className="text-xs uppercase tracking-wide text-gray-300">
              EMAIL (OPTIONAL)
            </Label>
            <Input
              id="jira_email"
              type="email"
              value={email}
              onChange={(e) => {
                setEmail(e.target.value)
                setTokenValid(null)
                setError(null)
              }}
              className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100"
              placeholder="your-email@example.com"
            />
            <p className="text-xs text-gray-400">
              Your Jira account email (required for Jira Cloud Basic Auth)
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="jira_token" className="text-xs uppercase tracking-wide text-gray-300">
              JIRA API TOKEN
            </Label>
            <div className="relative group">
              <Input
                id="jira_token"
                type="password"
                value={newToken}
                onChange={(e) => {
                  setNewToken(e.target.value)
                  setTokenValid(null)
                  setError(null)
                }}
                className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
                placeholder="Your Jira API token"
              />
              <div className="absolute right-3 top-1/2 -translate-y-1/2">
                {tokenValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!tokenValidating && tokenValid === true && (
                  <div className="relative cursor-help">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    {/* Tooltip */}
                    {tokenInfo && (
                      <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-slate-900 border border-slate-700 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                        <div className="space-y-1">
                          <div className="font-semibold border-b border-slate-700 pb-1 mb-2">Token Information</div>
                          <div><span className="text-gray-400">User:</span> {tokenInfo.username}</div>
                          {tokenInfo.email && (
                            <div><span className="text-gray-400">Email:</span> {tokenInfo.email}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!tokenValidating && tokenValid === false && (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              <a
                href="https://id.atlassian.com/manage-profile/security/api-tokens"
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
              >
                Create a new Jira API token
              </a>{" "}
              in your Atlassian account settings
            </p>
          </div>

          {/* Secret Name - Only show when token is valid */}
          {tokenValid === true && (
            <div className="space-y-2">
              <Label htmlFor="secret_name" className="text-xs uppercase tracking-wide text-gray-300">
                SECRET NAME
              </Label>
              <Input
                id="secret_name"
                type="text"
                value={secretName}
                onChange={(e) => setSecretName(e.target.value)}
                className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100"
                placeholder="Jira Token [username]"
              />
            </div>
          )}

          {tokenValid === false && (
            <div className="bg-yellow-500/10 text-yellow-300 px-4 py-3 border border-yellow-500/30 backdrop-blur-sm text-sm flex items-start gap-2 rounded">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <div>
                <div className="font-medium">Token Validation Failed</div>
                <div className="text-xs mt-1">
                  Make sure the token is valid and has correct permissions for {host}
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
                  setEmail("")
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
              disabled={!newToken.trim() || !secretName.trim() || tokenValid !== true}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Mode */}
      {mode === "confirm" && (
        <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
          <div className="bg-slate-800/50 p-4 border border-slate-700 rounded space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">SECRET NAME</div>
              <div className="font-medium text-gray-100">{secretName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">JIRA HOST</div>
              <div className="font-medium text-gray-100">{host}</div>
            </div>
            {email && (
              <div>
                <div className="text-xs uppercase tracking-wide text-gray-400">EMAIL</div>
                <div className="font-medium text-gray-100">{email}</div>
              </div>
            )}
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">TOKEN</div>
              <div className="font-mono text-sm text-gray-300">•••••••••••••••••••</div>
            </div>
            <div className="flex items-center gap-2 text-green-400">
              <CheckCircle2 className="w-4 h-4" />
              <div className="text-xs uppercase tracking-wide font-medium">TOKEN VALIDATED</div>
            </div>
          </div>

          <p className="text-sm text-gray-300">
            This will create a secret in your project for Jira authentication.
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

      {/* OAuth Mode */}
      {mode === "oauth" && projectId && (
        <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
          <div className="space-y-2">
            <Label className="text-xs uppercase tracking-wide text-gray-300">
              CONNECT JIRA WITH OAUTH
            </Label>
            <p className="text-sm text-gray-400">
              Authorize with Atlassian to securely connect your Jira account. This will automatically manage access tokens.
            </p>
          </div>

          {!oauthResult && (
            <JiraOAuthButton
              projectId={projectId}
              apiBaseUrl={apiBaseUrl}
              onSuccess={(result) => {
                setOAuthResult(result)
                // Auto-select first site if only one
                if (result.sites.length === 1) {
                  setSelectedCloudId(result.sites[0].id)
                  onCloudIdChange?.(result.sites[0].id)
                }
              }}
              onError={(error) => {
                setError(error)
              }}
            />
          )}

          {oauthResult && (
            <div className="space-y-4">
              <div className="bg-green-900/20 border border-green-600/30 rounded p-3">
                <div className="flex items-center gap-2 text-green-400 mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <div className="text-xs uppercase tracking-wide font-medium">OAUTH CONNECTED</div>
                </div>
                <div className="text-sm text-gray-300">
                  Successfully connected to Jira. Found {oauthResult.sites.length} site{oauthResult.sites.length !== 1 ? 's' : ''}.
                </div>
              </div>

              <JiraSiteSelector
                sites={oauthResult.sites}
                selectedCloudId={selectedCloudId || undefined}
                onSelect={(cloudId) => {
                  setSelectedCloudId(cloudId)
                  onCloudIdChange?.(cloudId)
                }}
              />
            </div>
          )}

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => {
                setMode("select")
                setOAuthResult(null)
                setSelectedCloudId(null)
                setSecretName("")
                setError(null)
              }}
              variant="outline"
              className="flex-1 uppercase tracking-wide"
            >
              CANCEL
            </Button>
            {oauthResult && (
              <Button
                type="button"
                onClick={() => {
                  // Notify parent that OAuth secret was created
                  onChange(oauthResult.secretId, null)
                  setMode("select")
                }}
                disabled={!selectedCloudId}
                className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
              >
                FINISH
              </Button>
            )}
          </div>

          {error && (
            <div className="bg-red-900/20 border border-red-600/30 rounded p-3 text-sm text-red-400">
              {error}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
