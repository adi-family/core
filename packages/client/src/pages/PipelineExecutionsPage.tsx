import { useEffect, useState } from "react"
import { PageCard } from "@/components/PageCard"
import { PresenterTable } from "@/components/PresenterTable"
import { PipelineExecutionPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { PipelineExecution } from "../../../types"

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
    <div className="mx-auto">
      <PageCard
        title="Pipeline Executions"
        description="Monitor GitLab CI/CD pipeline executions"
      >
        <PresenterTable
          presenter={PipelineExecutionPresenter}
          items={executions}
          loading={loading}
          emptyMessage="No pipeline executions found"
        />
      </PageCard>
    </div>
  )
}
