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
import { client } from "@/lib/client"

type WorkerCache = {
  id: number
  issue_id: string
  repo: string
  last_processed_at: string
  status: string | null
  task_id: string | null
  processing_started_at: string | null
  processing_worker_id: string | null
  created_at: string
  updated_at: string
}

export function WorkerCachePage() {
  const [cache, setCache] = useState<WorkerCache[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchCache = async () => {
      const res = await client["worker-cache"].$get()
      if (!res.ok) {
        console.error("Error fetching worker cache:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setCache(data)
      setLoading(false)
    }

    fetchCache().catch((error) => {
      console.error("Error fetching worker cache:", error)
      setLoading(false)
    })

    const interval = setInterval(() => {
      fetchCache().catch(console.error)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>Worker Cache</CardTitle>
          <CardDescription>View worker processing status and locks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : cache.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No cache entries found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue ID</TableHead>
                  <TableHead>Repo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Worker ID</TableHead>
                  <TableHead>Processing Started</TableHead>
                  <TableHead>Last Processed</TableHead>
                  <TableHead>Task ID</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {cache.map((entry) => (
                  <TableRow key={entry.id}>
                    <TableCell className="font-mono text-xs">
                      {entry.issue_id}
                    </TableCell>
                    <TableCell className="font-medium">{entry.repo}</TableCell>
                    <TableCell>
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                          entry.status === "processing"
                            ? "bg-yellow-50 text-yellow-800 ring-yellow-600/20"
                            : entry.status === "completed"
                            ? "bg-green-50 text-green-800 ring-green-600/20"
                            : "bg-gray-50 text-gray-800 ring-gray-600/20"
                        }`}
                      >
                        {entry.status || "unknown"}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.processing_worker_id || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.processing_started_at
                        ? new Date(entry.processing_started_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {entry.last_processed_at
                        ? new Date(entry.last_processed_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="font-mono text-xs">
                      {entry.task_id ? `${entry.task_id.substring(0, 8)}...` : "-"}
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
