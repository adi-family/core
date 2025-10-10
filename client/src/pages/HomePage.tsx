import { Link } from "react-router-dom"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"

export function HomePage() {
  return (
    <div className="container mx-auto py-10">
      <div className="mb-8">
        <h1 className="text-4xl font-bold tracking-tight">ADI Simple</h1>
        <p className="text-muted-foreground mt-2">
          Database entity viewer for tasks, sessions, and messages
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Link to="/tasks">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Tasks</CardTitle>
              <CardDescription>
                View and manage all tasks in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Track tasks with titles, descriptions, status, and source
                integrations
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/sessions">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Sessions</CardTitle>
              <CardDescription>
                Browse all sessions linked to tasks
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                View session details including runner information and timestamps
              </p>
            </CardContent>
          </Card>
        </Link>

        <Link to="/messages">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50">
            <CardHeader>
              <CardTitle>Messages</CardTitle>
              <CardDescription>
                Explore messages within sessions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Review message data and timestamps for each session
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
