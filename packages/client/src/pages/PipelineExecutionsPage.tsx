import { ListPage } from "@/components/ListPage"
import { PipelineExecutionPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { PipelineExecution } from "../../../types"

export function PipelineExecutionsPage() {
  return (
    <ListPage<PipelineExecution>
      title="Pipeline Executions"
      description="Monitor GitLab CI/CD pipeline executions"
      fetchFn={() => client['pipeline-executions'].$get()}
      presenter={PipelineExecutionPresenter}
      emptyMessage="No pipeline executions found"
      pollInterval={30000} // Auto-refresh every 30 seconds
    />
  )
}
