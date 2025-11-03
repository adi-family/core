import { useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { ListPage } from "@/components/ListPage"
import { PipelineExecutionPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import type { PipelineExecution } from "../../../types"

export function PipelineExecutionsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const fetchFn = async () => {
    const { listPipelineExecutionsConfig } = await import('@adi/api-contracts/pipeline-executions')
    return client.run(listPipelineExecutionsConfig, {})
  }

  return (
    <ListPage<PipelineExecution>
      title="Pipeline Executions"
      description="Monitor GitLab CI/CD pipeline executions"
      fetchFn={fetchFn}
      presenter={PipelineExecutionPresenter}
      emptyMessage="No pipeline executions found"
      pollInterval={30000} // Auto-refresh every 30 seconds
    />
  )
}
