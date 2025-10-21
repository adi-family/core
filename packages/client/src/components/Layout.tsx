import { Link, Outlet } from "react-router-dom"
import { UserButton } from '@clerk/clerk-react'

export function Layout() {
  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      <nav className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="mx-auto px-6">
          <div className="flex h-14 items-center gap-8">
            <Link to="/" className="font-bold text-sm uppercase tracking-wider text-gray-900 transition-all hover:text-blue-600">
              ADI
            </Link>
            <div className="flex flex-1 gap-6">
              <Link
                to="/projects"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Projects
              </Link>
              <Link
                to="/tasks"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Tasks
              </Link>
              <Link
                to="/sessions"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Sessions
              </Link>
              <Link
                to="/messages"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Messages
              </Link>
              <Link
                to="/worker-cache"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Cache
              </Link>
              <Link
                to="/file-spaces"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Files
              </Link>
              <Link
                to="/task-sources"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Sources
              </Link>
              <Link
                to="/pipeline-executions"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Pipelines
              </Link>
              <Link
                to="/pipeline-artifacts"
                className="text-xs uppercase tracking-wide text-gray-700 transition-all duration-200 hover:text-gray-900 hover:scale-105"
              >
                Artifacts
              </Link>
            </div>
            <div className="ml-auto">
              <UserButton afterSignOutUrl="/" />
            </div>
          </div>
        </div>
      </nav>
      <main className="relative">
        <Outlet />
      </main>
    </div>
  )
}
