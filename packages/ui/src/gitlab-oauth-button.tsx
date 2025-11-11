import { useState } from "react"
import { Button } from './button'
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { GitLabIcon } from './gitlab-icon'
import type { BaseClient } from '@adi-family/http'
import { gitlabOAuthAuthorizeConfig, gitlabOAuthExchangeConfig } from '@adi/api-contracts'

// Global flag to prevent double-processing in StrictMode
const processingCodes = new Set<string>()

export interface GitLabUser {
  username: string
  name: string
  email: string
}

export interface GitLabOAuthResult {
  secretId: string
  expiresAt: string
  user: GitLabUser
}

interface GitLabOAuthButtonProps {
  projectId: string
  client: BaseClient
  onSuccess: (result: GitLabOAuthResult) => void
  onError?: (error: string) => void
  secretName?: string
  gitlabHost?: string
}

export function GitLabOAuthButton({
  projectId,
  client,
  onSuccess,
  onError,
  secretName,
  gitlabHost,
}: GitLabOAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOAuthFlow = async () => {
    setLoading(true)
    setStatus('authorizing')
    setErrorMessage(null)

    try {
      // Generate secret name if not provided
      const generatedSecretName = secretName || `GitLab OAuth Token - ${new Date().toLocaleDateString()}`

      // Step 1: Get authorization URL
      const { authUrl, state } = await client.run(gitlabOAuthAuthorizeConfig)

      // Store state and details for callback
      sessionStorage.setItem('gitlab_oauth_state', state)
      sessionStorage.setItem('gitlab_oauth_project_id', projectId)
      sessionStorage.setItem('gitlab_oauth_secret_name', generatedSecretName)
      if (gitlabHost) {
        sessionStorage.setItem('gitlab_oauth_host', gitlabHost)
      }

      // Step 2: Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        authUrl,
        'GitLab OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      // Step 3: Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'GITLAB_OAUTH_SUCCESS') {
          const { code, state: returnedState } = event.data

          // Prevent double processing (React StrictMode causes double-execution)
          if (processingCodes.has(code)) {
            console.log('[GitLab OAuth] Code already being processed, skipping duplicate')
            return
          }
          processingCodes.add(code)

          // Verify state matches
          if (returnedState !== state) {
            processingCodes.delete(code)
            setStatus('error')
            setErrorMessage('OAuth state mismatch. Please try again.')
            setLoading(false)
            onError?.('OAuth state mismatch')
            window.removeEventListener('message', handleMessage)
            return
          }

          // Step 4: Exchange code for tokens
          try {
            const result = await client.run(gitlabOAuthExchangeConfig, {
              body: {
                projectId,
                code,
                secretName: generatedSecretName,
                gitlabHost,
              }
            })

            setStatus('success')
            setLoading(false)
            processingCodes.delete(code)
            onSuccess(result)
          } catch (err) {
            setStatus('error')
            setErrorMessage(err instanceof Error ? err.message : 'Failed to complete OAuth flow')
            setLoading(false)
            processingCodes.delete(code)
            onError?.(err instanceof Error ? err.message : 'Failed to complete OAuth flow')
          }

          window.removeEventListener('message', handleMessage)
        } else if (event.data.type === 'GITLAB_OAUTH_ERROR') {
          setStatus('error')
          setErrorMessage(event.data.error || 'OAuth authorization failed')
          setLoading(false)
          onError?.(event.data.error || 'OAuth authorization failed')
          window.removeEventListener('message', handleMessage)
        }
      }

      window.addEventListener('message', handleMessage)

      // Check if popup is closed without completing OAuth
      const checkClosed = setInterval(() => {
        if (popup.closed) {
          clearInterval(checkClosed)
          window.removeEventListener('message', handleMessage)
          if (status === 'authorizing') {
            setStatus('error')
            setErrorMessage('OAuth window was closed')
            setLoading(false)
            onError?.('OAuth window was closed')
          }
        }
      }, 1000)

    } catch (err) {
      setStatus('error')
      setErrorMessage(err instanceof Error ? err.message : 'Failed to initiate OAuth')
      setLoading(false)
      onError?.(err instanceof Error ? err.message : 'Failed to initiate OAuth')
    }
  }

  return (
    <div className="space-y-2">
      <Button
        type="button"
        onClick={handleOAuthFlow}
        disabled={loading}
        variant={status === 'success' ? 'default' : status === 'error' ? 'destructive' : 'outline'}
        className="w-full"
      >
        {loading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Authorizing...
          </>
        ) : status === 'success' ? (
          <>
            <CheckCircle2 className="mr-2 h-4 w-4" />
            Connected to GitLab
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="mr-2 h-4 w-4" />
            Connection Failed
          </>
        ) : (
          <>
            <GitLabIcon className="mr-2 h-4 w-4" />
            Connect with GitLab OAuth
          </>
        )}
      </Button>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      {status === 'success' && (
        <p className="text-sm text-green-600">Successfully connected to GitLab!</p>
      )}
    </div>
  )
}
