import { BrowserRouter, Routes, Route } from "react-router-dom"
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

export function App() {
  return (
    <BrowserRouter>
      <Toaster />
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
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
