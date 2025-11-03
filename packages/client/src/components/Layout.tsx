import { Link, Outlet } from "react-router-dom"
import { UserButton, useAuth } from '@clerk/clerk-react'
import { useEffect, useState, useMemo } from "react"
import { AlertCircle, DollarSign } from "lucide-react"
import { createAuthenticatedClient } from "@/lib/client"
import { useExpertMode } from "@/contexts/ExpertModeContext"
import { useProject } from "@/contexts/ProjectContext"
import { Select } from "@adi-simple/ui/select"
import { listAlertsConfig, getUsageMetricsConfig, listProjectsConfig } from "@adi/api-contracts"
import { calculateCostBreakdown, formatCost, type ApiUsageMetric } from "@/config/pricing"
import type { Project } from "@adi-simple/types"

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
  const { expertMode } = useExpertMode()
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const [alerts, setAlerts] = useState<Alert[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [usageMetrics, setUsageMetrics] = useState<ApiUsageMetric[]>([])
  const [loadingUsage, setLoadingUsage] = useState(true)

  useEffect(() => {
    const fetchData = async () => {
      try {
        // Fetch all data in parallel
        const [alertsData, projectsData, usageData] = await Promise.all([
          client.run(listAlertsConfig).catch(() => ({ alerts: [] })),
          client.run(listProjectsConfig).catch(() => []),
          client.run(getUsageMetricsConfig).catch(() => ({ recent: [] })),
        ])

        setAlerts(alertsData.alerts)
        setProjects(projectsData)
        setUsageMetrics(usageData.recent as ApiUsageMetric[])

        // Don't auto-select project - allow viewing all projects
        // User can manually select a project to filter
      } catch {
        // Failed to fetch data
      } finally {
        setLoadingUsage(false)
      }
    }

    fetchData()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Calculate total cost and balance
  const totalCost = useMemo(() => {
    if (usageMetrics.length === 0) return 0
    return usageMetrics.reduce((acc, metric) => {
      const breakdown = calculateCostBreakdown(metric)
      return acc + breakdown.totalCost
    }, 0)
  }, [usageMetrics])

  const balance = 100 - totalCost

  // Navigation items with expert mode requirement
  const navItems = [
    { to: '/projects', label: 'Projects', requiresExpert: true },
    { to: '/task-sources', label: 'Sources', requiresExpert: false },
    { to: '/tasks', label: 'Tasks', requiresExpert: false },
    { to: '/file-spaces', label: 'Files', requiresExpert: false },
    { to: '/sessions', label: 'Sessions', requiresExpert: true },
    { to: '/messages', label: 'Messages', requiresExpert: true },
    { to: '/worker-cache', label: 'Cache', requiresExpert: true },
    { to: '/pipeline-executions', label: 'Pipelines', requiresExpert: true },
    { to: '/pipeline-artifacts', label: 'Artifacts', requiresExpert: true },
    { to: '/admin', label: 'Admin', requiresExpert: true, isAdmin: true },
  ]

  const visibleNavItems = navItems.filter(item => !item.requiresExpert || expertMode)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-950 via-slate-900 to-slate-800">
      <nav className="sticky top-0 z-50 border-b border-white/10 bg-slate-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-lg">
        <div className="mx-auto px-6 max-w-7xl">
          <div className="flex h-14 items-center gap-8">
            <Link to="/" className="font-bold text-sm uppercase tracking-wider text-white transition-all hover:text-blue-400">
              ADI
            </Link>
            <div className="flex flex-1 gap-6">
              {visibleNavItems.map((item) => (
                <Link
                  key={item.to}
                  to={item.to}
                  className={`text-xs uppercase tracking-wide transition-all duration-200 hover:scale-105 ${
                    item.isAdmin
                      ? 'text-blue-400 hover:text-blue-300 font-semibold'
                      : 'text-gray-300 hover:text-white'
                  }`}
                >
                  {item.label}
                </Link>
              ))}
            </div>
            {projects.length > 0 && (
              <div className="flex items-center gap-2 border-l border-white/10 pl-6">
                <span className="text-xs text-gray-400 uppercase tracking-wider">Project:</span>
                <Select
                  value={selectedProjectId || ''}
                  onChange={(e) => setSelectedProjectId(e.target.value || null)}
                  className="w-48 h-9 text-xs"
                >
                  <option value="">All Projects</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </Select>
              </div>
            )}
            {/* User & Balance */}
            <div className="flex items-center gap-4 border-l border-white/10 pl-6">
              <div className="flex items-center gap-2">
                <DollarSign className="h-4 w-4 text-green-400" />
                <span className="text-xs font-semibold text-green-400">
                  {loadingUsage ? '...' : formatCost(balance)}
                </span>
              </div>
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>

      {/* Global Alerts */}
      {alerts.length > 0 && (
        <div className="bg-amber-500/10 border-b border-amber-500/30 backdrop-blur-md">
          {alerts.map((alert, index) => (
            <div key={index} className="mx-auto px-6 py-4 max-w-7xl">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-amber-100 font-medium mb-2">
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-amber-500/20 border border-amber-500/40 rounded-lg text-sm text-amber-100 hover:bg-amber-500/30 hover:border-amber-400/60 transition-colors"
                        >
                          <span className="font-medium">{project.name}</span>
                          <span className="text-amber-300">→</span>
                          <span className="text-xs text-amber-200">
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
