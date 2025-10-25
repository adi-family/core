import { Link, Outlet } from "react-router-dom"
import { UserButton, useAuth } from '@clerk/clerk-react'
import { useEffect, useState, useMemo } from "react"
import { AlertCircle } from "lucide-react"
import { createAuthenticatedClient } from "@/lib/client"

type Alert = {
  type: 'missing_api_keys'
  severity: 'warning'
  message: string
  providers: string[]
  projects: Array<{ id: string; name: string; missingProviders: string[] }>
}

export function Layout() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [alerts, setAlerts] = useState<Alert[]>([])

  useEffect(() => {
    const fetchAlerts = async () => {
      try {
        const res = await client.alerts.$get()
        if (res.ok) {
          const data = await res.json()
          setAlerts(data.alerts)
        }
      } catch {
        // Failed to fetch alerts
      }
    }

    fetchAlerts()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <nav className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto px-6">
          <div className="flex h-14 items-center gap-8">
            <Link to="/" className="font-bold text-sm uppercase tracking-wider text-gray-900 transition-all hover:text-blue-600">
              ADI
            </Link>
            <div className="flex flex-1 gap-6">
              <Link
                to="/projects"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Projects
              </Link>
              <Link
                to="/tasks"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Tasks
              </Link>
              <Link
                to="/sessions"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Sessions
              </Link>
              <Link
                to="/messages"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Messages
              </Link>
              <Link
                to="/worker-cache"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Cache
              </Link>
              <Link
                to="/file-spaces"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Files
              </Link>
              <Link
                to="/task-sources"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Sources
              </Link>
              <Link
                to="/pipeline-executions"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Pipelines
              </Link>
              <Link
                to="/pipeline-artifacts"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Artifacts
              </Link>
              <Link
                to="/admin"
                className="text-xs uppercase tracking-wide text-blue-600 transition-all duration-200 hover:text-blue-800 hover:scale-105 font-semibold"
              >
                Admin
              </Link>
            </div>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>

      {/* Global Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-50 border-b border-amber-200">
          {alerts.map((alert, index) => (
            <div key={index} className="mx-auto px-6 py-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-900 font-medium mb-2">
                    {alert.message}
                  </p>
                  <div className="flex flex-wrap gap-2">
                    {alert.projects.map((project) => {
                      const providerNames = project.missingProviders.map(p =>
                        p === 'anthropic' ? 'Anthropic' :
                        p === 'openai' ? 'OpenAI' :
                        'Google'
                      )
                      return (
                        <Link
                          key={project.id}
                          to={`/projects/${project.id}?tab=ai-providers`}
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-white border border-amber-300 rounded-md text-sm text-amber-900 hover:bg-amber-100 hover:border-amber-400 transition-colors"
                        >
                          <span className="font-medium">{project.name}</span>
                          <span className="text-amber-700">→</span>
                          <span className="text-xs text-amber-700">
                            Missing: {providerNames.join(', ')}
                          </span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      <main className="relative">
        <Outlet />
      </main>
    </div>
  )
}
