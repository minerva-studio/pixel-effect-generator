import { createContext, useContext, useMemo, type ReactNode } from 'react'
import type { DesktopAppApi } from '../../electron/desktopApi'

const DesktopContext = createContext<DesktopAppApi | null>(null)

/** Reads the desktop bridge once; browsers and tests render without it. */
function readDesktopApi(): DesktopAppApi | null {
  if (typeof window === 'undefined') {
    return null
  }
  return window.pixelEffectDesktop ?? null
}

/** Provides the desktop bridge to the tree; null in the web build. */
export function DesktopProvider({ children }: { readonly children: ReactNode }) {
  const api = useMemo(() => readDesktopApi(), [])
  return <DesktopContext.Provider value={api}>{children}</DesktopContext.Provider>
}

/** Returns the desktop bridge or null on the web. */
export function useDesktopApp(): DesktopAppApi | null {
  return useContext(DesktopContext)
}
