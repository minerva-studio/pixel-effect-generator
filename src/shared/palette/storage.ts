import type { RgbColor } from '../pixel/color'

export const PALETTE_STORAGE_KEY = 'pixel-effect-generator:palettes:v1'
export const MAX_CUSTOM_PALETTES = 32
export const MAX_PALETTE_NAME_LENGTH = 40

export interface StoredPalette {
  readonly id: string
  readonly name: string
  readonly colors: readonly RgbColor[]
}

export interface PaletteStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Returns local storage when the current browser or WebView permits it. */
export function browserPaletteStorage(): PaletteStorage | null {
  try {
    if (typeof window === 'undefined') return null
    const storage = window.localStorage
    storage.getItem(PALETTE_STORAGE_KEY)
    return storage
  } catch {
    return null
  }
}

/** Normalizes a user palette name under the same limit as effect presets. */
export function normalizePaletteName(name: string): string | null {
  const value = name.trim()
  return value.length >= 1 && value.length <= MAX_PALETTE_NAME_LENGTH ? value : null
}

function validColors(value: unknown): value is RgbColor[] {
  return Array.isArray(value) && value.length >= 2 && value.length <= 6 && value.every((entry) =>
    typeof entry === 'object' && entry !== null && ['r', 'g', 'b', 'a'].every((key) => {
      const channel = (entry as Record<string, unknown>)[key]
      return typeof channel === 'number' && Number.isInteger(channel) && channel >= 0 && channel <= 255
    }),
  )
}

function validPalettes(value: unknown): value is StoredPalette[] {
  if (!Array.isArray(value) || value.length > MAX_CUSTOM_PALETTES) return false
  const ids = new Set<string>()
  return value.every((entry) => {
    if (typeof entry !== 'object' || entry === null) return false
    const palette = entry as Record<string, unknown>
    if (typeof palette.id !== 'string' || palette.id.length === 0 || ids.has(palette.id)) return false
    ids.add(palette.id)
    return typeof palette.name === 'string' && normalizePaletteName(palette.name) === palette.name && validColors(palette.colors)
  })
}

/** Reads a versioned application-wide palette library; invalid data is ignored. */
export function readCustomPalettes(storage: PaletteStorage | null): { palettes: StoredPalette[]; warning: boolean } {
  if (storage === null) return { palettes: [], warning: false }
  try {
    const raw = storage.getItem(PALETTE_STORAGE_KEY)
    if (raw === null) return { palettes: [], warning: false }
    const value: unknown = JSON.parse(raw)
    if (typeof value !== 'object' || value === null || (value as Record<string, unknown>).schema !== 1) {
      return { palettes: [], warning: true }
    }
    const palettes = (value as Record<string, unknown>).palettes
    if (!validPalettes(palettes)) return { palettes: [], warning: true }
    return { palettes: palettes.map((entry) => ({ ...entry, colors: entry.colors.map((color) => ({ ...color })) })), warning: false }
  } catch {
    return { palettes: [], warning: true }
  }
}

/** Persists the complete library atomically, returning false on validation or storage failure. */
export function writeCustomPalettes(palettes: readonly StoredPalette[], storage: PaletteStorage | null): boolean {
  if (storage === null || !validPalettes(palettes)) return false
  try {
    storage.setItem(PALETTE_STORAGE_KEY, JSON.stringify({ schema: 1, palettes }))
    return true
  } catch {
    return false
  }
}
