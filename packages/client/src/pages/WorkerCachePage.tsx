import { useEffect, useState, useMemo } from "react"
import { useAuth } from "@clerk/clerk-react"
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
import { getWorkerCacheConfig } from '@adi/api-contracts/worker-cache'
import { Loader2, CheckCircle2, Circle, Database } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import type { WorkerCache } from '@adi-simple/types'
import { designTokens } from "@/theme/tokens"

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
      try {
        const data = await client.run(getWorkerCacheConfig)
        setCache(data)
      } catch (error) {
        console.error("Error fetching worker cache:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchCache()

    const interval = setInterval(() => {
      fetchCache().catch(console.error)
    }, 5000)

    return () => clearInterval(interval)
  }, [])

  return (
    <div className={`min-h-screen ${designTokens.colors.bg.primary} px-6 py-8`}>
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Database className="h-8 w-8 text-white" />
          <h1 className={designTokens.text.mode}>Worker Cache</h1>
        </div>
        <p className={designTokens.text.bodySecondary}>
          View worker processing status and locks
        </p>
      </div>

      {/* Content */}
      <div className={designTokens.cards.default}>
        <div className="p-6">
          {loading ? (
            <div className="flex justify-center items-center py-12">
              <div className={designTokens.text.bodySecondary}>Loading...</div>
            </div>
          ) : cache.length === 0 ? (
            <div className="flex justify-center items-center py-12">
              <div className={designTokens.text.bodySecondary}>No cache entries found</div>
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Issue ID</TableHead>
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
                    <TableCell className="text-neutral-400 text-sm">
                      {entry.processing_started_at
                        ? new Date(entry.processing_started_at).toLocaleString()
                        : "-"}
                    </TableCell>
                    <TableCell className="text-neutral-400 text-sm">
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
        </div>
      </div>
    </div>
  )
}
