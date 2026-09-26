import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18nProvider'
import { browserPaletteStorage, MAX_CUSTOM_PALETTES, normalizePaletteName, readCustomPalettes, writeCustomPalettes, type StoredPalette } from '../shared/palette/storage'
import type { RgbColor } from '../shared/pixel/color'
import { randomGuid } from '../shared/unity/guid'

const CHANGE_EVENT = 'pixel-effect-generator:palettes-changed'

/** Locally persisted custom palettes, kept in sync across every open palette menu. */
export function usePaletteLibrary() {
  const { t } = useI18n()
  const [palettes, setPalettes] = useState<StoredPalette[]>([])
  const [warning, setWarning] = useState(false)
  const [storageAvailable, setStorageAvailable] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const refresh = () => {
      const storage = browserPaletteStorage()
      setStorageAvailable(storage !== null)
      const result = readCustomPalettes(storage)
      setPalettes(result.palettes)
      setWarning(result.warning)
    }
    refresh()
    window.addEventListener(CHANGE_EVENT, refresh)
    window.addEventListener('storage', refresh)
    return () => {
      window.removeEventListener(CHANGE_EVENT, refresh)
      window.removeEventListener('storage', refresh)
    }
  }, [])

  const persist = (next: StoredPalette[]): boolean => {
    if (!writeCustomPalettes(next, browserPaletteStorage())) {
      setError(t('paletteLibrary.storageFailed'))
      return false
    }
    setPalettes(next)
    setError(null)
    setWarning(false)
    window.dispatchEvent(new Event(CHANGE_EVENT))
    return true
  }

  const validName = (name: string): string | null => {
    const normalized = normalizePaletteName(name)
    if (normalized === null) setError(t('paletteLibrary.nameError'))
    return normalized
  }

  return {
    palettes,
    warning,
    storageAvailable,
    error,
    full: palettes.length >= MAX_CUSTOM_PALETTES,
    save(name: string, colors: readonly RgbColor[]): boolean {
      const normalized = validName(name)
      if (normalized === null) return false
      if (palettes.length >= MAX_CUSTOM_PALETTES) {
        setError(t('paletteLibrary.limitError'))
        return false
      }
      return persist([...palettes, { id: randomGuid(), name: normalized, colors: colors.map((color) => ({ ...color })) }])
    },
    rename(id: string, name: string): boolean {
      const normalized = validName(name)
      return normalized !== null && persist(palettes.map((entry) => entry.id === id ? { ...entry, name: normalized } : entry))
    },
    overwrite(id: string, colors: readonly RgbColor[]): boolean {
      return persist(palettes.map((entry) => entry.id === id ? { ...entry, colors: colors.map((color) => ({ ...color })) } : entry))
    },
    remove(id: string): boolean {
      return persist(palettes.filter((entry) => entry.id !== id))
    },
  }
}
