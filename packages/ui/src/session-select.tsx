import { useState, useEffect } from "react"
import { Combobox } from './combobox'
import { Label } from './label'
import type { Session } from '@adi-simple/types'
import type { SessionApiClient } from './mock-client'

interface SessionSelectProps {
  client: SessionApiClient
  value: string
  onChange: (sessionId: string) => void
  taskId?: string
  required?: boolean
  label?: string
  placeholder?: string
  showRunner?: boolean
}

export function SessionSelect({
  client,
  value,
  onChange,
  taskId,
  required = false,
  label = "SESSION",
  placeholder = "Search sessions...",
  showRunner = true,
}: SessionSelectProps) {
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSessions = async () => {
      try {
        let res: Response
        if (taskId) {
          res = await client.sessions["by-task"][":taskId"].$get({
            param: { taskId }
          })
        } else {
          res = await client.sessions.$get()
        }

        if (!res.ok) {
          console.error("Error fetching sessions:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setSessions(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching sessions:", error)
        setLoading(false)
      }
    }

    fetchSessions().catch((error) => {
      console.error("Error fetching sessions:", error)
      setLoading(false)
    })
  }, [taskId, client])

  const formatSessionLabel = (session: Session) => {
    const date = new Date(session.created_at).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
    if (showRunner) {
      return `${session.id.substring(0, 8)}... - ${session.runner} (${date})`
    }
    return `${session.id.substring(0, 8)}... (${date})`
  }

  const options = sessions.map((session) => ({
    value: session.id,
    label: formatSessionLabel(session),
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="session_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {loading ? (
        <div className="text-sm text-gray-600">Loading sessions...</div>
      ) : (
        <Combobox
          id="session_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No sessions found"
        />
      )}
    </div>
  )
}
