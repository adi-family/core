import { useMemo, useEffect, useRef } from "react"
import { proxy, useSnapshot } from "valtio"
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Portal } from './portal'
import { CheckCircle2, XCircle, Loader2, Plus, AlertCircle, Search } from "lucide-react"
import { GitLabOAuthButton } from './gitlab-oauth-button'
import type { BaseClient } from '@adi-family/http'
import {
  listSecretsConfig,
  getSecretsByProjectConfig,
  getSecretConfig,
  createSecretConfig,
  validateGitLabRawTokenConfig,
  validateGitLabTokenConfig
} from '@adi/api-contracts/secrets'
import type { Secret } from "@adi-simple/types"

interface GitlabSecretAutocompleteProps {
  client: BaseClient
  projectId?: string
  host: string
  value?: string | null
  onChange: (secretId: string | null, secret?: Secret | null) => void
  onSecretCreated?: (secret: Secret) => void
  label?: string
  required?: boolean
  requiredScopes?: string[]
  enableOAuth?: boolean
  apiBaseUrl?: string
}

interface StoreState {
  mode: "select" | "create" | "confirm"
  existingSecrets: Secret[]
  selectedSecret: Secret | null
  ui: {
    loading: boolean
    error: string | null
  }
  autocomplete: {
    search: string
    showDropdown: boolean
    dropdownPosition: { top: number; left: number; width: number }
  }
  createForm: {
    newToken: string
    secretName: string
    tokenValidating: boolean
    tokenValid: boolean | null
    tokenScopes: string[]
    scopesValid: boolean | null
    tokenInfo: { name: string; expiresAt: string | null } | null
  }
  selectedValidation: {
    validating: boolean
    valid: boolean | null
    scopes: string[]
    scopesValid: boolean | null
    info: { name: string; expiresAt: string | null } | null
  }
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
  enableOAuth = true,
}: GitlabSecretAutocompleteProps) {

  const store = useMemo(() => proxy<StoreState>({
    mode: "select",
    existingSecrets: [],
    selectedSecret: null,
    ui: {
      loading: false,
      error: null,
    },
    autocomplete: {
      search: "",
      showDropdown: false,
      dropdownPosition: { top: 0, left: 0, width: 0 },
    },
    createForm: {
      newToken: "",
      secretName: "",
      tokenValidating: false,
      tokenValid: null,
      tokenScopes: [],
      scopesValid: null,
      tokenInfo: null,
    },
    selectedValidation: {
      validating: false,
      valid: null,
      scopes: [],
      scopesValid: null,
      info: null,
    },
  }), [])

  const snap = useSnapshot(store)
  const secretInputRef = useRef<HTMLDivElement>(null)


  // Load existing secrets
  useEffect(() => {
    const loadSecrets = async () => {
      try {
        let secrets
        if (projectId) {
          // Load secrets for specific project
          secrets = await client.run(getSecretsByProjectConfig, {
            params: { projectId }
          }) as any
        } else {
          // Load all user secrets
          secrets = await client.run(listSecretsConfig) as any
        }

        store.existingSecrets = secrets

        // If value is provided, find and select that secret
        if (value) {
          const secret = secrets.find((s: Secret) => s.id === value)
          if (secret) {
            store.selectedSecret = secret
          }
        }

        // If no secrets exist, go to create mode
        if (secrets.length === 0) {
          store.mode = "create"
        }
      } catch (err) {
        console.error("Failed to load secrets:", err)
      }
    }

    loadSecrets()

  }, [projectId, store])

  // Validate token with backend API
  const validateToken = async (token: string) => {
    if (!token.trim()) {
      store.createForm.tokenValid = null
      store.createForm.scopesValid = null
      store.createForm.tokenScopes = []
      store.createForm.tokenInfo = null
      return
    }

    store.createForm.tokenValidating = true
    store.ui.error = null

    try {
      // Validate token using backend endpoint
      const result = await client.run(validateGitLabRawTokenConfig, {
        body: {
          token,
          hostname: host,
          scopes: requiredScopes
        }
      }) as any

      store.createForm.tokenValid = true

      // Extract scopes if available
      const scopes = result.scopes || []
      store.createForm.tokenScopes = scopes

      // Store token info
      store.createForm.tokenInfo = {
        name: result.tokenInfo?.name || `Token for ${result.username}`,
        expiresAt: result.tokenInfo?.expiresAt || null,
      }

      // Validate scopes
      if (result.scopeValidation) {
        store.createForm.tokenValid = result.scopeValidation.validated
        store.createForm.scopesValid = result.scopeValidation.validated

        if (!result.scopeValidation.validated) {
          store.ui.error = result.scopeValidation.message || 'Token is missing required scopes'
        }
      } else {
        // If no scope validation info, assume valid
        store.createForm.scopesValid = true
      }

      // Auto-generate secret name if not set (include username)
      if (!store.createForm.secretName) {
        store.createForm.secretName = `GitLab Token [${result.username}]`
      }
    } catch (err) {
      store.createForm.tokenValid = false
      store.createForm.scopesValid = false
      store.ui.error = `Failed to validate token: ${err instanceof Error ? err.message : "Unknown error"}`
    } finally {
      store.createForm.tokenValidating = false
    }
  }

  // Validate selected secret with backend API
  const validateSelectedSecret = async (secret: Secret) => {
    store.selectedValidation.validating = true
    store.ui.error = null

    try {
      // Validate secret using backend endpoint
      const result = await client.run(validateGitLabTokenConfig, {
        body: {
          secretId: secret.id,
          hostname: host,
          scopes: requiredScopes
        }
      }) as any

      store.selectedValidation.valid = true

      // Extract scopes if available
      const scopes = result.scopes || []
      store.selectedValidation.scopes = scopes

      // Store token info
      store.selectedValidation.info = {
        name: result.tokenInfo?.name || `Token for ${result.username}`,
        expiresAt: result.tokenInfo?.expiresAt || null,
      }

      // Validate scopes
      if (result.scopeValidation) {
        store.selectedValidation.valid = result.scopeValidation.validated
        store.selectedValidation.scopesValid = result.scopeValidation.validated

        if (!result.scopeValidation.validated) {
          store.ui.error = result.scopeValidation.message || 'Token is missing required scopes'
        }
      } else {
        // If no scope validation info, assume valid
        store.selectedValidation.scopesValid = true
      }
    } catch (err) {
      store.selectedValidation.valid = false
      store.selectedValidation.scopesValid = false
      store.ui.error = `Failed to validate secret: ${err instanceof Error ? err.message : "Unknown error"}`
    } finally {
      store.selectedValidation.validating = false
    }
  }

  // Auto-validate token when it changes (with debounce)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (snap.createForm.newToken && snap.mode === "create") {
        validateToken(snap.createForm.newToken)
      }
    }, 500)

    return () => clearTimeout(timeoutId)
  }, [snap.createForm.newToken, snap.mode])

  // Re-validate token when host changes
  useEffect(() => {
    if (snap.mode === "create") {
      if (snap.createForm.newToken && snap.createForm.tokenValid !== null) {
        store.createForm.tokenValid = null
        store.createForm.scopesValid = null
        store.createForm.tokenScopes = []
        store.createForm.tokenInfo = null
        store.ui.error = null
        validateToken(snap.createForm.newToken)
      }
    } else {
      store.createForm.tokenValid = null
      store.createForm.scopesValid = null
      store.createForm.tokenScopes = []
      store.createForm.tokenInfo = null
    }
  }, [host, snap.mode, snap.createForm.newToken, snap.createForm.tokenValid, store])

  // Clear validation state when switching away from create mode
  useEffect(() => {
    if (snap.mode !== "create") {
      store.createForm.tokenValid = null
      store.createForm.scopesValid = null
      store.createForm.tokenScopes = []
      store.createForm.tokenInfo = null
      store.createForm.tokenValidating = false
      store.ui.error = null
    }
  }, [snap.mode, store])

  useEffect(() => {
    const selectedSecret = snap.selectedSecret
    if (!selectedSecret || snap.mode !== "select") return

    const timeoutId = setTimeout(() => {
      validateSelectedSecret(selectedSecret)
    }, 500)

    return () => clearTimeout(timeoutId)

  }, [snap.selectedSecret, host, snap.mode])

  // Clear selected secret validation when deselected
  useEffect(() => {
    if (!snap.selectedSecret) {
      store.selectedValidation.valid = null
      store.selectedValidation.scopesValid = null
      store.selectedValidation.scopes = []
      store.selectedValidation.info = null
      store.selectedValidation.validating = false
    }
  }, [snap.selectedSecret, store])

  const handleCreateSecret = async () => {
    if (!projectId) {
      store.ui.error = "Project ID is required to create a secret"
      return
    }

    if (!snap.createForm.newToken.trim() || !snap.createForm.secretName.trim()) {
      store.ui.error = "Token and secret name are required"
      return
    }

    store.ui.loading = true
    store.ui.error = null

    try {
      const secret = await client.run(createSecretConfig, {
        body: {
          project_id: projectId,
          name: snap.createForm.secretName,
          value: snap.createForm.newToken,
          description: `GitLab access token for ${host}`,
        }
      }) as any

      store.selectedSecret = secret
      store.existingSecrets = [...store.existingSecrets, secret]
      onChange(secret.id, secret)
      onSecretCreated?.(secret)
      store.createForm.newToken = ""
      store.createForm.secretName = ""
      store.createForm.tokenValid = null
      store.mode = "select"
    } catch (err) {
      store.ui.error = `Failed to create secret: ${err instanceof Error ? err.message : "Unknown error"}`
      console.error(err)
    } finally {
      store.ui.loading = false
    }
  }

  const updateDropdownPosition = () => {
    if (secretInputRef.current) {
      const rect = secretInputRef.current.getBoundingClientRect()
      const scrollTop = window.pageYOffset || document.documentElement.scrollTop
      const scrollLeft = window.pageXOffset || document.documentElement.scrollLeft

      store.autocomplete.dropdownPosition = {
        top: rect.bottom + scrollTop,
        left: rect.left + scrollLeft,
        width: rect.width
      }
    }
  }

  const handleSecretInputFocus = () => {
    updateDropdownPosition()
    store.autocomplete.showDropdown = true
  }

  const handleSelectSecret = (secret: Secret) => {
    store.selectedSecret = secret
    store.autocomplete.search = secret.name
    store.autocomplete.showDropdown = false
    onChange(secret.id, secret)
  }

  // Filter secrets based on search
  const filteredSecrets = snap.existingSecrets.filter((secret) =>
    secret.name.toLowerCase().includes(snap.autocomplete.search.toLowerCase()) ||
    (secret as any).description?.toLowerCase().includes(snap.autocomplete.search.toLowerCase())
  )

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wide text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>

      {snap.ui.error && snap.mode !== "select" && (
        <div className="bg-red-500/10 text-red-300 px-4 py-3 border border-red-500/30 backdrop-blur-sm text-sm flex items-center gap-2 rounded">
          <XCircle className="w-4 h-4" />
          {snap.ui.error}
        </div>
      )}

      {/* Select Mode */}
      {snap.mode === "select" && (
        <div className="space-y-3">
          {snap.selectedSecret ? (
            <div className={`bg-neutral-800/50 p-4 border rounded ${
              snap.selectedValidation.validating
                ? "border-neutral-600"
                : snap.selectedValidation.valid === true && snap.selectedValidation.scopesValid === true
                ? "border-green-500/40"
                : snap.selectedValidation.valid === false || snap.selectedValidation.scopesValid === false
                ? "border-red-500/40"
                : "border-neutral-600"
            } space-y-3`}>
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="relative group mt-1">
                    {snap.selectedValidation.validating && <Loader2 className="w-5 h-5 animate-spin text-gray-400" />}
                    {!snap.selectedValidation.validating && snap.selectedValidation.valid === true && snap.selectedValidation.scopesValid === true && (
                      <>
                        <CheckCircle2 className="w-5 h-5 text-green-400" />
                        {/* Tooltip */}
                        {snap.selectedValidation.info && (
                          <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-neutral-900 border border-neutral-700 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                            <div className="space-y-1">
                              <div className="font-semibold border-b border-neutral-700 pb-1 mb-2">Token Information</div>
                              <div><span className="text-gray-400">Name:</span> {snap.selectedValidation.info.name}</div>
                              <div><span className="text-gray-400">Scopes:</span> {snap.selectedValidation.scopes.join(", ")}</div>
                              {snap.selectedValidation.info.expiresAt && (
                                <div><span className="text-gray-400">Expires:</span> {new Date(snap.selectedValidation.info.expiresAt).toLocaleDateString()}</div>
                              )}
                            </div>
                          </div>
                        )}
                      </>
                    )}
                    {!snap.selectedValidation.validating && snap.selectedValidation.valid === true && snap.selectedValidation.scopesValid === false && (
                      <AlertCircle className="w-5 h-5 text-yellow-500" />
                    )}
                    {!snap.selectedValidation.validating && snap.selectedValidation.valid === false && (
                      <XCircle className="w-5 h-5 text-red-400" />
                    )}
                  </div>
                  <div className="flex-1">
                    <div className={`text-xs uppercase tracking-wide font-medium ${
                      snap.selectedValidation.validating
                        ? "text-gray-400"
                        : snap.selectedValidation.valid === true && snap.selectedValidation.scopesValid === true
                        ? "text-green-400"
                        : snap.selectedValidation.valid === false || snap.selectedValidation.scopesValid === false
                        ? "text-red-400"
                        : "text-gray-400"
                    }`}>
                      {snap.selectedValidation.validating ? "VALIDATING SECRET..." : "SELECTED SECRET"}
                    </div>
                    <div className="text-sm font-medium mt-1 text-gray-100">{snap.selectedSecret.name}</div>
                    {(snap.selectedSecret as any).description && (
                      <div className="text-xs text-gray-400 mt-0.5">{(snap.selectedSecret as any).description}</div>
                    )}
                    {snap.selectedValidation.valid === true && snap.selectedValidation.scopesValid === false && (
                      <div className="text-xs text-yellow-400 mt-2">
                        Missing required scopes
                      </div>
                    )}
                    {snap.selectedValidation.valid === false && (
                      <div className="text-xs text-red-400 mt-2">
                        Token validation failed
                      </div>
                    )}
                  </div>
                </div>
                <Button
                  type="button"
                  onClick={() => {
                    store.selectedSecret = null
                    store.autocomplete.search = ""
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
              {snap.existingSecrets.length > 0 && (
                <div ref={secretInputRef} className="relative">
                    <Input
                      type="text"
                      value={snap.autocomplete.search}
                      onChange={(e) => {
                        store.autocomplete.search = e.target.value
                        updateDropdownPosition()
                        store.autocomplete.showDropdown = true
                      }}
                      onFocus={handleSecretInputFocus}
                      onBlur={() => setTimeout(() => { store.autocomplete.showDropdown = false }, 200)}
                      className="bg-neutral-800/50 backdrop-blur-sm border-neutral-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
                      placeholder="Search existing secrets..."
                    />
                    <div className="absolute right-3 top-1/2 -tranneutral-y-1/2">
                      <Search className="w-4 h-4 text-gray-400" />
                    </div>

                    {/* Autocomplete Dropdown */}
                    {snap.autocomplete.showDropdown && (
                      <Portal>
                        <div
                          className="absolute bg-neutral-800 border border-neutral-700 shadow-lg max-h-60 overflow-auto rounded"
                          style={{
                            top: `${snap.autocomplete.dropdownPosition.top}px`,
                            left: `${snap.autocomplete.dropdownPosition.left}px`,
                            width: `${snap.autocomplete.dropdownPosition.width}px`,
                            zIndex: 9999
                          }}
                        >
                        {filteredSecrets.length > 0 ? (
                          filteredSecrets.map((secret) => (
                            <button
                              key={secret.id}
                              type="button"
                              onClick={() => handleSelectSecret(secret)}
                              className="w-full px-4 py-3 text-left hover:bg-neutral-700/50 transition-colors border-b border-neutral-700 last:border-b-0"
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

              {enableOAuth && host === 'https://gitlab.com' ? (
                <div className="space-y-2">
                  <GitLabOAuthButton
                    projectId={projectId || ''}
                    client={client}
                    gitlabHost={host !== 'https://gitlab.com' ? host : undefined}
                    onSuccess={(result) => {
                      // Fetch the created secret from backend to get full secret object
                      client.run(getSecretConfig, {
                        params: { id: result.secretId }
                      }).then((secret: any) => {
                        store.selectedSecret = secret as any
                        const exists = store.existingSecrets.find(s => s.id === secret.id)
                        if (!exists) {
                          store.existingSecrets = [...store.existingSecrets, secret as any]
                        }
                        onChange(secret.id, secret as any)
                      }).catch(() => {
                        onChange(result.secretId, null)
                      })
                    }}
                    onError={(error) => {
                      store.ui.error = error
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => { store.mode = "create" }}
                    disabled={!projectId}
                    className="w-full text-xs text-gray-400 hover:text-gray-300 hover:underline py-2 disabled:opacity-50 disabled:cursor-not-allowed"
                    title={!projectId ? "Project ID required to create new secrets" : ""}
                  >
                    Or enter API token manually
                  </button>
                </div>
              ) : (
                <Button
                  type="button"
                  onClick={() => { store.mode = "create" }}
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
      {snap.mode === "create" && (
        <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-900/30 backdrop-blur-sm rounded">
          {/* OAuth option for gitlab.com */}
          {enableOAuth && host === 'https://gitlab.com' && (
            <div className="pb-4 border-b border-neutral-700">
              <div className="bg-blue-500/10 border border-blue-500/30 rounded p-3 mb-3">
                <p className="text-xs text-gray-300 mb-3">
                  Recommended: Connect with GitLab OAuth for easier setup
                </p>
                <GitLabOAuthButton
                  projectId={projectId || ''}
                  client={client}
                  gitlabHost={host !== 'https://gitlab.com' ? host : undefined}
                  onSuccess={(result) => {
                    // Fetch the created secret from backend to get full secret object
                    client.run(getSecretConfig, {
                      params: { id: result.secretId }
                    }).then((secret: any) => {
                      store.selectedSecret = secret as any
                      const exists = store.existingSecrets.find(s => s.id === secret.id)
                      if (!exists) {
                        store.existingSecrets = [...store.existingSecrets, secret as any]
                      }
                      onChange(secret.id, secret as any)
                      store.createForm.newToken = ""
                      store.createForm.secretName = ""
                      store.createForm.tokenValid = null
                      store.mode = "select"
                    }).catch(() => {
                      onChange(result.secretId, null)
                      store.mode = "select"
                    })
                  }}
                  onError={(error) => {
                    store.ui.error = error
                  }}
                />
              </div>
              <div className="text-center">
                <span className="text-xs text-gray-400 uppercase">Or continue with API token below</span>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="gitlab_token" className="text-xs uppercase tracking-wide text-gray-300">
              GITLAB ACCESS TOKEN
            </Label>
            <div className="relative group">
              <Input
                id="gitlab_token"
                type="password"
                value={snap.createForm.newToken}
                onChange={(e) => {
                  store.createForm.newToken = e.target.value
                  store.createForm.tokenValid = null
                  store.ui.error = null
                }}
                className="bg-neutral-800/50 backdrop-blur-sm border-neutral-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
                placeholder="glpat-xxxxxxxxxxxxxxxxxxxx"
              />
              <div className="absolute right-3 top-1/2 -tranneutral-y-1/2">
                {snap.createForm.tokenValidating && <Loader2 className="w-4 h-4 animate-spin text-gray-400" />}
                {!snap.createForm.tokenValidating && snap.createForm.tokenValid === true && snap.createForm.scopesValid === true && (
                  <div className="relative cursor-help">
                    <CheckCircle2 className="w-4 h-4 text-green-400" />
                    {/* Tooltip */}
                    {snap.createForm.tokenInfo && (
                      <div className="fixed mt-2 hidden group-hover:block w-64 p-3 bg-neutral-900 border border-neutral-700 text-white text-xs rounded shadow-xl" style={{ zIndex: 9999 }}>
                        <div className="space-y-1">
                          <div className="font-semibold border-b border-neutral-700 pb-1 mb-2">Token Information</div>
                          <div><span className="text-gray-400">Name:</span> {snap.createForm.tokenInfo.name}</div>
                          <div><span className="text-gray-400">Scopes:</span> {snap.createForm.tokenScopes.join(", ")}</div>
                          {snap.createForm.tokenInfo.expiresAt && (
                            <div><span className="text-gray-400">Expires:</span> {new Date(snap.createForm.tokenInfo.expiresAt).toLocaleDateString()}</div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {!snap.createForm.tokenValidating && snap.createForm.tokenValid === true && snap.createForm.scopesValid === false && (
                  <AlertCircle className="w-4 h-4 text-yellow-500" />
                )}
                {!snap.createForm.tokenValidating && snap.createForm.tokenValid === false && (
                  <XCircle className="w-4 h-4 text-red-400" />
                )}
              </div>
            </div>
            <p className="text-xs text-gray-400">
              <a
                href={`${host}/-/user_settings/personal_access_tokens?name=${encodeURIComponent("ADI Simple Access Token")}&scopes=${requiredScopes.join(",")}`}
                target="_blank"
                rel="noopener noreferrer"
                className="text-blue-400 hover:text-blue-300 hover:underline font-medium"
              >
                Create a new GitLab token
              </a>{" "}
              with scopes: {requiredScopes.map(s => <code key={s} className="bg-neutral-700/50 px-1 mx-0.5 text-gray-200">{s}</code>)}
            </p>
          </div>

          {/* Secret Name - Only show when token is valid */}
          {snap.createForm.tokenValid === true && snap.createForm.scopesValid === true && (
            <div className="space-y-2">
              <Label htmlFor="secret_name" className="text-xs uppercase tracking-wide text-gray-300">
                SECRET NAME
              </Label>
              <Input
                id="secret_name"
                type="text"
                value={snap.createForm.secretName}
                onChange={(e) => { store.createForm.secretName = e.target.value }}
                className="bg-neutral-800/50 backdrop-blur-sm border-neutral-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100"
                placeholder="GitLab Token [username]"
              />
            </div>
          )}

          {snap.createForm.tokenValid === false && (
            <div className="bg-yellow-500/10 text-yellow-300 px-4 py-3 border border-yellow-500/30 backdrop-blur-sm text-sm flex items-start gap-2 rounded">
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
            {snap.existingSecrets.length > 0 && (
              <Button
                type="button"
                onClick={() => {
                  store.mode = "select"
                  store.createForm.newToken = ""
                  store.createForm.secretName = ""
                  store.createForm.tokenValid = null
                  store.ui.error = null
                }}
                variant="outline"
                className="flex-1 uppercase tracking-wide"
              >
                CANCEL
              </Button>
            )}
            <Button
              type="button"
              onClick={() => { store.mode = "confirm" }}
              disabled={!snap.createForm.newToken.trim() || !snap.createForm.secretName.trim() || snap.createForm.tokenValid !== true || snap.createForm.scopesValid !== true}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Mode */}
      {snap.mode === "confirm" && (
        <div className="space-y-4 p-4 border border-neutral-700/50 bg-neutral-900/30 backdrop-blur-sm rounded">
          <div className="bg-neutral-800/50 p-4 border border-neutral-700 rounded space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">SECRET NAME</div>
              <div className="font-medium text-gray-100">{snap.createForm.secretName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">GITLAB HOST</div>
              <div className="font-medium text-gray-100">{host}</div>
            </div>
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
            This will create a secret in your project for GitLab authentication.
          </p>

          <div className="flex gap-2">
            <Button
              type="button"
              onClick={() => { store.mode = "create" }}
              variant="outline"
              className="flex-1 uppercase tracking-wide"
            >
              BACK
            </Button>
            <Button
              type="button"
              onClick={handleCreateSecret}
              disabled={snap.ui.loading}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              {snap.ui.loading ? (
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
