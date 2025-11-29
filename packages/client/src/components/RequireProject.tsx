import { useEffect, useMemo } from "react"
import { useNavigate, useLocation } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { createAuthenticatedClient } from "@/lib/client"
import { projectsStore, fetchProjects } from "@/stores"

interface RequireProjectProps {
  children: React.ReactNode
}

/**
 * RequireProject - Wrapper that redirects to setup flow when no projects exist
 *
 * Checks if the user has any projects. If not, redirects to the setup flow.
 * Shows loading state while checking.
 */
export function RequireProject({ children }: RequireProjectProps) {
  const navigate = useNavigate()
  const location = useLocation()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { projects, loading, lastFetch } = useSnapshot(projectsStore)

  // Fetch projects if not already fetched
  useEffect(() => {
    if (!lastFetch && !loading) {
      fetchProjects(client)
    }
  }, [client, lastFetch, loading])

  // Redirect to setup if no projects after initial load
  useEffect(() => {
    const setupPaths = ['/setup', '/setup-project', '/create-task-source', '/create-file-space']
    const isSetupPath = setupPaths.some(path => location.pathname.startsWith(path))

    // Don't redirect if we're already on a setup page
    if (isSetupPath) return

    // Only redirect after we've loaded and confirmed no projects
    if (lastFetch && !loading && projects.length === 0) {
      navigate('/setup', { replace: true })
    }
  }, [projects, loading, lastFetch, navigate, location.pathname])

  // Show loading spinner while fetching projects
  if (!lastFetch && loading) {
    return (
      <div className="min-h-screen bg-neutral-900 flex items-center justify-center">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-neutral-600 border-t-neutral-300 rounded-full animate-spin mx-auto mb-4" />
          <p className="text-neutral-400 text-sm">Loading...</p>
        </div>
      </div>
    )
  }

  return <>{children}</>
}
