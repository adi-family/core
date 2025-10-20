import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { PresenterTable } from "@/components/PresenterTable"
import { SessionPresenter } from "@/presenters"
import { client } from "@/lib/client"
import type { Session } from "../../../types"

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      const res = await client.sessions.$get()
      if (!res.ok) {
        console.error("Error fetching sessions:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setSessions(data)
      setLoading(false)
    }

    fetchSessions().catch((error) => {
      console.error("Error fetching sessions:", error)
      setLoading(false)
    })
  }, [])

  return (
    <div className="mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>View all sessions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          <PresenterTable
            presenter={SessionPresenter}
            items={sessions}
            loading={loading}
            emptyMessage="No sessions found"
          />
        </CardContent>
      </Card>
    </div>
  )
}
