import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

const STORAGE_KEY = 'travel-pm-sidebar'

/** Keep in sync with the `--sidebar-w` fallbacks in index.css. */
export const SIDEBAR_WIDTH = '16rem' // 256px — expanded
export const SIDEBAR_RAIL_WIDTH = '4rem' // 64px — icon rail

function getInitialCollapsed(): boolean {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'collapsed') return true
    if (stored === 'expanded') return false
  } catch {
    // localStorage unavailable (private mode, etc.) — fall through to width.
  }
  // No stored preference: default to the rail on laptop-class widths, where
  // 256px of permanent chrome is a real cost, and expand above that.
  return window.matchMedia('(max-width: 1279px)').matches
}

interface SidebarContextValue {
  collapsed: boolean
  toggleCollapsed: () => void
  setCollapsed: (collapsed: boolean) => void
}

const SidebarContext = createContext<SidebarContextValue | null>(null)

export function SidebarProvider({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState<boolean>(getInitialCollapsed)

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, collapsed ? 'collapsed' : 'expanded')
    } catch {
      // Best-effort only — per-viewer convenience, not required to persist.
    }
  }, [collapsed])

  const toggleCollapsed = () => setCollapsed((c) => !c)

  return (
    <SidebarContext.Provider value={{ collapsed, toggleCollapsed, setCollapsed }}>
      {children}
    </SidebarContext.Provider>
  )
}

export function useSidebar() {
  const ctx = useContext(SidebarContext)
  if (!ctx) throw new Error('useSidebar must be used within SidebarProvider')
  return ctx
}
