import { Link, useLocation } from 'react-router-dom'
import type { LucideIcon } from 'lucide-react'
import { designTokens } from '@/theme/tokens'

interface NavItemProps {
  to: string
  label: string
  icon: LucideIcon
  isCollapsed: boolean
  badge?: number
  activeColor?: string
}

export function NavItem({ to, label, icon: Icon, isCollapsed, badge, activeColor }: NavItemProps) {
  const location = useLocation()
  const isActive = location.pathname === to

  const activeStyles = activeColor || designTokens.colors.text.accent
  const baseStyles = isActive
    ? `${designTokens.colors.bg.tertiary} ${activeStyles}`
    : `${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`

  if (isCollapsed) {
    return (
      <Link to={to} className={`relative p-2 rounded-lg ${baseStyles}`} title={label}>
        <Icon className={designTokens.icons.standard} />
        {badge !== undefined && badge > 0 && (
          <span className="absolute -top-1 -right-1 w-4 h-4 bg-neutral-700 rounded-full flex items-center justify-center text-[9px] text-white font-bold">
            {badge > 99 ? '99+' : badge}
          </span>
        )}
      </Link>
    )
  }

  return (
    <Link to={to} className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-all ${baseStyles}`}>
      <Icon className={designTokens.icons.standard} />
      <span className={designTokens.text.body}>{label}</span>
      {badge !== undefined && badge > 0 && (
        <span className={`ml-auto ${designTokens.kbd} px-2`}>{badge}</span>
      )}
    </Link>
  )
}
