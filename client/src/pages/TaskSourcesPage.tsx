import { useEffect, useState } from "react"
import { useNavigate } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { PresenterTable } from "@/components/PresenterTable"
import { TaskSourcePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { TaskSource } from "../../../types"

export function TaskSourcesPage() {
  const navigate = useNavigate()
  const [taskSources, setTaskSources] = useState<TaskSource[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchTaskSources = async () => {
      const res = await client["task-sources"].$get({
        query: {}
      })
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
    <div className="mx-auto p-6 max-w-7xl">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md">
        <CardHeader>
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-xl uppercase tracking-wide bg-gradient-to-r from-gray-800 to-gray-900 bg-clip-text text-transparent">
                TASK SOURCES
              </CardTitle>
              <CardDescription className="text-xs uppercase tracking-wide">
                Manage issue tracking integrations for projects
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate("/create-task-source")}
              className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              CREATE TASK SOURCE
            </Button>
          </div>
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
