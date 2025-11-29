import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom"
import { SignedIn, SignedOut, SignIn, SignUp } from "@clerk/clerk-react"
import { Toaster } from "sonner"
import { ExpertModeProvider } from "./contexts/ExpertModeContext"
import { ProjectProvider } from "./contexts/ProjectContext"
import { designTokens } from "./theme/tokens"
import { Layout } from "./components/Layout"
import { RequireProject } from "./components/RequireProject"
import { CommandCenterPage } from "./pages/CommandCenterPage"
import { ShipModePage } from "./pages/ShipModePage"
import { ReviewModePage } from "./pages/ReviewModePage"
import { BuilderBoardPage } from "./pages/BuilderBoardPage"
import { AnalyticsPage } from "./pages/AnalyticsPage"
import { HomePage } from "./pages/HomePage"
import { ProjectsPage } from "./pages/ProjectsPage"
import { ProjectPage } from "./pages/ProjectPage"
import { SetupProjectPage } from "./pages/SetupProjectPage"
import { SetupFlowPage } from "./pages/SetupFlowPage"
import { TasksPage } from "./pages/TasksPage"
import { TaskPage } from "./pages/TaskPage"
import { SessionsPage } from "./pages/SessionsPage"
import { MessagesPage } from "./pages/MessagesPage"
import { WorkerCachePage } from "./pages/WorkerCachePage"
import { FileSpacesPage } from "./pages/FileSpacesPage"
import { CreateFileSpacePage } from "./pages/CreateFileSpacePage"
import { TaskSourcesPage } from "./pages/TaskSourcesPage"
import { CreateTaskSourcePage } from "./pages/CreateTaskSourcePage"
import { PipelineExecutionsPage } from "./pages/PipelineExecutionsPage"
import { PipelineArtifactsPage } from "./pages/PipelineArtifactsPage"
import { DebugGitlabSecretPage } from "./pages/DebugGitlabSecretPage"
import { AdminPage } from "./pages/AdminPage"
import { OAuthCallbackPage } from "./pages/OAuthCallbackPage"

export function App() {
  return (
    <ExpertModeProvider>
      <ProjectProvider>
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
                <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center p-6`}>
                  <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                      <h1 className="text-4xl font-semibold mb-2 text-white">
                        ADI
                      </h1>
                      <p className={`${designTokens.text.bodySecondary}`}>
                        Task automation platform
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
                <div className={`min-h-screen ${designTokens.colors.bg.primary} flex items-center justify-center p-6`}>
                  <div className="w-full max-w-md">
                    <div className="text-center mb-8">
                      <h1 className="text-4xl font-semibold mb-2 text-white">
                        ADI
                      </h1>
                      <p className={`${designTokens.text.bodySecondary}`}>
                        Task automation platform
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
          path="/oauth/callback"
          element={<OAuthCallbackPage />}
        />
        <Route
          path="*"
          element={
            <>
              <SignedOut>
                <Navigate to="/sign-in" replace />
              </SignedOut>
              <SignedIn>
                <RequireProject>
                  <Routes>
                    {/* Setup Flow - shown when user has no projects */}
                    <Route path="/setup" element={<SetupFlowPage />} />

                    <Route path="/" element={<Layout />}>
                      {/* Power User Mode Routes */}
                      <Route index element={<CommandCenterPage />} />
                      <Route path="ship" element={<ShipModePage />} />
                      <Route path="review" element={<ReviewModePage />} />
                      <Route path="build" element={<BuilderBoardPage />} />
                      <Route path="analytics" element={<AnalyticsPage />} />

                      {/* Legacy Routes - keeping for compatibility */}
                      <Route path="home" element={<HomePage />} />
                      <Route path="board" element={<BuilderBoardPage />} />
                      <Route path="projects" element={<ProjectsPage />} />
                      <Route path="projects/:id" element={<ProjectPage />} />
                      <Route path="setup-project" element={<SetupProjectPage />} />
                      <Route path="tasks" element={<TasksPage />} />
                      <Route path="tasks/:id" element={<TaskPage />} />
                      <Route path="sessions" element={<SessionsPage />} />
                      <Route path="messages" element={<MessagesPage />} />
                      <Route path="worker-cache" element={<WorkerCachePage />} />
                      <Route path="file-spaces" element={<FileSpacesPage />} />
                      <Route path="create-file-space" element={<CreateFileSpacePage />} />
                      <Route path="task-sources" element={<TaskSourcesPage />} />
                      <Route path="create-task-source" element={<CreateTaskSourcePage />} />
                      <Route path="pipeline-executions" element={<PipelineExecutionsPage />} />
                      <Route path="pipeline-artifacts" element={<PipelineArtifactsPage />} />
                      <Route path="admin" element={<AdminPage />} />
                      <Route path="debug" element={<DebugGitlabSecretPage />} />
                    </Route>
                  </Routes>
                </RequireProject>
              </SignedIn>
            </>
          }
        />
        </Routes>
        </BrowserRouter>
      </ProjectProvider>
    </ExpertModeProvider>
  )
}
