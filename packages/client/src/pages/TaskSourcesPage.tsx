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
    <div className="mx-auto">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-accent-teal to-accent-cyan text-white">
          <div className="flex justify-between items-center">
            <div>
              <CardTitle className="text-2xl uppercase tracking-wide">
                Task Sources
              </CardTitle>
              <CardDescription className="text-gray-300">
                Manage issue tracking integrations for projects
              </CardDescription>
            </div>
            <Button
              onClick={() => navigate("/create-task-source")}
              className="uppercase tracking-wide shadow-sm active:scale-95 transition-all duration-200"
            >
              Create Task Source
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-6">
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
