import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
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
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>View all tasks in the system</CardDescription>
            </div>
            <button
              onClick={() => fetchData()}
              disabled={loading}
              className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Syncing..." : "Sync"}
            </button>
          </div>
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
