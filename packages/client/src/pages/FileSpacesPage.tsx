import { useNavigate } from "react-router-dom"
import { useMemo, useEffect, useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { Button } from '@adi-simple/ui/button'
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import { AnimatedPageContainer } from "@/components/AnimatedPageContainer"
import { FileSpaceRow } from "@/components/FileSpaceRow"
import { useProject } from "@/contexts/ProjectContext"
import { createAuthenticatedClient } from "@/lib/client"
import { listFileSpacesConfig, listProjectsConfig } from "@adi/api-contracts"
import { designTokens } from "@/theme/tokens"
import type { FileSpace, Project } from "@types"

export function FileSpacesPage() {
  const navigate = useNavigate()
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
  const { selectedProjectId } = useProject()
  const [fileSpaces, setFileSpaces] = useState<FileSpace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    try {
      const [fileSpacesData, projectsData] = await Promise.all([
        client.run(listFileSpacesConfig, { query: {} }),
        client.run(listProjectsConfig)
      ])

      setFileSpaces(fileSpacesData)
      setProjects(projectsData)
    } catch (error) {
      console.error("Error fetching data:", error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData().catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [])

  // Filter file spaces by selected project
  const filteredFileSpaces = useMemo(() => {
    if (!selectedProjectId) {
      return fileSpaces
    }
    return fileSpaces.filter(fs => fs.project_id === selectedProjectId)
  }, [fileSpaces, selectedProjectId])

  return (
    <AnimatedPageContainer>
      <Card className={`bg-slate-800/40 backdrop-blur-xl border border-slate-700/50 shadow-2xl hover:shadow-blue-500/10 hover:border-slate-600/60 ${designTokens.animations.hover} ${designTokens.animations.fadeIn} rounded-2xl`}>
        <CardHeader className={`bg-gradient-to-r ${designTokens.gradients.cardHeader} text-white rounded-t-2xl`}>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className={`${designTokens.text.cardTitle} text-white`}>File Spaces</CardTitle>
              <CardDescription className={`${designTokens.text.cardDescription} text-gray-200`}>Manage repository file spaces for tasks</CardDescription>
            </div>
            <Button
              onClick={() => navigate("/create-file-space")}
              className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              Create File Space
            </Button>
          </div>
        </CardHeader>
        <CardContent className={`${designTokens.spacing.cardPadding} text-gray-100`}>
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">Loading file spaces...</div>
            </div>
          ) : filteredFileSpaces.length === 0 ? (
            <div className="flex flex-col justify-center items-center py-16 max-w-3xl mx-auto text-center">
              {/* Visual Icon Grid */}
              <div className="flex gap-6 mb-8 items-center justify-center">
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-blue-500/20 to-blue-600/20 border border-blue-500/30 flex items-center justify-center">
                  <svg className="w-10 h-10 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                </div>
                <div className="text-4xl text-gray-600">→</div>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-purple-500/20 to-purple-600/20 border border-purple-500/30 flex items-center justify-center">
                  <svg className="w-10 h-10 text-purple-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4" />
                  </svg>
                </div>
                <div className="text-4xl text-gray-600">→</div>
                <div className="w-20 h-20 rounded-2xl bg-gradient-to-br from-green-500/20 to-green-600/20 border border-green-500/30 flex items-center justify-center">
                  <svg className="w-10 h-10 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                  </svg>
                </div>
              </div>

              {/* Headline */}
              <div className="text-3xl font-bold text-gray-200 mb-3">Connect Your Codebase</div>

              {/* Short Description */}
              <p className="text-gray-400 text-lg mb-8 max-w-xl">
                Bots need access to your code to automate tasks and ship features
              </p>

              {/* CTA Button */}
              <Button
                onClick={() => navigate("/create-file-space")}
                size="lg"
                className="text-lg px-8 py-6 uppercase tracking-wide shadow-lg hover:shadow-xl active:scale-95 transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Create File Space
              </Button>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredFileSpaces.map((fileSpace) => {
                const project = projects.find((p) => p.id === fileSpace.project_id)
                return (
                  <FileSpaceRow
                    key={fileSpace.id}
                    fileSpace={fileSpace}
                    project={project}
                  />
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </AnimatedPageContainer>
  )
}
