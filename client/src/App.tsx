import { BrowserRouter, Routes, Route } from "react-router-dom"
import { Layout } from "./components/Layout"
import { HomePage } from "./pages/HomePage"
import { TasksPage } from "./pages/TasksPage"
import { SessionsPage } from "./pages/SessionsPage"
import { MessagesPage } from "./pages/MessagesPage"

export function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="tasks" element={<TasksPage />} />
          <Route path="sessions" element={<SessionsPage />} />
          <Route path="messages" element={<MessagesPage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  )
}
