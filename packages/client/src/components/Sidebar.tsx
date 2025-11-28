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
import { SidebarToggleButton } from './buttons'

interface SidebarProps {
  isCollapsed: boolean
  onToggle: () => void
}

export function Sidebar({ isCollapsed, onToggle }: SidebarProps) {
  const { selectedProjectId, setSelectedProjectId } = useProject()
  const { expertMode } = useExpertMode()
  const { projects } = useSnapshot(projectsStore)

  const containerStyles = isCollapsed
    ? 'w-16 py-4'
    : 'w-64'

  return (
    <div className={`${designTokens.colors.bg.secondary} ${designTokens.borders.right} h-full flex flex-col overflow-hidden ${containerStyles}`}>
      {/* Header */}
      <div className={`flex items-center ${isCollapsed ? 'justify-center pb-2' : `${designTokens.spacing.cardHeader} ${designTokens.borders.bottom}`}`}>
        <Link to="/" className="font-bold text-lg text-white">
          {isCollapsed ? 'A' : 'ADI'}
        </Link>
      </div>

      {isCollapsed && <div className={`${designTokens.borders.bottom} w-full my-2`} />}

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
      <nav className={isCollapsed ? 'flex flex-col gap-1' : `${designTokens.spacing.cardPadding} ${designTokens.borders.bottom}`}>
        {!isCollapsed && <div className={`${designTokens.text.label} mb-2`}>Modes</div>}
        <div className={isCollapsed ? 'flex flex-col gap-1' : 'space-y-1'}>
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
      <nav className={isCollapsed ? 'flex flex-col gap-1' : `flex-1 overflow-y-auto ${designTokens.spacing.cardPadding}`}>
        {!isCollapsed && <div className={`${designTokens.text.label} mb-2`}>Navigation</div>}
        <div className={isCollapsed ? 'flex flex-col gap-1' : 'space-y-1'}>
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
                className={`flex items-center gap-3 -mx-4 px-4 py-2 rounded-lg ${designTokens.colors.text.secondary} ${designTokens.interactions.hover}`}
              >
                <Terminal className={designTokens.icons.standard} />
                <span className={designTokens.text.body}>{item.label}</span>
              </Link>
            ))}
          </div>
        </nav>
      )}

      {/* Footer */}
      <div className={isCollapsed ? 'flex flex-col gap-1' : `${designTokens.spacing.cardPadding} ${designTokens.borders.top} space-y-1`}>
        <SidebarToggleButton
          icon={ChevronLeft}
          isCollapsed={isCollapsed}
          onClick={onToggle}
          label="Collapse sidebar"
          tooltip={`${isCollapsed ? 'Expand' : 'Collapse'} sidebar ${formatHotkey(HOTKEYS.ToggleSidebar)}`}
        />
        <button
          onClick={() => (window as any).__toggleKeyboardShortcuts?.()}
          className={isCollapsed ? 'w-full p-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 rounded-lg transition-colors cursor-pointer flex justify-center' : 'flex items-center gap-2 w-[calc(100%+2rem)] -mx-4 px-4 py-2 text-neutral-400 hover:bg-neutral-800 hover:text-neutral-200 rounded-lg transition-colors cursor-pointer'}
        >
          <Keyboard className="h-4 w-4" />
          {!isCollapsed && <span className="text-sm">Keyboard shortcuts</span>}
        </button>
        <div className={isCollapsed ? 'w-full flex justify-center py-2' : 'flex items-center gap-2 w-[calc(100%+2rem)] -mx-4 px-4 py-2'}>
          <UserButton afterSignOutUrl="/" />
          {!isCollapsed && <span className="text-sm text-neutral-400">Account</span>}
        </div>
      </div>
    </div>
  )
}
