import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import type { WorkerRepository } from '@adi-simple/types'
import type { BaseClient } from '@adi-family/http'

export type WorkerRepositoryApiClient = BaseClient

interface WorkerRepositorySelectProps {
  client: WorkerRepositoryApiClient
  value: string
  onChange: (workerRepositoryId: string) => void
  projectId: string // Made required since API needs it
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
        const { getWorkerRepositoryByProjectConfig } = await import('@adi/api-contracts/worker-repositories')
        const data = await client.run(getWorkerRepositoryByProjectConfig, {
          params: { projectId }
        })
        // API returns single repository, wrap in array for consistency
        setWorkerRepositories([data])
        setLoading(false)
      } catch (error) {
        console.error("Error fetching worker repositories:", error)
        setLoading(false)
      }
    }

    if (projectId) {
      fetchWorkerRepositories().catch((error) => {
        console.error("Error fetching worker repositories:", error)
        setLoading(false)
      })
    }
  }, [projectId, client])

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
