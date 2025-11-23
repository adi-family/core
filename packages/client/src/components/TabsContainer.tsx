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
                ? 'border-neutral-400 text-neutral-300'
                : 'border-transparent text-neutral-400 hover:text-neutral-200'
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
    info: 'bg-neutral-500/10 border-neutral-500/30 text-neutral-100',
    success: 'bg-neutral-400/10 border-neutral-400/30 text-neutral-100',
    warning: 'bg-neutral-400/10 border-neutral-400/30 text-neutral-100',
    error: 'bg-neutral-700/10 border-neutral-700/30 text-neutral-100',
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
            <p className="text-sm text-neutral-400">{description}</p>
          )}
        </div>
        {actions && <div className="flex gap-2">{actions}</div>}
      </div>
      {children}
    </div>
  )
}
