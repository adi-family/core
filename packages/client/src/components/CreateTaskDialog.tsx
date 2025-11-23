import { useState } from "react"
import { useAuth } from "@clerk/clerk-react"
import { useSnapshot } from "valtio"
import { toast } from "sonner"
import { Button } from "@adi-simple/ui/button"
import { Input } from "@adi-simple/ui/input"
import { Label } from "@adi-simple/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@adi-simple/ui/card"
import { createAuthenticatedClient } from "@/lib/client"
import { createTask } from "@/stores/tasks"
import { projectsStore } from "@/stores"
import { useProject } from "@/contexts/ProjectContext"
import { designTokens } from "@/theme/tokens"

interface CreateTaskDialogProps {
  isOpen: boolean
  onClose: () => void
  onSuccess?: () => void
}

export function CreateTaskDialog({ isOpen, onClose, onSuccess }: CreateTaskDialogProps) {
  const { getToken } = useAuth()
  const { projects } = useSnapshot(projectsStore)
  const { selectedProjectId } = useProject()
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [projectId, setProjectId] = useState(selectedProjectId || "")
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!title.trim()) {
      toast.error("Title is required")
      return
    }

    if (!projectId) {
      toast.error("Please select a project")
      return
    }

    setLoading(true)

    try {
      const client = createAuthenticatedClient(getToken)

      await createTask(client, {
        title: title.trim(),
        description: description.trim() || undefined,
        project_id: projectId,
        status: "opened"
      })

      toast.success("Task created successfully!")

      // Reset form
      setTitle("")
      setDescription("")
      setProjectId(selectedProjectId || "")

      if (onSuccess) {
        onSuccess()
      }

      onClose()
    } catch (error) {
      console.error("Error creating task:", error)
      toast.error(error instanceof Error ? error.message : "Failed to create task")
    } finally {
      setLoading(false)
    }
  }

  const handleClose = () => {
    if (!loading) {
      setTitle("")
      setDescription("")
      setProjectId(selectedProjectId || "")
      onClose()
    }
  }

  if (!isOpen) {
    return null
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-in fade-in duration-200">
      <div className="w-full max-w-2xl mx-4">
        <Card className={`${designTokens.colors.bg.secondary} ${designTokens.borders.default} rounded-lg`}>
          <CardHeader className={`${designTokens.spacing.cardHeader} ${designTokens.borders.bottom}`}>
            <CardTitle className={designTokens.text.h2}>
              Create New Task
            </CardTitle>
            <CardDescription className={`${designTokens.text.bodySecondary} mt-1`}>
              Create a manual task to track work outside of your task sources
            </CardDescription>
          </CardHeader>
          <CardContent className={`${designTokens.spacing.cardPadding} text-gray-100`}>
            <form onSubmit={handleSubmit} className="space-y-6">
              <div>
                <Label htmlFor="project" className="block mb-2 text-sm font-medium text-gray-200">
                  Project <span className="text-red-400">*</span>
                </Label>
                <select
                  id="project"
                  value={projectId}
                  onChange={(e) => setProjectId(e.target.value)}
                  className="w-full px-4 py-2 bg-neutral-700/50 border border-neutral-600 rounded-lg text-gray-100 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent"
                  disabled={loading}
                  required
                >
                  <option value="">Select a project</option>
                  {projects.map((project) => (
                    <option key={project.id} value={project.id}>
                      {project.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <Label htmlFor="title" className="block mb-2 text-sm font-medium text-gray-200">
                  Title <span className="text-red-400">*</span>
                </Label>
                <Input
                  id="title"
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Enter task title"
                  disabled={loading}
                  required
                  className="w-full"
                />
              </div>

              <div>
                <Label htmlFor="description" className="block mb-2 text-sm font-medium text-gray-200">
                  Description
                </Label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Enter task description (optional)"
                  disabled={loading}
                  rows={5}
                  className="w-full px-4 py-2 bg-neutral-700/50 border border-neutral-600 rounded-lg text-gray-100 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-neutral-500 focus:border-transparent resize-vertical"
                />
              </div>

              <div className="flex gap-3 justify-end pt-4">
                <Button
                  type="button"
                  onClick={handleClose}
                  disabled={loading}
                  className="px-6 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg transition-colors"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  disabled={loading}
                  className="px-6 py-2 bg-neutral-600 hover:bg-neutral-700 text-white rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {loading ? "Creating..." : "Create Task"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
