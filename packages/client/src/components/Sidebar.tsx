import { Link } from 'react-router-dom'
import { useSnapshot } from 'valtio'
import { UserButton } from '@clerk/clerk-react'
import { ChevronLeft, Keyboard, Terminal } from 'lucide-react'
import { designTokens } from '@/theme/tokens'
import { useProject } from '@/contexts/ProjectContext'
import { useExpertMode } from '@/contexts/ExpertModeContext'
import { projectsStore } from '@/stores'
import { HOTKEYS, formatHotkey } from '@/consts/hotkeys'
import { modeNav, mainNav, expertNav } from '@/consts/navigation'
import { NavItem } from './NavItem'
import { Select } from '@adi-simple/ui/select'
import { SidebarToggleButton, IconButton } from './buttons'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const { expertMode } = useExpertMode()
  const { projects } = useSnapshot(projectsStore)

  const containerStyles = isCollapsed
    ? 'w-16 items-center py-4'
    : 'w-64'

  return (
    <div className={`${designTokens.colors.bg.secondary} ${designTokens.borders.right} h-full flex flex-col ${containerStyles}`}>
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'flex-col gap-3' : `justify-between ${designTokens.spacing.cardHeader} ${designTokens.borders.bottom}`}`}>
        <Link to="/" className="font-bold text-lg text-white">
          {isCollapsed ? 'A' : 'ADI'}
        </Link>
        <SidebarToggleButton
          icon={ChevronLeft}
          isCollapsed={isCollapsed}
          onClick={onToggle}
          tooltip={`${isCollapsed ? 'Expand' : 'Collapse'} sidebar ${formatHotkey(HOTKEYS.ToggleSidebar)}`}
        />
      </div>

      {isCollapsed && <div className={`${designTokens.borders.bottom} w-full my-2`} />}

      {/* User (collapsed only shows at bottom) */}
      {!isCollapsed && (
        <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom} flex items-center justify-between`}>
          <UserButton afterSignOutUrl="/" />
        </div>
      )}

      {/* Project Selector */}
      {!isCollapsed && projects.length > 0 && (
        <div className={`${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
          <div className={`${designTokens.text.label} mb-2`}>Project</div>
          <Select
            value={selectedProjectId || ''}
            onChange={(e) => setSelectedProjectId(e.target.value || null)}
            className="w-full h-8 text-[13px]"
          >
            <option value="">All Projects</option>
            {projects.map((project) => (
              <option key={project.id} value={project.id}>
                {project.name}
              </option>
            ))}
          </Select>
        </div>
      )}

      {/* Mode Navigation */}
      <nav className={isCollapsed ? 'flex flex-col items-center gap-1' : `${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
        {!isCollapsed && <div className={`${designTokens.text.label} mb-2`}>Modes</div>}
        <div className={isCollapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}>
          {modeNav.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              isCollapsed={isCollapsed}
              activeColor={item.activeColor}
            />
          ))}
        </div>
      </nav>

      {isCollapsed && <div className={`${designTokens.borders.bottom} w-full my-2`} />}

      {/* Main Navigation */}
      <nav className={isCollapsed ? 'flex flex-col items-center gap-1' : `flex-1 overflow-y-auto ${designTokens.spacing.cardPadding}`}>
        {!isCollapsed && <div className={`${designTokens.text.label} mb-2`}>Navigation</div>}
        <div className={isCollapsed ? 'flex flex-col items-center gap-1' : 'space-y-1'}>
          {mainNav.map((item) => (
            <NavItem
              key={item.to}
              to={item.to}
              label={item.label}
              icon={item.icon}
              isCollapsed={isCollapsed}
            />
          ))}
        </div>
      </nav>

      {isCollapsed && <div className="flex-1" />}

      {/* Expert Mode Navigation */}
      {expertMode && !isCollapsed && (
        <nav className={`${designTokens.spacing.cardPadding} ${designTokens.borders.top}`}>
          <div className={`${designTokens.text.label} mb-2`}>Advanced</div>
          <div className="space-y-1">
            {expertNav.map((item) => (
              <Link
                key={item.to}
                to={item.to}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg ${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`}
              >
                <Terminal className={designTokens.icons.standard} />
                <span className={designTokens.text.body}>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Footer */}
      <div className={isCollapsed ? 'flex flex-col items-center gap-2' : `${designTokens.spacing.cardPadding} ${designTokens.borders.top}`}>
        {isCollapsed ? (
          <IconButton
            icon={Keyboard}
            onClick={() => (window as any).__toggleKeyboardShortcuts?.()}
            tooltip="Keyboard shortcuts (?)"
          />
        ) : (
          <button
            onClick={() => (window as any).__toggleKeyboardShortcuts?.()}
            className="w-full flex items-center justify-center gap-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 p-2 rounded-lg transition-colors"
          >
            <Keyboard className={designTokens.icons.standard} />
            <span className={designTokens.text.caption}>Shortcuts</span>
            <kbd className={designTokens.kbd}>?</kbd>
          </button>
        )}
        {isCollapsed && (
          <div className="scale-75">
            <UserButton afterSignOutUrl="/" />
          </div>
        )}
      </div>
    </div>
  )
}
