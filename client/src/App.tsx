import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout"
import { HomePage } from "./pages/HomePage"
import { ProjectsPage } from "./pages/ProjectsPage"
import { TasksPage } from "./pages/TasksPage"
import { SessionsPage } from "./pages/SessionsPage"
import { MessagesPage } from "./pages/MessagesPage"
import { WorkerCachePage } from "./pages/WorkerCachePage"
import { FileSpacesPage } from "./pages/FileSpacesPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="projects" element={<ProjectsPage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="messages" element={<MessagesPage />} />
          <Route path="worker-cache" element={<WorkerCachePage />} />
          <Route path="file-spaces" element={<FileSpacesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
