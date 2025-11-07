import { createContext, useContext, useState, useEffect, type ReactNode } from 'react'

interface ExpertModeContextType {
  expertMode: boolean
  toggleExpertMode: () => void
  setExpertMode: (value: boolean) => void
}

const ExpertModeContext = createContext<ExpertModeContextType | undefined>(undefined)

const EXPERT_MODE_KEY = 'adi-expert-mode'

/**
 * ExpertModeProvider manages the global expert mode state
 * Expert mode controls visibility of advanced UI elements across the app
 */
export function ExpertModeProvider({ children }: { children: ReactNode }) {
  const [expertMode, setExpertModeState] = useState<boolean>(() => {
    // Load from localStorage on mount
    const stored = localStorage.getItem(EXPERT_MODE_KEY)
    return stored === 'true'
  })

  useEffect(() => {
    // Persist to localStorage whenever it changes
    localStorage.setItem(EXPERT_MODE_KEY, String(expertMode))
  }, [expertMode])

  const toggleExpertMode = () => {
    setExpertModeState((prev) => !prev)
  }

  const setExpertMode = (value: boolean) => {
    setExpertModeState(value)
  }

  return (
    <ExpertModeContext.Provider value={{ expertMode, toggleExpertMode, setExpertMode }}>
      {children}
    </ExpertModeContext.Provider>
  )
}

/**
 * Hook to access expert mode state
 * @throws Error if used outside ExpertModeProvider
 */
export function useExpertMode() {
  const context = useContext(ExpertModeContext)
  if (context === undefined) {
    throw new Error('useExpertMode must be used within ExpertModeProvider')
  }
  return context
}
