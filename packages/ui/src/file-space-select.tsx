import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import type { FileSpace } from '@adi-simple/types'
import type { FileSpaceApiClient } from './mock-client'

interface FileSpaceSelectProps {
  client: FileSpaceApiClient
  value: string
  onChange: (fileSpaceId: string) => void
  projectId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showType?: boolean
}

export function FileSpaceSelect({
  client,
  value,
  onChange,
  projectId,
  required = false,
  label = "FILE SPACE",
  placeholder = "Search file spaces...",
  showType = true,
}: FileSpaceSelectProps) {
  const [fileSpaces, setFileSpaces] = useState<FileSpace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFileSpaces = async () => {
      try {
        let res: Response
        if (projectId) {
          res = await client["file-spaces"]["by-project"][":projectId"].$get({
            param: { projectId }
          })
        } else {
          res = await client["file-spaces"].$get()
        }

        if (!res.ok) {
          console.error("Error fetching file spaces:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setFileSpaces(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching file spaces:", error)
        setLoading(false)
      }
    }

    fetchFileSpaces().catch((error) => {
      console.error("Error fetching file spaces:", error)
      setLoading(false)
    })
  }, [projectId])

  const getFileSpaceTypeLabel = (type: string) => {
    switch (type) {
      case 'gitlab':
        return 'GitLab'
      case 'github':
        return 'GitHub'
      default:
        return type
    }
  }

  const options = fileSpaces.map((fileSpace) => ({
    value: fileSpace.id,
    label: showType
      ? `${fileSpace.name} (${getFileSpaceTypeLabel(fileSpace.type)})`
      : fileSpace.name,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="file_space_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading file spaces...</div>
      ) : (
        <Combobox
          id="file_space_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No file spaces found"
        />
      )}
    </div>
  )
}
