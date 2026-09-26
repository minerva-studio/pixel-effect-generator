import { useEffect, useState } from 'react'

const PRESERVE_COLORS_STORAGE_KEY = 'pixel-effect-generator:preserve-preset-colors'

function readPreserveColors(): boolean {
  try {
    return typeof window !== 'undefined' && window.localStorage.getItem(PRESERVE_COLORS_STORAGE_KEY) === 'true'
  } catch {
    return false
  }
}

/** Shares the persisted preset color lock between the workspace and its color dock. */
export function usePreserveColors(): readonly [boolean, (preserve: boolean) => void] {
  const [preserveColors, setPreserveColors] = useState(readPreserveColors)

  useEffect(() => {
    try {
      window.localStorage.setItem(PRESERVE_COLORS_STORAGE_KEY, preserveColors ? 'true' : 'false')
    } catch {
      // Color preservation remains usable when browser storage is unavailable.
    }
  }, [preserveColors])

  return [preserveColors, setPreserveColors]
}
