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
          Database entity viewer for projects, tasks, sessions, and messages
        </p>
      </div>

      <div className="max-w-md mx-auto">
        <Link to="/setup-project">
          <Card className="cursor-pointer transition-colors hover:bg-muted/50 border-primary">
            <CardHeader>
              <CardTitle>Setup Project</CardTitle>
              <CardDescription>
                Create a new project in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Create GitLab, Jira, or Parent projects with custom configuration
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
