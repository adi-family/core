import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@adi-simple/ui/card'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@adi-simple/ui/table'
import { Badge } from '@adi-simple/ui/badge'
import { createAuthenticatedClient } from "@/lib/client"
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
  const { getToken } = useAuth()
  const client = useMemo(() => createAuthenticatedClient(getToken), [getToken])
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
      const res = await (client as any)["worker-cache"].$get()
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
    <div className="mx-auto">
      <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-lg hover:shadow-xl transition-all duration-200">
        <CardHeader className="bg-gradient-to-r from-accent-teal to-accent-cyan text-white">
          <CardTitle className="text-2xl uppercase tracking-wide">Worker Cache</CardTitle>
          <CardDescription className="text-gray-300">View worker processing status and locks</CardDescription>
        </CardHeader>
        <CardContent className="p-6">
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
