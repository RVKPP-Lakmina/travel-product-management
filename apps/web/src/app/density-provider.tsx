import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'

type Density = 'comfortable' | 'compact'
const STORAGE_KEY = 'travel-pm-density'

function getInitial(): Density {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored === 'comfortable' || stored === 'compact') return stored
  } catch {
    // localStorage unavailable — fall through.
  }
  return 'comfortable'
}

interface DensityContextValue {
  density: Density
  setDensity: (d: Density) => void
}

const DensityContext = createContext<DensityContextValue | null>(null)

export function DensityProvider({ children }: { children: ReactNode }) {
  const [density, setDensity] = useState<Density>(getInitial)

  useEffect(() => {
    document.documentElement.dataset.density = density
    try {
      localStorage.setItem(STORAGE_KEY, density)
    } catch {
      // Best-effort only.
    }
  }, [density])

  return <DensityContext.Provider value={{ density, setDensity }}>{children}</DensityContext.Provider>
}

export function useDensity() {
  const ctx = useContext(DensityContext)
  if (!ctx) throw new Error('useDensity must be used within DensityProvider')
  return ctx
}
