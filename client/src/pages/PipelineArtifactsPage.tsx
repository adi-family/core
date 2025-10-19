import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { PipelineArtifactPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { PipelineArtifact } from "../../../backend/types"

export function PipelineArtifactsPage() {
  const [artifacts, setArtifacts] = useState<PipelineArtifact[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchArtifacts = async () => {
      const res = await client['pipeline-artifacts'].$get()
      if (!res.ok) {
        console.error("Error fetching pipeline artifacts:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setArtifacts(data)
      setLoading(false)
    }

    fetchArtifacts().catch((error) => {
      console.error("Error fetching pipeline artifacts:", error)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-gray-800 to-gray-900 text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">
            Pipeline Artifacts
          </CardTitle>
          <CardDescription className="text-gray-300">
            View merge requests and execution results from pipelines
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <PresenterTable
            presenter={PipelineArtifactPresenter}
            items={artifacts}
            loading={loading}
            emptyMessage="No pipeline artifacts found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
