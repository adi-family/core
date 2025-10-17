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
import type { TaskSource } from "../../../backend/types"

export function TaskSourcesPage() {
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTaskSources = async () => {
      const res = await client["task-sources"].$get()
      if (!res.ok) {
        console.error("Error fetching task sources:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setTaskSources(data)
      setLoading(false)
    }

    fetchTaskSources().catch((error) => {
      console.error("Error fetching task sources:", error)
      setLoading(false)
    })
  }, [])

  const formatConfig = (config: unknown): string => {
    try {
      return JSON.stringify(config, null, 2)
    } catch {
      return String(config)
    }
  }

  const getTaskSourceTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'gitlab_issues':
        return 'bg-orange-100 text-orange-800 ring-orange-500/10'
      case 'jira':
        return 'bg-blue-100 text-blue-800 ring-blue-500/10'
      case 'github_issues':
        return 'bg-gray-900 text-white ring-gray-500/10'
      default:
        return 'bg-gray-100 text-gray-800 ring-gray-500/10'
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Task Sources</CardTitle>
          <CardDescription>Manage issue tracking integrations for projects</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : taskSources.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No task sources found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {taskSources.map((taskSource) => (
                  <TableRow key={taskSource.id}>
                    <TableCell className="font-medium">{taskSource.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getTaskSourceTypeBadgeClass(taskSource.type)}`}>
                        {taskSource.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {taskSource.project_id}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <pre className="text-xs overflow-auto bg-muted p-2 rounded">
                        {formatConfig(taskSource.config)}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        taskSource.enabled
                          ? 'bg-green-100 text-green-800 ring-green-500/10'
                          : 'bg-gray-100 text-gray-800 ring-gray-500/10'
                      }`}>
                        {taskSource.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(taskSource.created_at).toLocaleString()}
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
