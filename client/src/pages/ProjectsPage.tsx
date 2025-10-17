import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
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
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : projects.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No projects found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {projects.map((project) => (
                  <TableRow
                    key={project.id}
                    className="cursor-pointer hover:bg-muted/50"
                    onClick={() => window.location.href = `/projects/${project.id}`}
                  >
                    <TableCell className="font-medium">{project.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        project.enabled
                          ? 'bg-green-100 text-green-800 ring-green-500/10'
                          : 'bg-gray-100 text-gray-800 ring-gray-500/10'
                      }`}>
                        {project.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(project.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
