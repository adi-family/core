import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import type { WorkerRepository } from '@adi-simple/types'
import type { WorkerRepositoryApiClient } from './mock-client'

interface WorkerRepositorySelectProps {
  client: WorkerRepositoryApiClient
  value: string
  onChange: (workerRepositoryId: string) => void
  projectId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showVersion?: boolean
}

export function WorkerRepositorySelect({
  client,
  value,
  onChange,
  projectId,
  required = false,
  label = "WORKER REPOSITORY",
  placeholder = "Search worker repositories...",
  showVersion = true,
}: WorkerRepositorySelectProps) {
  const [workerRepositories, setWorkerRepositories] = useState<WorkerRepository[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchWorkerRepositories = async () => {
      try {
        let res: Response
        if (projectId) {
          res = await client["worker-repositories"]["by-project"][":projectId"].$get({
            param: { projectId }
          })
        } else {
          res = await client["worker-repositories"].$get()
        }

        if (!res.ok) {
          console.error("Error fetching worker repositories:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setWorkerRepositories(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching worker repositories:", error)
        setLoading(false)
      }
    }

    fetchWorkerRepositories().catch((error) => {
      console.error("Error fetching worker repositories:", error)
      setLoading(false)
    })
  }, [projectId])

  const formatWorkerRepositoryLabel = (workerRepository: WorkerRepository) => {
    const source = workerRepository.source_gitlab as any
    const repoName = source?.repo || workerRepository.id
    if (showVersion) {
      return `${repoName} (${workerRepository.current_version})`
    }
    return repoName
  }

  const options = workerRepositories.map((workerRepository) => ({
    value: workerRepository.id,
    label: formatWorkerRepositoryLabel(workerRepository),
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="worker_repository_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading worker repositories...</div>
      ) : (
        <Combobox
          id="worker_repository_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No worker repositories found"
        />
      )}
    </div>
  )
}
