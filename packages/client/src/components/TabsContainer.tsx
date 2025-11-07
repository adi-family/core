import { designTokens } from '@/theme/tokens'

interface Tab {
  id: string
  label: string
}

interface TabsContainerProps {
  tabs: Tab[]
  activeTab: string
  onTabChange: (tabId: string) => void
}

/**
 * Reusable tabs container with consistent styling
 */
export function TabsContainer({ tabs, activeTab, onTabChange }: TabsContainerProps) {
  return (
    <div className="mb-6 border-b border-white/10">
      <div className="flex gap-4">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`pb-4 px-2 font-medium border-b-2 transition-all duration-200 uppercase tracking-wide text-sm ${
              activeTab === tab.id
                ? 'border-blue-400 text-blue-300'
                : 'border-transparent text-gray-400 hover:text-gray-200'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>
    </div>
  )
}

interface InfoPanelProps {
  title: string
  children: React.ReactNode
  variant?: 'info' | 'success' | 'warning' | 'error'
}

/**
 * Reusable info panel with consistent styling
 */
export function InfoPanel({ title, children, variant = 'info' }: InfoPanelProps) {
  const variantClasses = {
    info: 'bg-blue-500/10 border-blue-500/30 text-blue-100',
    success: 'bg-green-500/10 border-green-500/30 text-green-100',
    warning: 'bg-yellow-500/10 border-yellow-500/30 text-yellow-100',
    error: 'bg-red-500/10 border-red-500/30 text-red-100',
  }

  return (
    <div className={`border rounded-xl p-4 ${variantClasses[variant]}`}>
      <h3 className="font-semibold mb-2">{title}</h3>
      <div className="text-sm opacity-90">{children}</div>
    </div>
  )
}

interface ContentCardProps {
  title: string
  description?: string
  children: React.ReactNode
  actions?: React.ReactNode
}

/**
 * Reusable content card for admin sections
 */
export function ContentCard({ title, description, children, actions }: ContentCardProps) {
  return (
    <div className={`bg-white/5 backdrop-blur-md rounded-xl border border-white/10 p-6 mb-6 ${designTokens.animations.hover}`}>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-xl font-semibold mb-1 text-white">{title}</h2>
          {description && (
            <p className="text-sm text-gray-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
