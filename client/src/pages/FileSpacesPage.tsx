import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { FileSpacePresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { FileSpace } from "../../../types"

export function FileSpacesPage() {
  const [fileSpaces, setFileSpaces] = useState<FileSpace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFileSpaces = async () => {
      const res = await (client as any)["file-spaces"].$get()
      if (!res.ok) {
        console.error("Error fetching file spaces:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json() as any
      setFileSpaces(data)
      setLoading(false)
    }

    fetchFileSpaces().catch((error) => {
      console.error("Error fetching file spaces:", error)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>File Spaces</CardTitle>
          <CardDescription>Manage repository file spaces for tasks</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenterTable
            presenter={FileSpacePresenter}
            items={fileSpaces}
            loading={loading}
            emptyMessage="No file spaces found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
