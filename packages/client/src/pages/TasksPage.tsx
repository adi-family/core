import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Select } from "@/components/ui/select"
import { Label } from "@/components/ui/label"
import { PresenterTable } from "@/components/PresenterTable"
import { TaskPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Task, TaskSource } from "../../../types"

export function TasksPage() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedTaskSourceId, setSelectedTaskSourceId] = useState<string>("")

  const fetchData = async () => {
    setLoading(true)
    const [tasksRes, taskSourcesRes] = await Promise.all([
      client.tasks.$get(),
      client["task-sources"].$get({
        query: {}
      })
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
    <div className="mx-auto">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-accent-teal to-accent-cyan text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">Tasks</CardTitle>
          <CardDescription className="text-gray-300">View all tasks in the system</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
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
