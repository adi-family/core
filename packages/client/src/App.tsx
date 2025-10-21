import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react"
import { Toaster } from "sonner"
import { Layout } from "./components/Layout"
import { HomePage } from "./pages/HomePage"
import { ProjectsPage } from "./pages/ProjectsPage"
import { ProjectPage } from "./pages/ProjectPage"
import { SetupProjectPage } from "./pages/SetupProjectPage"
import { TasksPage } from "./pages/TasksPage"
import { SessionsPage } from "./pages/SessionsPage"
import { MessagesPage } from "./pages/MessagesPage"
import { WorkerCachePage } from "./pages/WorkerCachePage"
import { FileSpacesPage } from "./pages/FileSpacesPage"
import { TaskSourcesPage } from "./pages/TaskSourcesPage"
import { CreateTaskSourcePage } from "./pages/CreateTaskSourcePage"
import { PipelineExecutionsPage } from "./pages/PipelineExecutionsPage"
import { PipelineArtifactsPage } from "./pages/PipelineArtifactsPage"
import { DebugGitlabSecretPage } from "./pages/DebugGitlabSecretPage"

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
      <Routes>
        <Route
          path="/sign-in/*"
          element={
            <>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
              <SignedOut>
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
                  <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                      <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
                        ADI SIMPLE
                      </h1>
                      <p className="text-xs uppercase tracking-wide text-gray-600">
                        TASK AUTOMATION PLATFORM
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <SignIn routing="path" path="/sign-in" signUpUrl="/sign-up" />
                    </div>
                  </div>
                </div>
              </SignedOut>
            </>
          }
        />
        <Route
          path="/sign-up/*"
          element={
            <>
              <SignedIn>
                <Navigate to="/" replace />
              </SignedIn>
              <SignedOut>
                <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100 flex items-center justify-center p-6">
                  <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                      <h1 className="text-6xl font-bold mb-2 bg-gradient-to-r from-gray-900 to-gray-700 bg-clip-text text-transparent tracking-tight">
                        ADI SIMPLE
                      </h1>
                      <p className="text-xs uppercase tracking-wide text-gray-600">
                        TASK AUTOMATION PLATFORM
                      </p>
                    </div>
                    <div className="flex justify-center">
                      <SignUp routing="path" path="/sign-up" signInUrl="/sign-in" />
                    </div>
                  </div>
                </div>
              </SignedOut>
            </>
          }
        />
        <Route
          path="*"
          element={
            <>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
              <SignedIn>
                <Routes>
                  <Route path="/" element={<Layout />}>
                    <Route index element={<HomePage />} />
                    <Route path="projects" element={<ProjectsPage />} />
                    <Route path="projects/:id" element={<ProjectPage />} />
                    <Route path="setup-project" element={<SetupProjectPage />} />
                    <Route path="tasks" element={<TasksPage />} />
                    <Route path="sessions" element={<SessionsPage />} />
                    <Route path="messages" element={<MessagesPage />} />
                    <Route path="worker-cache" element={<WorkerCachePage />} />
                    <Route path="file-spaces" element={<FileSpacesPage />} />
                    <Route path="task-sources" element={<TaskSourcesPage />} />
                    <Route path="create-task-source" element={<CreateTaskSourcePage />} />
                    <Route path="pipeline-executions" element={<PipelineExecutionsPage />} />
                    <Route path="pipeline-artifacts" element={<PipelineArtifactsPage />} />
                    <Route path="debug" element={<DebugGitlabSecretPage />} />
                  </Route>
                </Routes>
              </SignedIn>
            </>
          }
        />
      </Routes>
    </BrowserRouter>
  )
}
