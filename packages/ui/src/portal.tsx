import { useEffect, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'

interface PortalProps {
  children: ReactNode
  container?: Element | DocumentFragment
}

/**
 * Portal component for rendering children outside the normal DOM hierarchy
 * Useful for dropdowns, modals, tooltips to avoid z-index stacking context issues
 */
export function Portal({ children, container }: PortalProps) {
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
    return () => setMounted(false)
  }, [])

  if (!mounted) {
    return null
  }

  return createPortal(children, container || document.body)
}
