import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { Button } from '@adi-simple/ui/button'
import { ArrowLeft, Settings } from "lucide-react"
import { createAuthenticatedClient } from "@/lib/client"
import type { Project } from "../../../types"
import { GitlabExecutorConfig } from "@/components/GitlabExecutorConfig"
import { AIProviderSettings } from "@/components/AIProviderSettings"
import { designTokens } from "@/theme/tokens"
import { getProjectConfig } from "@adi/api-contracts/projects"

type TabType = "overview" | "configuration" | "ai-providers"

export function ProjectPage() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const [project, setProject] = useState<Project | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Get initial tab from URL query parameter or default to overview
  const initialTab = (searchParams.get("tab") as TabType) || "overview"
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  useEffect(() => {
    const fetchProject = async () => {
      if (!id) {
        setError("No project ID provided")
        setLoading(false)
        return
      }

      try {
        const data = await client.run(getProjectConfig, {
          params: { id },
        })
        setProject(data)
        setLoading(false)
      } catch {
        setError("Error fetching project")
        setLoading(false)
      }
    }

    fetchProject()
     
  }, [id])

  if (loading) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
        <div className={designTokens.cards.default}>
          <div className="p-6 text-center py-12">
            <div className={designTokens.text.bodySecondary}>Loading project...</div>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
        <div className={designTokens.cards.default}>
          <div className="p-6 text-center py-12">
            <div className={`${designTokens.text.bodySecondary} mb-6`}>{error}</div>
            <Button
              onClick={() => navigate("/projects")}
              variant="outline"
            >
              <ArrowLeft className="mr-2 h-4 w-4" />
              Back to Projects
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!project) {
    return (
      <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
        <div className={designTokens.cards.default}>
          <div className="p-6 text-center py-12">
            <div className={designTokens.text.bodySecondary}>Project not found</div>
          </div>
        </div>
      </div>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "configuration", label: "SOURCE SETTINGS" },
    { id: "ai-providers", label: "AI PROVIDERS" },
  ]

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Back Button */}
      <div className="mb-6">
        <Button
          onClick={() => navigate("/projects")}
          variant="ghost"
          className="text-neutral-300 hover:text-white -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Settings className="h-8 w-8 text-white" />
          <h1 className={designTokens.text.mode}>{project.name}</h1>
        </div>
        <p className={designTokens.text.bodySecondary}>
          Project Configuration & Management
        </p>
      </div>

      {/* Tabs */}
      <div className={`${designTokens.cards.default} mb-6`}>
        <div className="flex gap-1 px-6 border-b border-neutral-700/50">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`px-6 py-4 text-xs uppercase tracking-wider font-semibold transition-all duration-200 border-b-2 relative ${
                activeTab === tab.id
                  ? "border-neutral-400 text-white bg-neutral-800/50"
                  : "border-transparent text-neutral-400 hover:text-neutral-200 hover:bg-neutral-800/30"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2 block">
                  Project ID
                </label>
                <p className="text-base font-mono text-neutral-200 break-all">{project.id}</p>
              </div>

              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2 block">
                  Project Name
                </label>
                <p className="text-lg font-medium text-white">{project.name}</p>
              </div>

              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-3 block">
                  Status
                </label>
                <span
                  className={`inline-flex items-center px-4 py-2 text-sm font-semibold uppercase tracking-wide backdrop-blur-sm rounded-lg ${
                    project.enabled
                      ? "bg-neutral-500/20 text-neutral-300 border border-neutral-500/40 shadow-lg shadow-neutral-500/10"
                      : "bg-neutral-700/40 text-neutral-300 border border-neutral-600/60"
                  }`}
                >
                  {project.enabled ? "● Enabled" : "○ Disabled"}
                </span>
              </div>

              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2 block">
                  Created At
                </label>
                <p className="text-base text-neutral-200">
                  {new Date(project.created_at).toLocaleString()}
                </p>
              </div>

              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2 block">
                  Last Updated
                </label>
                <p className="text-base text-neutral-200">
                  {new Date(project.updated_at).toLocaleString()}
                </p>
              </div>

              <div className="bg-neutral-700/20 backdrop-blur-sm rounded-lg p-5 border border-neutral-600/30">
                <label className="text-xs uppercase tracking-wider text-neutral-400 font-semibold mb-2 block">
                  Last Synced At
                </label>
                <p className="text-base text-neutral-200">
                  {project.last_synced_at ? (
                    <span>{new Date(project.last_synced_at).toLocaleString()}</span>
                  ) : (
                    <span className="text-neutral-400 italic">Never synced</span>
                  )}
                </p>
              </div>
            </div>
          )}

          {activeTab === "configuration" && (
            <GitlabExecutorConfig projectId={project.id} />
          )}

          {activeTab === "ai-providers" && (
            <AIProviderSettings projectId={project.id} />
          )}
        </div>
      </div>
    </div>
  )
}
