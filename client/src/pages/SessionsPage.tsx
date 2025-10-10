import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

interface Session {
  id: string
  task_id: string | null
  runner: string
  created_at: string
  updated_at: string
}

export function SessionsPage() {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch("/api/sessions")
      .then((res) => res.json())
      .then((data) => {
        setSessions(data)
        setLoading(false)
      })
      .catch((error) => {
        console.error("Error fetching sessions:", error)
        setLoading(false)
      })
  }, [])

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Sessions</CardTitle>
          <CardDescription>View all sessions in the system</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : sessions.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No sessions found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>ID</TableHead>
                  <TableHead>Task ID</TableHead>
                  <TableHead>Runner</TableHead>
                  <TableHead>Created At</TableHead>
                  <TableHead>Updated At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sessions.map((session) => (
                  <TableRow key={session.id}>
                    <TableCell className="font-mono text-xs">
                      {session.id.substring(0, 8)}...
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {session.task_id
                        ? `${session.task_id.substring(0, 8)}...`
                        : "-"}
                    </TableCell>
                    <TableCell className="font-medium">
                      {session.runner}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(session.created_at).toLocaleString()}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(session.updated_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
