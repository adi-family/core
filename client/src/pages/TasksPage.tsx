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
import type { Task, TaskSource } from "../../../backend/types"

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskSourceId, setSelectedTaskSourceId] = useState<string>("")

  useEffect(() => {
    const fetchData = async () => {
      const [tasksRes, taskSourcesRes] = await Promise.all([
        client.tasks.$get(),
        client["task-sources"].$get()
      ])

      if (!tasksRes.ok) {
        console.error("Error fetching tasks:", await tasksRes.text())
        setLoading(false)
        return
      }

      if (!taskSourcesRes.ok) {
        console.error("Error fetching task sources:", await taskSourcesRes.text())
        setLoading(false)
        return
      }

      const tasksData = await tasksRes.json()
      const taskSourcesData = await taskSourcesRes.json()

      if (!Array.isArray(tasksData)) {
        console.error("Invalid API response: expected array of tasks")
        setLoading(false)
        return
      }

      setTasks(tasksData)
      setTaskSources(taskSourcesData)
      setLoading(false)
    }

    fetchData().catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [])

  const filteredTasks = selectedTaskSourceId
    ? tasks.filter(task => task.task_source_id === selectedTaskSourceId)
    : tasks

  const getTaskSourceName = (taskSourceId: string | null): string => {
    if (!taskSourceId) return "N/A"
    const taskSource = taskSources.find(ts => ts.id === taskSourceId)
    return taskSource ? taskSource.name : "Unknown"
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Tasks</CardTitle>
          <CardDescription>View all tasks in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="mb-4">
            <label htmlFor="taskSourceFilter" className="block text-sm font-medium mb-2">
              Filter by Task Source
            </label>
            <select
              id="taskSourceFilter"
              value={selectedTaskSourceId}
              onChange={(e) => setSelectedTaskSourceId(e.target.value)}
              className="w-full max-w-xs px-3 py-2 border rounded-md"
            >
              <option value="">All Task Sources</option>
              {taskSources.map((taskSource) => (
                <option key={taskSource.id} value={taskSource.id}>
                  {taskSource.name} ({taskSource.type})
                </option>
              ))}
            </select>
          </div>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : filteredTasks.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No tasks found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Title</TableHead>
                  <TableHead>Description</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Task Source</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredTasks.map((task) => (
                  <TableRow key={task.id}>
                    <TableCell className="font-mono text-xs">
                      {task.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-medium">{task.title}</TableCell>
                    <TableCell className="max-w-md truncate">
                      {task.description || "-"}
                    </TableCell>
                    <TableCell>
                      <span className="inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ring-gray-500/10">
                        {task.status}
                      </span>
                    </TableCell>
                    <TableCell className="text-sm">
                      {getTaskSourceName(task.task_source_id)}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(task.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(task.updated_at).toLocaleString()}
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
