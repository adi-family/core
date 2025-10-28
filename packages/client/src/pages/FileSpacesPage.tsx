import { useNavigate } from "react-router-dom"
import { useMemo, useEffect, useState } from "react"
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
import { client } from "@/lib/client"
import { designTokens } from "@/theme/tokens"
import type { FileSpace, Project } from "@types"

export function FileSpacesPage() {
  const navigate = useNavigate()
  const { selectedProjectId } = useProject()
  const [fileSpaces, setFileSpaces] = useState<FileSpace[]>([])
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  const fetchData = async () => {
    setLoading(true)
    const [fileSpacesRes, projectsRes] = await Promise.all([
      client["file-spaces"].$get({ query: {} }),
      client.projects.$get()
    ])

    if (!fileSpacesRes.ok) {
      console.error("Error fetching file spaces:", await fileSpacesRes.text())
      setLoading(false)
      return
    }

    if (!projectsRes.ok) {
      console.error("Error fetching projects:", await projectsRes.text())
      setLoading(false)
      return
    }

    const fileSpacesData = await fileSpacesRes.json()
    const projectsData = await projectsRes.json()

    setFileSpaces(fileSpacesData)
    setProjects(projectsData)
    setLoading(false)
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
            <div className="flex justify-center items-center py-12">
              <div className="text-gray-500">No file spaces found</div>
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
