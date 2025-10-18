import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { PresenterTable } from "@/components/PresenterTable"
import { TaskPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Task, TaskSource } from "../../../backend/types"

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskSourceId, setSelectedTaskSourceId] = useState<string>("")

  const fetchData = async () => {
    setLoading(true)
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

  useEffect(() => {
    fetchData().catch((error) => {
      console.error("Error fetching data:", error)
      setLoading(false)
    })
  }, [])

  const filteredTasks = selectedTaskSourceId
    ? tasks.filter(task => task.task_source_id === selectedTaskSourceId)
    : tasks

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>View all tasks in the system</CardDescription>
            </div>
            <Button
              onClick={() => fetchData()}
              disabled={loading}
            >
              {loading ? "Syncing..." : "Sync"}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="mb-6">
            <Label htmlFor="taskSourceFilter" className="block mb-2">
              Filter by Task Source
            </Label>
            <Select
              id="taskSourceFilter"
              value={selectedTaskSourceId}
              onChange={(e) => setSelectedTaskSourceId(e.target.value)}
              className="max-w-xs"
            >
              <option value="">All Task Sources</option>
              {taskSources.map((taskSource) => (
                <option key={taskSource.id} value={taskSource.id}>
                  {taskSource.name} ({taskSource.type})
                </option>
              ))}
            </Select>
          </div>
          <PresenterTable
            presenter={TaskPresenter}
            items={filteredTasks}
            loading={loading}
            emptyMessage="No tasks found"
            buildPresenter={(task) => new TaskPresenter(task, taskSources)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
