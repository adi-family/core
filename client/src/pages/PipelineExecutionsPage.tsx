import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { PipelineExecutionPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { PipelineExecution } from "../../../backend/types"

export function PipelineExecutionsPage() {
  const [executions, setExecutions] = useState<PipelineExecution[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchExecutions = async () => {
      const res = await client['pipeline-executions'].$get()
      if (!res.ok) {
        console.error("Error fetching pipeline executions:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setExecutions(data)
      setLoading(false)
    }

    fetchExecutions().catch((error) => {
      console.error("Error fetching pipeline executions:", error)
      setLoading(false)
    })
  }, [])

  // Auto-refresh every 30 seconds
  useEffect(() => {
    const interval = setInterval(async () => {
      const res = await client['pipeline-executions'].$get()
      if (res.ok) {
        const data = await res.json()
        setExecutions(data)
      }
    }, 30000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">
            Pipeline Executions
          </CardTitle>
          <CardDescription className="text-gray-300">
            Monitor GitLab CI/CD pipeline executions
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <PresenterTable
            presenter={PipelineExecutionPresenter}
            items={executions}
            loading={loading}
            emptyMessage="No pipeline executions found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
