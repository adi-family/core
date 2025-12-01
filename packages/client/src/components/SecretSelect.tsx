import { useState, useEffect } from "react"
import { Combobox } from '@adi-simple/ui/combobox'
import { Label } from '@adi-simple/ui/label'
import { listSecretsConfig, getSecretsByProjectConfig } from "@adi/api-contracts"
import type { Secret } from "../../../types"
import type { BaseClient } from '@adi-family/http'

interface SecretSelectProps {
  projectId?: string
  value: string
  onChange: (secretId: string) => void
  required?: boolean
  label?: string
  placeholder?: string
  client: BaseClient
}

export function SecretSelect({
  projectId,
  value,
  onChange,
  required = false,
  label = "SECRET",
  placeholder = "Search secrets...",
  client,
}: SecretSelectProps) {
  const [secrets, setSecrets] = useState<Secret[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetchSecrets = async () => {
      try {
        let data
        if (projectId) {
          // Fetch secrets for specific project
          data = await client.run(getSecretsByProjectConfig, {
            params: { projectId },
          })
        } else {
          // Fetch all secrets accessible to user
          data = await client.run(listSecretsConfig)
        }
        setSecrets(data as unknown)
      } catch (error) {
        console.error("Error fetching secrets:", error)
      } finally {
        setLoading(false)
      }
    }

    fetchSecrets().catch((error) => {
      console.error("Error fetching secrets:", error)
      setLoading(false)
    })
  }, [projectId, client])

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
        <div className="text-sm text-neutral-600">Loading secrets...</div>
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
