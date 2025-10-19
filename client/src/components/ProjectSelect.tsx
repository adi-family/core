import { useState, useEffect } from "react"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { client } from "@/lib/client"
import type { Project } from "../../../types"

interface ProjectSelectProps {
  value: string
  onChange: (projectId: string) => void
  required?: boolean
  label?: string
  placeholder?: string
}

export function ProjectSelect({
  value,
  onChange,
  required = false,
  label = "PROJECT",
  placeholder = "Search projects...",
}: ProjectSelectProps) {
  const [projects, setProjects] = useState<Project[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchProjects = async () => {
      try {
        const res = await client.projects.$get()
        if (!res.ok) {
          console.error("Error fetching projects:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setProjects(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching projects:", error)
        setLoading(false)
      }
    }

    fetchProjects().catch((error) => {
      console.error("Error fetching projects:", error)
      setLoading(false)
    })
  }, [])

  const options = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="project_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading projects...</div>
      ) : (
        <Combobox
          id="project_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No projects found"
        />
      )}
    </div>
  )
}
