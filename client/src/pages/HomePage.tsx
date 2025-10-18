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
    <div className="mx-auto p-6 max-w-7xl min-h-[calc(100vh-3.5rem)]">
      <div className="mb-12 pt-8">
        <h1 className="text-6xl font-bold tracking-tight uppercase mb-4 bg-gradient-to-r from-gray-900 via-gray-700 to-gray-900 bg-clip-text text-transparent">ADI</h1>
        <p className="text-gray-600 text-sm uppercase tracking-wide">
          Database entity viewer for projects, tasks, sessions, and messages
        </p>
      </div>

      <div className="max-w-md">
        <Link to="/setup-project">
          <Card className="cursor-pointer transition-all duration-300 hover:scale-[1.02] hover:shadow-xl border-2 border-gray-300 hover:border-blue-500">
            <CardHeader>
              <CardTitle className="text-gray-900">Setup Project</CardTitle>
              <CardDescription>
                Create a new project in the system
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-gray-600">
                Create GitLab, Jira, or Parent projects with custom configuration
              </p>
            </CardContent>
          </Card>
        </Link>
      </div>
    </div>
  )
}
