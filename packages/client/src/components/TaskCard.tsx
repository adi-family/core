import { Badge } from '@adi-simple/ui/badge'
import { Button } from '@adi-simple/ui/button'
import { Card, CardContent, CardHeader } from '@adi-simple/ui/card'
import { Circle, Calendar, ExternalLink } from "lucide-react"
import type { Task, TaskSource } from "@types"
import { navigateTo } from "@/utils/navigation"

interface TaskCardProps {
  task: Task
  taskSources: TaskSource[]
}

/**
 * TaskCard component displays a task in a block/card format with all statuses visible
 */
export function TaskCard({ task, taskSources }: TaskCardProps) {
  const taskSource = taskSources.find((ts) => ts.id === task.task_source_id)

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const truncateId = (id: string) => {
    return id.length > 8 ? `${id.slice(0, 8)}...` : id
  }

  const getStatusVariant = (status: string) => {
    const statusLower = status.toLowerCase()
    if (statusLower.includes("complete") || statusLower.includes("done")) return "success"
    if (statusLower.includes("progress") || statusLower.includes("active")) return "info"
    if (statusLower.includes("fail") || statusLower.includes("error")) return "danger"
    if (statusLower.includes("pending") || statusLower.includes("new")) return "warning"
    return "default"
  }

  const getTaskSourceTypeVariant = (type: string) => {
    const typeLower = type.toLowerCase()
    if (typeLower === "gitlab") return "orange"
    if (typeLower === "github") return "purple"
    if (typeLower === "jira") return "blue"
    return "gray"
  }

  return (
    <Card className="border-gray-200/60 bg-white/90 backdrop-blur-md shadow-md hover:shadow-xl transition-all duration-200 hover:border-accent-teal/40">
      <CardHeader className="pb-3 bg-gradient-to-r from-gray-50 to-gray-100/50 border-b border-gray-200/60">
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <h3 className="text-lg font-semibold text-gray-900 mb-1 truncate">
              {task.title}
            </h3>
            <p className="text-xs font-mono text-gray-500">
              ID: {truncateId(task.id)}
            </p>
          </div>
          <Badge variant={getStatusVariant(task.status)} icon={Circle} className="shrink-0">
            {task.status}
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="pt-4 space-y-4">
        {/* Description */}
        <div>
          <p className="text-sm text-gray-700 line-clamp-2">
            {task.description}
          </p>
        </div>

        {/* Task Source Info */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-medium text-gray-600 uppercase tracking-wide">
            Source:
          </span>
          <span className="text-sm font-medium text-gray-900">
            {taskSource?.name || "Unknown"}
          </span>
          {taskSource?.type && (
            <Badge variant={getTaskSourceTypeVariant(taskSource.type)} className="text-xs">
              {taskSource.type}
            </Badge>
          )}
        </div>

        {/* Dates */}
        <div className="grid grid-cols-2 gap-3 pt-2 border-t border-gray-200/60">
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Created
              </p>
              <p className="text-xs text-gray-700 truncate">
                {formatDate(task.created_at)}
              </p>
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Calendar className="h-4 w-4 text-gray-400 mt-0.5 shrink-0" />
            <div className="min-w-0">
              <p className="text-xs font-medium text-gray-600 uppercase tracking-wide">
                Updated
              </p>
              <p className="text-xs text-gray-700 truncate">
                {formatDate(task.updated_at)}
              </p>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex gap-2 pt-2">
          <Button
            variant="default"
            size="sm"
            onClick={() => navigateTo(`/tasks/${task.id}`)}
            className="flex-1"
          >
            <ExternalLink className="h-4 w-4 mr-1" />
            View Details
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              // TODO: Implement update status
              console.log(`Update task ${task.id} status`)
            }}
            className="flex-1"
          >
            Update Status
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
