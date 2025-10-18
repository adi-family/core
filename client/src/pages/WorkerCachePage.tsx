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
import { Badge } from "@/components/ui/badge"
import { client } from "@/lib/client"
import { Loader2, CheckCircle2, Circle } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

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

  const getStatusBadgeVariant = (status: string | null): 'warning' | 'success' | 'gray' => {
    if (status === "processing") {
      return "warning"
    }
    if (status === "completed") {
      return "success"
    }
    return "gray"
  }

  const getStatusBadgeIcon = (status: string | null): LucideIcon => {
    if (status === "processing") {
      return Loader2
    }
    if (status === "completed") {
      return CheckCircle2
    }
    return Circle
  }

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
    <div className="mx-auto p-6 max-w-7xl">
      <Card>
        <CardHeader>
          <CardTitle>Worker Cache</CardTitle>
          <CardDescription>View worker processing status and locks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-8 text-sm uppercase tracking-wide text-gray-500">Loading...</div>
          ) : cache.length === 0 ? (
            <div className="text-center py-8 text-sm uppercase tracking-wide text-gray-500">
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
                      <Badge
                        variant={getStatusBadgeVariant(entry.status)}
                        icon={getStatusBadgeIcon(entry.status)}
                      >
                        {entry.status || "unknown"}
                      </Badge>
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
