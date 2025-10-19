import { useState, useEffect } from "react"
import { Combobox } from "@/components/ui/combobox"
import { Label } from "@/components/ui/label"
import { client } from "@/lib/client"
import type { Secret } from "../../../types"

interface SecretSelectProps {
  projectId: string
  value: string
  onChange: (secretId: string) => void
  required?: boolean
  label?: string
  placeholder?: string
}

export function SecretSelect({
  projectId,
  value,
  onChange,
  required = false,
  label = "SECRET",
  placeholder = "Search secrets...",
}: SecretSelectProps) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSecrets = async () => {
      if (!projectId) {
        setSecrets([])
        setLoading(false)
        return
      }

      try {
        const res = await client.secrets["by-project"][":projectId"].$get({
          param: { projectId },
        })
        if (!res.ok) {
          console.error("Error fetching secrets:", await res.text())
          setLoading(false)
          return
        }
        const data = await res.json()
        setSecrets(data)
        setLoading(false)
      } catch (error) {
        console.error("Error fetching secrets:", error)
        setLoading(false)
      }
    }

    fetchSecrets().catch((error) => {
      console.error("Error fetching secrets:", error)
      setLoading(false)
    })
  }, [projectId])

  const options = secrets.map((secret) => ({
    value: secret.id,
    label: `${secret.name}${secret.description ? ` - ${secret.description}` : ""}`,
  }))

  return (
    <div className="space-y-2">
      <Label htmlFor="secret_id" className="text-xs uppercase tracking-wide">
        {label}
      </Label>
      {!projectId ? (
        <div className="text-sm text-gray-600">Select a project first</div>
      ) : loading ? (
        <div className="text-sm text-gray-600">Loading secrets...</div>
      ) : (
        <Combobox
          id="secret_id"
          options={options}
          value={value}
          onChange={onChange}
          placeholder={placeholder}
          required={required}
          emptyMessage="No secrets found"
        />
      )}
    </div>
  )
}
