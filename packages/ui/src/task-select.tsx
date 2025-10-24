import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import { Circle, CircleDashed, CircleDot, CircleOff } from 'lucide-react'
import type { Task } from '@adi-simple/types'
import type { TaskApiClient } from './mock-client'

interface TaskSelectProps {
  client: TaskApiClient
  value: string
  onChange: (taskId: string) => void
  projectId?: string
  taskSourceId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showStatus?: boolean
}

export function TaskSelect({
  client,
  value,
  onChange,
  projectId,
  taskSourceId,
  required = false,
  label = "TASK",
  placeholder = "Search tasks...",
  showStatus = true,
}: TaskSelectProps) {
  const [tasks, setTasks] = useState<Task[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTasks = async () => {
      try {
        let res: Response
        if (taskSourceId) {
          res = await client.tasks["by-task-source"][":taskSourceId"].$get({
            param: { taskSourceId }
          })
        } else if (projectId) {
          res = await client.tasks["by-project"][":projectId"].$get({
            param: { projectId }
          })
        } else {
          res = await client.tasks.$get()
        }

        if (!res.ok) {
          console.error("Error fetching tasks:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setTasks(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching tasks:", error)
        setLoading(false)
      }
    }

    fetchTasks().catch((error) => {
      console.error("Error fetching tasks:", error)
      setLoading(false)
    })
  }, [projectId, taskSourceId])

  const getStatusIcon = (status: string) => {
    const iconSize = 16
    const statusMap: Record<string, React.ReactNode> = {
      open: <Circle size={iconSize} />,
      in_progress: <CircleDashed size={iconSize} />,
      done: <CircleDot size={iconSize} />,
      closed: <CircleOff size={iconSize} />,
    }
    return statusMap[status] || <Circle size={iconSize} />
  }

  const options = tasks.map((task) => ({
    value: task.id,
    label: task.title,
    icon: showStatus ? getStatusIcon(task.status) : undefined,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="task_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading tasks...</div>
      ) : (
        <Combobox
          id="task_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No tasks found"
        />
      )}
    </div>
  )
}
