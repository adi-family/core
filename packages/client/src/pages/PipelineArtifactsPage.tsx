import { ListPage } from "@/components/ListPage"
import { PipelineArtifactPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { PipelineArtifact } from "../../../types"

export function PipelineArtifactsPage() {
  return (
    <ListPage<PipelineArtifact>
      title="Pipeline Artifacts"
      description="View merge requests and execution results from pipelines"
      fetchFn={() => client['pipeline-artifacts'].$get()}
      presenter={PipelineArtifactPresenter}
      emptyMessage="No pipeline artifacts found"
    />
  )
}
