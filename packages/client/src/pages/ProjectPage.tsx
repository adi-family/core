import { useEffect, useState, useMemo } from "react"
import { useParams, useNavigate, useSearchParams } from "react-router-dom"
import { useAuth } from "@clerk/clerk-react"
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { Button } from '@adi-simple/ui/button'
import { ArrowLeft } from "lucide-react"
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
      <AnimatedPageContainer>
        <Card className="border-slate-700/50 bg-slate-800/40 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-300">
              <div className="text-lg">Loading project...</div>
            </div>
          </CardContent>
        </Card>
      </AnimatedPageContainer>
    )
  }

  if (error) {
    return (
      <AnimatedPageContainer>
        <Card className="border-slate-700/50 bg-slate-800/40 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center py-8">
              <div className="text-red-400 text-lg mb-6">{error}</div>
              <Button
                onClick={() => navigate("/projects")}
                variant="outline"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Projects
              </Button>
            </div>
          </CardContent>
        </Card>
      </AnimatedPageContainer>
    )
  }

  if (!project) {
    return (
      <AnimatedPageContainer>
        <Card className="border-slate-700/50 bg-slate-800/40 backdrop-blur-xl shadow-2xl rounded-2xl">
          <CardContent className="pt-6">
            <div className="text-center py-8 text-gray-300">
              <div className="text-lg">Project not found</div>
            </div>
          </CardContent>
        </Card>
      </AnimatedPageContainer>
    )
  }

  const tabs: { id: TabType; label: string }[] = [
    { id: "overview", label: "OVERVIEW" },
    { id: "configuration", label: "SOURCE SETTINGS" },
    { id: "ai-providers", label: "AI PROVIDERS" },
  ]

  return (
    <AnimatedPageContainer>
      <div className="mb-6">
        <Button
          onClick={() => navigate("/projects")}
          variant="ghost"
          className="text-gray-300 hover:text-white -ml-2"
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Back to Projects
        </Button>
      </div>

      {/* Project Header */}
      <div className="mb-8">
        <h1 className="text-5xl font-bold tracking-tight uppercase mb-3 bg-gradient-to-r from-white via-gray-200 to-white bg-clip-text text-transparent">
          {project.name}
        </h1>
        <p className="text-gray-400 text-sm uppercase tracking-wide">
          Project Configuration & Management
        </p>
      </div>

      <Card className={`border-slate-700/50 bg-slate-800/40 backdrop-blur-xl shadow-2xl hover:shadow-blue-500/10 ${designTokens.animations.hover} rounded-2xl`}>
        <CardHeader className="bg-gradient-to-r from-teal-500 to-cyan-600 text-white rounded-t-2xl border-b border-white/10">
          <CardTitle className="text-xl uppercase tracking-wider font-semibold">
            Settings
          </CardTitle>
          <CardDescription className="text-gray-100 text-sm">
            Configure your project settings and integrations
          </CardDescription>
        </CardHeader>

        {/* Tabs */}
        <div className="border-b border-slate-700/50 bg-slate-900/30">
          <div className="flex gap-1 px-6">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-6 py-4 text-xs uppercase tracking-wider font-semibold transition-all duration-200 border-b-2 relative ${
                  activeTab === tab.id
                    ? "border-cyan-400 text-cyan-400 bg-slate-800/50"
                    : "border-transparent text-gray-400 hover:text-gray-200 hover:bg-slate-800/30"
                }`}
              >
                {tab.label}
                {activeTab === tab.id && (
                  <div className="absolute inset-x-0 top-0 h-0.5 bg-gradient-to-r from-transparent via-cyan-400 to-transparent" />
                )}
              </button>
            ))}
          </div>
        </div>

        <CardContent className="p-8">
          {activeTab === "overview" && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
                  Project ID
                </label>
                <p className="text-base font-mono text-gray-200 break-all">{project.id}</p>
              </div>

              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
                  Project Name
                </label>
                <p className="text-lg font-medium text-white">{project.name}</p>
              </div>

              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-3 block">
                  Status
                </label>
                <span
                  className={`inline-flex items-center px-4 py-2 text-sm font-semibold uppercase tracking-wide backdrop-blur-sm rounded-lg ${
                    project.enabled
                      ? "bg-green-500/20 text-green-300 border border-green-500/40 shadow-lg shadow-green-500/10"
                      : "bg-slate-700/40 text-gray-300 border border-slate-600/60"
                  }`}
                >
                  {project.enabled ? "● Enabled" : "○ Disabled"}
                </span>
              </div>

              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
                  Created At
                </label>
                <p className="text-base text-gray-200">
                  {new Date(project.created_at).toLocaleString()}
                </p>
              </div>

              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
                  Last Updated
                </label>
                <p className="text-base text-gray-200">
                  {new Date(project.updated_at).toLocaleString()}
                </p>
              </div>

              <div className="bg-slate-700/20 backdrop-blur-sm rounded-lg p-5 border border-slate-600/30">
                <label className="text-xs uppercase tracking-wider text-gray-400 font-semibold mb-2 block">
                  Last Synced At
                </label>
                <p className="text-base text-gray-200">
                  {project.last_synced_at ? (
                    <span>{new Date(project.last_synced_at).toLocaleString()}</span>
                  ) : (
                    <span className="text-gray-400 italic">Never synced</span>
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
        </CardContent>
      </Card>
    </AnimatedPageContainer>
  )
}
