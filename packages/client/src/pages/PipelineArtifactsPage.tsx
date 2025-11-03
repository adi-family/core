import { useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import { ListPage } from "@/components/ListPage"
import { PipelineArtifactPresenter } from "@/presenters"
import { createAuthenticatedClient } from "@/lib/client"
import type { PipelineArtifact } from "../../../types"

export function PipelineArtifactsPage() {
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])

  const fetchFn = async () => {
    const { listPipelineArtifactsConfig } = await import('@adi/api-contracts/pipeline-executions')
    return client.run(listPipelineArtifactsConfig, {})
  }

  return (
    <ListPage<PipelineArtifact>
      title="Pipeline Artifacts"
      description="View merge requests and execution results from pipelines"
      fetchFn={fetchFn}
      presenter={PipelineArtifactPresenter}
      emptyMessage="No pipeline artifacts found"
    />
  )
}
