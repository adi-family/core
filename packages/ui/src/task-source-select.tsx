import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import type { TaskSource } from '@adi-simple/types'
import type { TaskSourceApiClient } from './mock-client'

interface TaskSourceSelectProps {
  client: TaskSourceApiClient
  value: string
  onChange: (taskSourceId: string) => void
  projectId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showType?: boolean
}

export function TaskSourceSelect({
  client,
  value,
  onChange,
  projectId,
  required = false,
  label = "TASK SOURCE",
  placeholder = "Search task sources...",
  showType = true,
}: TaskSourceSelectProps) {
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTaskSources = async () => {
      try {
        let res: Response
        if (projectId) {
          res = await client["task-sources"]["by-project"][":projectId"].$get({
            param: { projectId }
          })
        } else {
          res = await client["task-sources"].$get()
        }

        if (!res.ok) {
          console.error("Error fetching task sources:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setTaskSources(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching task sources:", error)
        setLoading(false)
      }
    }

    fetchTaskSources().catch((error) => {
      console.error("Error fetching task sources:", error)
      setLoading(false)
    })
  }, [projectId])

  const getTaskSourceTypeLabel = (type: string) => {
    switch (type) {
      case 'gitlab_issues':
        return 'GitLab'
      case 'github_issues':
        return 'GitHub'
      case 'jira':
        return 'Jira'
      default:
        return type
    }
  }

  const options = taskSources.map((taskSource) => ({
    value: taskSource.id,
    label: showType
      ? `${taskSource.name} (${getTaskSourceTypeLabel(taskSource.type)})`
      : taskSource.name,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="task_source_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading task sources...</div>
      ) : (
        <Combobox
          id="task_source_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No task sources found"
        />
      )}
    </div>
  )
}
