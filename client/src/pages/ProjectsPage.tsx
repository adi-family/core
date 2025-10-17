import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { ProjectPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Project } from "../../../backend/types"

export function ProjectsPage() {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      const res = await client.projects.$get()
      if (!res.ok) {
        console.error("Error fetching projects:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setProjects(data)
      setLoading(false)
    }

    fetchProjects().catch((error) => {
      console.error("Error fetching projects:", error)
      setLoading(false)
    })
  }, [])

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Projects</CardTitle>
          <CardDescription>Manage all projects in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenterTable
            presenter={ProjectPresenter}
            items={projects}
            loading={loading}
            emptyMessage="No projects found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
