import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Loader2, CheckCircle2, XCircle } from 'lucide-react'

export function OAuthCallbackPage() {
  const [searchParams] = useSearchParams()
  const [status, setStatus] = useState<'processing' | 'success' | 'error'>('processing')
  const [message, setMessage] = useState('Processing OAuth callback...')

  useEffect(() => {
    const handleCallback = () => {
      const code = searchParams.get('code')
      const state = searchParams.get('state')
      const error = searchParams.get('error')
      const errorDescription = searchParams.get('error_description')

      if (error) {
        setStatus('error')
        setMessage(errorDescription || error || 'OAuth authorization failed')

        // Send error to parent window
        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'JIRA_OAUTH_ERROR',
              error: errorDescription || error,
            },
            window.location.origin
          )
        }

        // Close popup after 3 seconds
        setTimeout(() => {
          window.close()
        }, 3000)
        return
      }

      if (!code || !state) {
        setStatus('error')
        setMessage('Missing authorization code or state parameter')

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'JIRA_OAUTH_ERROR',
              error: 'Missing authorization code or state',
            },
            window.location.origin
          )
        }

        setTimeout(() => {
          window.close()
        }, 3000)
        return
      }

      // Determine which OAuth provider (check session storage)
      const gitlabState = sessionStorage.getItem('gitlab_oauth_state')
      const jiraState = sessionStorage.getItem('jira_oauth_state')
      const githubState = sessionStorage.getItem('github_oauth_state')
      const isGitLab = gitlabState === state
      const isJira = jiraState === state
      const isGitHub = githubState === state

      // Verify state matches one of the providers
      if (!isGitLab && !isJira && !isGitHub) {
        setStatus('error')
        setMessage('OAuth state mismatch. Please try again.')

        if (window.opener) {
          window.opener.postMessage(
            {
              type: 'OAUTH_ERROR',
              error: 'State mismatch',
            },
            window.location.origin
          )
        }

        setTimeout(() => {
          window.close()
        }, 3000)
        return
      }

      // Determine message type based on provider
      const getMessageType = (success: boolean) => {
        if (isGitLab) return success ? 'GITLAB_OAUTH_SUCCESS' : 'GITLAB_OAUTH_ERROR'
        if (isJira) return success ? 'JIRA_OAUTH_SUCCESS' : 'JIRA_OAUTH_ERROR'
        return success ? 'GITHUB_OAUTH_SUCCESS' : 'GITHUB_OAUTH_ERROR'
      }

      // Send success to parent window
      setStatus('success')
      setMessage('Authorization successful! Completing setup...')

      if (window.opener) {
        window.opener.postMessage(
          {
            type: getMessageType(true),
            code,
            state,
          },
          window.location.origin
        )
      }

      // Close popup after 2 seconds
      setTimeout(() => {
        window.close()
      }, 2000)
    }

    handleCallback()
  }, [searchParams])

  return (
    <div className="min-h-screen flex items-center justify-center bg-neutral-50">
      <div className="max-w-md w-full bg-white rounded-lg shadow-lg p-8 text-center">
        {status === 'processing' && (
          <>
            <Loader2 className="h-16 w-16 animate-spin text-neutral-600 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Processing...</h2>
            <p className="text-neutral-600">{message}</p>
          </>
        )}

        {status === 'success' && (
          <>
            <CheckCircle2 className="h-16 w-16 text-neutral-200 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Success!</h2>
            <p className="text-neutral-600">{message}</p>
            <p className="text-sm text-neutral-500 mt-4">This window will close automatically...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <XCircle className="h-16 w-16 text-neutral-700 mx-auto mb-4" />
            <h2 className="text-2xl font-semibold text-neutral-900 mb-2">Error</h2>
            <p className="text-neutral-600">{message}</p>
            <p className="text-sm text-neutral-500 mt-4">This window will close automatically...</p>
          </>
        )}
      </div>
    </div>
  )
}
