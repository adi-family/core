import { useState } from "react"
import { Label } from './label'
import { CheckCircle2 } from "lucide-react"

export type JiraSite = {
  id: string
  url: string
  name: string
  scopes: string[]
}

type JiraSiteSelectorProps = {
  sites: JiraSite[]
  onSelect: (cloudId: string) => void
  selectedCloudId?: string
}

export function JiraSiteSelector({
  sites,
  onSelect,
  selectedCloudId,
}: JiraSiteSelectorProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedCloudId)

  const handleSelect = (cloudId: string) => {
    setSelected(cloudId)
    onSelect(cloudId)
  }

  if (sites.length === 0) {
    return (
      <div className="text-sm text-gray-600">
        No Jira sites found. Please make sure your OAuth token has access to at least one Jira instance.
      </div>
    )
  }

  if (sites.length === 1) {
    // Auto-select if only one site
    if (!selected) {
      handleSelect(sites[0].id)
    }
    return (
      <div className="space-y-2">
        <Label>Jira Site</Label>
        <div className="p-3 border border-green-200 bg-green-50 rounded-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-900">{sites[0].name}</div>
              <div className="text-sm text-gray-600">{sites[0].url}</div>
              <div className="text-xs text-gray-500 mt-1">
                Scopes: {sites[0].scopes.join(', ')}
              </div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label>Select Jira Site</Label>
      <div className="space-y-2">
        {sites.map((site) => {
          const isSelected = selected === site.id

          return (
            <button
              key={site.id}
              type="button"
              onClick={() => handleSelect(site.id)}
              className={`w-full p-3 border rounded-md text-left transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-300 hover:border-gray-400 bg-white'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-900">{site.name}</div>
                  <div className="text-sm text-gray-600">{site.url}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Scopes: {site.scopes.join(', ')}
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-blue-600 flex-shrink-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
