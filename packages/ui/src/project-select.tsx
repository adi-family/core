import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import { Check, Folder } from 'lucide-react'
import type { BaseClient } from '@adi-family/http'

export interface Project {
  id: string
  name: string
  created_at: string
  updated_at: string
}

export type ProjectApiClient = BaseClient

interface ProjectSelectProps {
  client: ProjectApiClient
  value: string
  onChange: (projectId: string) => void
  required?: boolean
  label?: string
  placeholder?: string
}

export function ProjectSelect({
  client,
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
      try{
        // Import the config dynamically to avoid circular dependencies
        const { listProjectsConfig } = await import('@adi/api-contracts/projects')
        const data = await client.run(listProjectsConfig, {})
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
  }, [client])

  const options = projects.map((project) => ({
    value: project.id,
    label: project.name,
  }))

  // Use button grid for 10 or fewer projects
  const useButtonLayout = projects.length > 0 && projects.length <= 10

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="project_id" className="text-xs uppercase tracking-wide text-gray-300">
          {label}
        </Label>
        {useButtonLayout && (
          <p className="text-xs text-gray-400">Select a project to continue</p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8">
          <div className="text-sm text-gray-400">Loading projects...</div>
        </div>
      ) : useButtonLayout ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {projects.map((project) => {
            const isSelected = project.id === value
            return (
              <button
                key={project.id}
                type="button"
                onClick={() => onChange(project.id)}
                className={`
                  group relative overflow-hidden rounded-lg border-2 p-4 text-left transition-all duration-200
                  ${isSelected
                    ? 'border-blue-500 bg-blue-500/20 shadow-lg shadow-blue-500/20'
                    : 'border-neutral-700/50 bg-neutral-800/50 hover:border-blue-500/50 hover:bg-neutral-700/50 hover:shadow-md'
                  }
                `}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div className={`
                    flex-shrink-0 w-10 h-10 rounded-lg flex items-center justify-center transition-colors
                    ${isSelected
                      ? 'bg-blue-500/30 text-blue-400'
                      : 'bg-neutral-700/50 text-gray-400 group-hover:bg-blue-500/20 group-hover:text-blue-400'
                    }
                  `}>
                    {isSelected ? (
                      <Check className="w-5 h-5" />
                    ) : (
                      <Folder className="w-5 h-5" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className={`
                      font-medium transition-colors
                      ${isSelected
                        ? 'text-blue-300'
                        : 'text-gray-200 group-hover:text-gray-100'
                      }
                    `}>
                      {project.name}
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Created {new Date(project.created_at).toLocaleDateString()}
                    </div>
                  </div>

                </div>
              </button>
            )
          })}
        </div>
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
