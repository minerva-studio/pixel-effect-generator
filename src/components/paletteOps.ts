import type { RgbColor } from '../shared/pixel/color'

interface PaletteLimits {
  readonly minimum: number
  readonly maximum: number
  readonly insert?: (palette: readonly RgbColor[]) => readonly RgbColor[]
}

interface PaletteMinimum {
  readonly minimum: number
}

/** Inserts a midpoint at the requested position, or uses the slot's custom insertion rule. */
export function insertColor(palette: readonly RgbColor[], at: number, slot: PaletteLimits): readonly RgbColor[] {
  if (palette.length === 0 || palette.length >= slot.maximum) return palette
  if (slot.insert) return slot.insert(palette).slice(0, slot.maximum)

  const index = Math.max(0, Math.min(at, palette.length))
  const leftIndex = palette.length === 1 ? 0 : index === 0 ? 0 : index === palette.length ? palette.length - 2 : index - 1
  const rightIndex = palette.length === 1 ? 0 : index === 0 ? 1 : index === palette.length ? palette.length - 1 : index
  const left = palette[leftIndex]
  const right = palette[rightIndex]
  const midpoint: RgbColor = {
    r: Math.round((left.r + right.r) / 2),
    g: Math.round((left.g + right.g) / 2),
    b: Math.round((left.b + right.b) / 2),
    a: Math.round((left.a + right.a) / 2),
  }
  return [...palette.slice(0, index), midpoint, ...palette.slice(index)]
}

/** Removes a color while preserving the slot's minimum palette size. */
export function removeColor(palette: readonly RgbColor[], index: number, slot: PaletteMinimum): readonly RgbColor[] {
  if (palette.length <= slot.minimum || index < 0 || index >= palette.length) return palette
  return palette.filter((_, colorIndex) => colorIndex !== index)
}

/** Swaps a color with an adjacent entry, leaving invalid moves unchanged. */
export function moveColor(palette: readonly RgbColor[], from: number, to: number): readonly RgbColor[] {
  if (from < 0 || from >= palette.length || to < 0 || to >= palette.length || Math.abs(from - to) !== 1) return palette
  const next = [...palette]
  ;[next[from], next[to]] = [next[to], next[from]]
  return next
}

/** Applies a validated #RRGGBB value while retaining the current alpha. */
export function setColorHex(palette: readonly RgbColor[], index: number, hex: string): readonly RgbColor[] {
  if (index < 0 || index >= palette.length || !/^#[0-9a-fA-F]{6}$/.test(hex)) return palette
  const color = palette[index]
  const next = [...palette]
  next[index] = {
    r: Number.parseInt(hex.slice(1, 3), 16),
    g: Number.parseInt(hex.slice(3, 5), 16),
    b: Number.parseInt(hex.slice(5, 7), 16),
    a: color.a,
  }
  return next
}

/** Sets one alpha channel, clamped to an integer byte. */
export function setColorAlpha(palette: readonly RgbColor[], index: number, alpha: number): readonly RgbColor[] {
  if (index < 0 || index >= palette.length || !Number.isFinite(alpha)) return palette
  const color = palette[index]
  const next = [...palette]
  next[index] = { ...color, a: Math.round(Math.min(255, Math.max(0, alpha))) }
  return next
}
