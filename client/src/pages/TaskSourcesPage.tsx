import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { TaskSourcePresenter } from "@/presenters"
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

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Task Sources</CardTitle>
          <CardDescription>Manage issue tracking integrations for projects</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenterTable
            presenter={TaskSourcePresenter}
            items={taskSources}
            loading={loading}
            emptyMessage="No task sources found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
