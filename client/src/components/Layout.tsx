import { Link, Outlet } from "react-router-dom"

export function Layout() {
  return (
    <div className="min-h-screen bg-background">
      <nav className="border-b">
        <div className="container mx-auto px-4">
          <div className="flex h-16 items-center gap-6">
            <Link to="/" className="font-semibold text-lg">
              ADI Simple
            </Link>
            <div className="flex gap-4">
              <Link
                to="/tasks"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Tasks
              </Link>
              <Link
                to="/sessions"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Sessions
              </Link>
              <Link
                to="/messages"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Messages
              </Link>
              <Link
                to="/worker-cache"
                className="text-sm font-medium transition-colors hover:text-primary"
              >
                Worker Cache
              </Link>
            </div>
          </div>
        </div>
      </nav>
      <main>
        <Outlet />
      </main>
    </div>
  )
}
