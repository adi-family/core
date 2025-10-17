import { useEffect, useState } from "react"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { client } from "@/lib/client"
import type { FileSpace } from "../../../backend/types"

export function FileSpacesPage() {
  const [fileSpaces, setFileSpaces] = useState<FileSpace[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchFileSpaces = async () => {
      const res = await client["file-spaces"].$get()
      if (!res.ok) {
        console.error("Error fetching file spaces:", await res.text())
        setLoading(false)
        return
      }
      const data = await res.json()
      setFileSpaces(data)
      setLoading(false)
    }

    fetchFileSpaces().catch((error) => {
      console.error("Error fetching file spaces:", error)
      setLoading(false)
    })
  }, [])

  const formatConfig = (config: unknown): string => {
    try {
      return JSON.stringify(config, null, 2)
    } catch {
      return String(config)
    }
  }

  const getFileSpaceTypeBadgeClass = (type: string): string => {
    switch (type) {
      case 'gitlab':
        return 'bg-orange-100 text-orange-800 ring-orange-500/10'
      case 'github':
        return 'bg-gray-900 text-white ring-gray-500/10'
      default:
        return 'bg-gray-100 text-gray-800 ring-gray-500/10'
    }
  }

  return (
    <div className="container mx-auto py-10">
      <Card>
        <CardHeader>
          <CardTitle>File Spaces</CardTitle>
          <CardDescription>Manage repository file spaces for tasks</CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4">Loading...</div>
          ) : fileSpaces.length === 0 ? (
            <div className="text-center py-4 text-muted-foreground">
              No file spaces found
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Name</TableHead>
                  <TableHead>Type</TableHead>
                  <TableHead>Project ID</TableHead>
                  <TableHead>Config</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Created At</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {fileSpaces.map((fileSpace) => (
                  <TableRow key={fileSpace.id}>
                    <TableCell className="font-medium">{fileSpace.name}</TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${getFileSpaceTypeBadgeClass(fileSpace.type)}`}>
                        {fileSpace.type}
                      </span>
                    </TableCell>
                    <TableCell className="font-mono text-xs text-muted-foreground">
                      {fileSpace.project_id}
                    </TableCell>
                    <TableCell className="max-w-xs">
                      <pre className="text-xs overflow-auto bg-muted p-2 rounded">
                        {formatConfig(fileSpace.config)}
                      </pre>
                    </TableCell>
                    <TableCell>
                      <span className={`inline-flex items-center rounded-full px-2 py-1 text-xs font-medium ring-1 ring-inset ${
                        fileSpace.enabled
                          ? 'bg-green-100 text-green-800 ring-green-500/10'
                          : 'bg-gray-100 text-gray-800 ring-gray-500/10'
                      }`}>
                        {fileSpace.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {new Date(fileSpace.created_at).toLocaleString()}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
