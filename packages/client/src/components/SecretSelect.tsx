import { useState, useEffect } from "react"
import { Combobox } from '@adi-simple/ui/combobox'
import { Label } from '@adi-simple/ui/label'
import { client } from "@/lib/client"
import type { Secret } from "../../../types"

interface SecretSelectProps {
  projectId?: string
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
      try {
        let res
        if (projectId) {
          // Fetch secrets for specific project
          res = await client.secrets["by-project"][":projectId"].$get({
            param: { projectId },
          })
        } else {
          // Fetch all secrets accessible to user
          res = await client.secrets.$get()
        }

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
      {loading ? (
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
