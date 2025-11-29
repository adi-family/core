import { useState } from "react"
import { Button } from './button'
import { Loader2, CheckCircle2, XCircle } from "lucide-react"
import { GitHubIcon } from './github-icon'
import type { BaseClient } from '@adi-family/http'
import { githubOAuthAuthorizeConfig, githubOAuthExchangeConfig } from '@adi/api-contracts'

// Global flag to prevent double-processing in StrictMode
const processingCodes = new Set<string>()

export interface GitHubUser {
  login: string
  name: string | null
}

export interface GitHubOAuthResult {
  secretId: string
  user: GitHubUser
  scopes: string[]
}

interface GitHubOAuthButtonProps {
  projectId: string
  client: BaseClient
  onSuccess: (result: GitHubOAuthResult) => void
  onError?: (error: string) => void
  secretName?: string
}

export function GitHubOAuthButton({
  projectId,
  client,
  onSuccess,
  onError,
  secretName,
}: GitHubOAuthButtonProps) {
  const [loading, setLoading] = useState(false)
  const [status, setStatus] = useState<'idle' | 'authorizing' | 'success' | 'error'>('idle')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)

  const handleOAuthFlow = async () => {
    setLoading(true)
    setStatus('authorizing')
    setErrorMessage(null)

    try {
      // Generate secret name if not provided
      const generatedSecretName = secretName || `GitHub OAuth Token - ${new Date().toLocaleDateString()}`

      // Step 1: Get authorization URL
      const { authUrl, state } = await client.run(githubOAuthAuthorizeConfig)

      // Store state and details for callback
      sessionStorage.setItem('github_oauth_state', state)
      sessionStorage.setItem('github_oauth_project_id', projectId)
      sessionStorage.setItem('github_oauth_secret_name', generatedSecretName)

      // Step 2: Open OAuth popup
      const width = 600
      const height = 700
      const left = window.screen.width / 2 - width / 2
      const top = window.screen.height / 2 - height / 2

      const popup = window.open(
        authUrl,
        'GitHub OAuth',
        `width=${width},height=${height},left=${left},top=${top}`
      )

      if (!popup) {
        throw new Error('Popup blocked. Please allow popups for this site.')
      }

      // Step 3: Listen for OAuth callback
      const handleMessage = async (event: MessageEvent) => {
        if (event.origin !== window.location.origin) return

        if (event.data.type === 'GITHUB_OAUTH_SUCCESS') {
          const { code, state: returnedState } = event.data

          // Prevent double processing (React StrictMode causes double-execution)
          if (processingCodes.has(code)) {
            console.log('[GitHub OAuth] Code already being processed, skipping duplicate')
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
            const result = await client.run(githubOAuthExchangeConfig, {
              body: {
                projectId,
                code,
                secretName: generatedSecretName,
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
        } else if (event.data.type === 'GITHUB_OAUTH_ERROR') {
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
            Connected to GitHub
          </>
        ) : status === 'error' ? (
          <>
            <XCircle className="mr-2 h-4 w-4" />
            Connection Failed
          </>
        ) : (
          <>
            <GitHubIcon className="mr-2 h-4 w-4" />
            Connect with GitHub
          </>
        )}
      </Button>

      {errorMessage && (
        <p className="text-sm text-red-600">{errorMessage}</p>
      )}

      {status === 'success' && (
        <p className="text-sm text-green-600">Successfully connected to GitHub!</p>
      )}
    </div>
  )
}
