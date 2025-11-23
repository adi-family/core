import { useState } from "react"
import { Label } from './label'
import { CheckCircle2 } from "lucide-react"

export interface JiraSite {
  id: string
  url: string
  name: string
  scopes: string[]
}

interface JiraSiteSelectorProps {
  sites: JiraSite[]
  onSelect: (cloudId: string, site: JiraSite) => void
  selectedCloudId?: string
}

export function JiraSiteSelector({
  sites,
  onSelect,
  selectedCloudId,
}: JiraSiteSelectorProps) {
  const [selected, setSelected] = useState<string | undefined>(selectedCloudId)

  const handleSelect = (site: JiraSite) => {
    setSelected(site.id)
    onSelect(site.id, site)
  }

  if (sites.length === 0) {
    return (
      <div className="text-sm text-gray-400">
        No Jira sites found. Please make sure your OAuth token has access to at least one Jira instance.
      </div>
    )
  }

  if (sites.length === 1) {
    // Auto-select if only one site
    if (!selected) {
      handleSelect(sites[0])
    }
    return (
      <div className="space-y-2">
        <Label className="text-xs uppercase tracking-wide text-gray-300">Jira Site</Label>
        <div className="p-3 border border-green-600/40 bg-green-900/20 rounded-md">
          <div className="flex items-start justify-between">
            <div>
              <div className="font-medium text-gray-100">{sites[0].name}</div>
              <div className="text-sm text-gray-400">{sites[0].url}</div>
              <div className="text-xs text-gray-500 mt-1">
                Scopes: {sites[0].scopes.join(', ')}
              </div>
            </div>
            <CheckCircle2 className="h-5 w-5 text-green-400 flex-shrink-0" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label className="text-xs uppercase tracking-wide text-gray-300">Select Jira Site</Label>
      <div className="space-y-2">
        {sites.map((site) => {
          const isSelected = selected === site.id

          return (
            <button
              key={site.id}
              type="button"
              onClick={() => handleSelect(site)}
              className={`w-full p-3 border rounded-md text-left transition-colors ${
                isSelected
                  ? 'border-blue-500/60 bg-blue-900/20'
                  : 'border-neutral-600 hover:border-neutral-500 bg-neutral-800/50'
              }`}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="font-medium text-gray-100">{site.name}</div>
                  <div className="text-sm text-gray-400">{site.url}</div>
                  <div className="text-xs text-gray-500 mt-1">
                    Scopes: {site.scopes.join(', ')}
                  </div>
                </div>
                {isSelected && (
                  <CheckCircle2 className="h-5 w-5 text-blue-400 flex-shrink-0" />
                )}
              </div>
            </button>
          )
        })}
      </div>
    </div>
  )
}
