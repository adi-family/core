import { useMemo, useEffect, useRef } from "react"
import { proxy, useSnapshot } from "valtio"
import { Input } from './input'
import { Label } from './label'
import { Button } from './button'
import { Portal } from './portal'
import { CheckCircle2, Plus, Search, Loader2 } from "lucide-react"
import type { BaseClient } from '@adi-family/http'
import {
  listSecretsConfig,
  getSecretsByProjectConfig,
  createSecretConfig,
} from '@adi/api-contracts/secrets'
import type { Secret } from "@adi-simple/types"

interface ApiKeySecretAutocompleteProps {
  client: BaseClient
  projectId?: string
  value?: string | null
  onChange: (secretId: string | null, secret?: Secret | null) => void
  onSecretCreated?: (secret: Secret) => void
  label?: string
  required?: boolean
  providerName: string
  helpText?: string
  placeholder?: string
}

interface StoreState {
  mode: "select" | "create" | "confirm"
  existingSecrets: Secret[]
  selectedSecret: Secret | null
  ui: {
    loading: boolean
    saving: boolean
    error: string | null
  }
  autocomplete: {
    search: string
    showDropdown: boolean
    dropdownPosition: { top: number; left: number; width: number }
  }
  createForm: {
    apiKey: string
    secretName: string
  }
}

export function ApiKeySecretAutocomplete({
  client,
  projectId,
  value,
  onChange,
  onSecretCreated,
  label = "API KEY SECRET",
  required = false,
  providerName,
  helpText,
  placeholder = "sk-...",
}: ApiKeySecretAutocompleteProps) {

  const store = useMemo(() => proxy<StoreState>({
    mode: "select",
    existingSecrets: [],
    selectedSecret: null,
    ui: {
      loading: false,
      saving: false,
      error: null,
    },
    autocomplete: {
      search: "",
      showDropdown: false,
      dropdownPosition: { top: 0, left: 0, width: 0 },
    },
    createForm: {
      apiKey: "",
      secretName: "",
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
          secrets = await client.run(getSecretsByProjectConfig, {
            params: { projectId }
          }) as any
        } else {
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
        if (secrets.length === 0 && projectId) {
          store.mode = "create"
        }
      } catch (err) {
        console.error("Failed to load secrets:", err)
      }
    }

    loadSecrets()
  }, [projectId, value, store, client])

  const handleCreateSecret = async () => {
    if (!projectId) {
      store.ui.error = "Project ID is required to create a secret"
      return
    }

    if (!snap.createForm.apiKey.trim() || !snap.createForm.secretName.trim()) {
      store.ui.error = "API key and secret name are required"
      return
    }

    store.ui.saving = true
    store.ui.error = null

    try {
      const secret = await client.run(createSecretConfig, {
        body: {
          project_id: projectId,
          name: snap.createForm.secretName,
          value: snap.createForm.apiKey,
          description: `${providerName} API key`,
        }
      }) as any

      store.selectedSecret = secret
      store.existingSecrets = [...store.existingSecrets, secret]
      onChange(secret.id, secret)
      onSecretCreated?.(secret)
      store.createForm.apiKey = ""
      store.createForm.secretName = ""
      store.mode = "select"
    } catch (err) {
      store.ui.error = `Failed to create secret: ${err instanceof Error ? err.message : "Unknown error"}`
      console.error(err)
    } finally {
      store.ui.saving = false
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

  // Auto-generate secret name based on provider
  useEffect(() => {
    if (snap.mode === "create" && !snap.createForm.secretName && snap.createForm.apiKey) {
      store.createForm.secretName = `${providerName} API Key`
    }
  }, [snap.mode, snap.createForm.apiKey, snap.createForm.secretName, providerName, store])

  return (
    <div className="space-y-4">
      <Label className="text-xs uppercase tracking-wide text-gray-300">
        {label}
        {required && <span className="text-red-400 ml-1">*</span>}
      </Label>

      {snap.ui.error && (
        <div className="bg-red-500/10 text-red-300 px-4 py-3 border border-red-500/30 backdrop-blur-sm text-sm flex items-center gap-2 rounded">
          <span className="text-red-400">⚠</span>
          {snap.ui.error}
        </div>
      )}

      {/* Select Mode */}
      {snap.mode === "select" && (
        <div className="space-y-3">
          {snap.selectedSecret ? (
            <div className="bg-slate-800/50 p-4 border border-green-500/40 rounded space-y-3">
              <div className="flex items-start justify-between">
                <div className="flex items-start gap-4 flex-1">
                  <div className="mt-1">
                    <CheckCircle2 className="w-5 h-5 text-green-400" />
                  </div>
                  <div className="flex-1">
                    <div className="text-xs uppercase tracking-wide font-medium text-green-400">
                      SELECTED SECRET
                    </div>
                    <div className="text-sm font-medium mt-1 text-gray-100">{snap.selectedSecret.name}</div>
                    {(snap.selectedSecret as any).description && (
                      <div className="text-xs text-gray-400 mt-0.5">{(snap.selectedSecret as any).description}</div>
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
                    className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 pr-10 text-gray-100"
                    placeholder="Search existing secrets..."
                  />
                  <div className="absolute right-3 top-1/2 -translate-y-1/2">
                    <Search className="w-4 h-4 text-gray-400" />
                  </div>

                  {/* Autocomplete Dropdown */}
                  {snap.autocomplete.showDropdown && (
                    <Portal>
                      <div
                        className="absolute bg-slate-800 border border-slate-700 shadow-lg max-h-60 overflow-auto rounded z-50"
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
                            No secrets found
                          </div>
                        )}
                      </div>
                    </Portal>
                  )}
                </div>
              )}

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
            </>
          )}
        </div>
      )}

      {/* Create Mode */}
      {snap.mode === "create" && (
        <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
          <div className="space-y-2">
            <Label htmlFor="api_key" className="text-xs uppercase tracking-wide text-gray-300">
              {providerName} API KEY
            </Label>
            <Input
              id="api_key"
              type="password"
              value={snap.createForm.apiKey}
              onChange={(e) => {
                store.createForm.apiKey = e.target.value
                store.ui.error = null
              }}
              className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100"
              placeholder={placeholder}
            />
            {helpText && (
              <p className="text-xs text-gray-400">
                {helpText}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="secret_name" className="text-xs uppercase tracking-wide text-gray-300">
              SECRET NAME
            </Label>
            <Input
              id="secret_name"
              type="text"
              value={snap.createForm.secretName}
              onChange={(e) => { store.createForm.secretName = e.target.value }}
              className="bg-slate-800/50 backdrop-blur-sm border-slate-600 focus:border-blue-400 focus:ring-blue-400 text-gray-100"
              placeholder={`${providerName} API Key`}
            />
          </div>

          <div className="flex gap-2">
            {snap.existingSecrets.length > 0 && (
              <Button
                type="button"
                onClick={() => {
                  store.mode = "select"
                  store.createForm.apiKey = ""
                  store.createForm.secretName = ""
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
              disabled={!snap.createForm.apiKey.trim() || !snap.createForm.secretName.trim()}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              NEXT
            </Button>
          </div>
        </div>
      )}

      {/* Confirm Mode */}
      {snap.mode === "confirm" && (
        <div className="space-y-4 p-4 border border-slate-700/50 bg-slate-900/30 backdrop-blur-sm rounded">
          <div className="bg-slate-800/50 p-4 border border-slate-700 rounded space-y-3">
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">SECRET NAME</div>
              <div className="font-medium text-gray-100">{snap.createForm.secretName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">PROVIDER</div>
              <div className="font-medium text-gray-100">{providerName}</div>
            </div>
            <div>
              <div className="text-xs uppercase tracking-wide text-gray-400">API KEY</div>
              <div className="font-mono text-sm text-gray-300">•••••••••••••••••••</div>
            </div>
          </div>

          <p className="text-sm text-gray-300">
            This will securely store the API key in your project.
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
              disabled={snap.ui.saving}
              className="flex-1 uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              {snap.ui.saving ? (
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
