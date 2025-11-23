import { Link, Outlet } from "react-router-dom"
import { useAuth } from '@clerk/clerk-react'
import { useEffect, useMemo, useState } from "react"
import { useSnapshot } from "valtio"
import { AlertCircle } from "lucide-react"
import { createAuthenticatedClient } from "@/lib/client"
import { HOTKEYS } from "@/consts/hotkeys"
import { designTokens } from "@/theme/tokens"
import { KeyboardShortcutsHelp } from "@/components/KeyboardShortcutsHelp"
import { CommandCenter } from "@/components/CommandCenter"
import { Sidebar } from "@/components/Sidebar"
import {
  fetchProjects,
  alertsStore,
  fetchAlerts,
  fetchUsageMetrics
} from "@/stores"

export function Layout() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { alerts } = useSnapshot(alertsStore)

  // Sidebar state with localStorage persistence
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(() => {
    const stored = localStorage.getItem('sidebar-collapsed')
    return stored ? JSON.parse(stored) : false
  })

  // Toggle sidebar
  const toggleSidebar = () => {
    setIsSidebarCollapsed((prev: boolean) => {
      const newValue = !prev
      localStorage.setItem('sidebar-collapsed', JSON.stringify(newValue))
      return newValue
    })
  }

  // Keyboard shortcut to toggle sidebar
  useEffect(() => {
    const hotkey = HOTKEYS.ToggleSidebar
    const handleKeyDown = (e: KeyboardEvent) => {
      const modifierMatch = hotkey.ctrlOrCmd ? (e.ctrlKey || e.metaKey) : true
      const shiftMatch = hotkey.shift ? e.shiftKey : !e.shiftKey

      if (e.key === hotkey.key && modifierMatch && shiftMatch) {
        e.preventDefault()
        toggleSidebar()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  useEffect(() => {
    const fetchData = async () => {
      await Promise.all([
        fetchProjects(client),
        fetchAlerts(client),
        fetchUsageMetrics(client),
      ])
    }

    fetchData()
  }, [client])

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} flex flex-col`}>
      {/* Global Alerts - Only shown when present */}
      {alerts.length > 0 && (
        <div className="bg-neutral-500/10 border-b border-neutral-500/30">
          {alerts.map((alert, index) => (
            <div key={index} className={`${designTokens.spacing.pageContainer} py-4`}>
              <div className="flex items-start gap-3">
                <AlertCircle className={`${designTokens.icons.standard} text-neutral-400 flex-shrink-0 mt-0.5`} />
                <div className="flex-1">
                  <p className={`${designTokens.text.body} text-neutral-100 font-medium mb-2`}>
                    {alert.message}
                  </p>
                  <div className={`flex flex-wrap ${designTokens.spacing.listItem}`}>
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
                          className="inline-flex items-center gap-2 px-3 py-1.5 bg-neutral-500/20 border border-neutral-500/40 rounded-lg text-[13px] text-neutral-100 hover:bg-neutral-500/30 transition-colors"
                        >
                          <span className="font-medium">{project.name}</span>
                          <span className="text-neutral-300">→</span>
                          <span className={designTokens.text.caption}>
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

      {/* Main Content Area with Sidebar */}
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar */}
        <aside className={`${isSidebarCollapsed ? 'w-16' : 'w-64'} transition-all duration-300 ease-in-out overflow-hidden flex-shrink-0`}>
          <div className="h-full overflow-y-auto">
            <Sidebar isCollapsed={isSidebarCollapsed} onToggle={toggleSidebar} />
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 overflow-y-auto">
          <Outlet />
        </main>
      </div>

      {/* Global Keyboard Shortcuts Help */}
      <KeyboardShortcutsHelp />

      {/* Command Center */}
      <CommandCenter
        isSidebarCollapsed={isSidebarCollapsed}
        toggleSidebar={toggleSidebar}
      />
    </div>
  )
}
