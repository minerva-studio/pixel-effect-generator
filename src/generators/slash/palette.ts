import type { RgbColor } from '../../shared/pixel/color'
import { assertValidColor } from '../../shared/pixel/color'

/** Maps a radial position into the ordered color band index. */
export function colorBandIndex(radialProgress: number, colorCount: number): number {
  return Math.min(colorCount - 1, Math.floor(radialProgress * colorCount))
}

/** Inserts a generated color before the outermost band without mutating the input. */
export function insertPaletteColor(palette: readonly RgbColor[]): readonly RgbColor[] {
  if (palette.length < 2 || palette.length >= 6) {
    throw new RangeError('Palette must contain between 2 and 5 colors before insertion.')
  }
  const insertionIndex = palette.length - 1
  return [
    ...palette.slice(0, insertionIndex),
    mixColor(palette[insertionIndex - 1], palette[insertionIndex]),
    palette[insertionIndex],
  ]
}

/** Removes one color while preserving the renderer's minimum two-band contract. */
export function removePaletteColor(palette: readonly RgbColor[], index: number): readonly RgbColor[] {
  if (palette.length <= 2) {
    throw new RangeError('A slash palette requires at least two colors.')
  }
  if (!Number.isInteger(index) || index < 0 || index >= palette.length) {
    throw new RangeError('Palette index is out of range.')
  }
  return palette.filter((_, colorIndex) => colorIndex !== index)
}

function mixColor(first: RgbColor, second: RgbColor): RgbColor {
  return {
    r: Math.round((first.r + second.r) / 2),
    g: Math.round((first.g + second.g) / 2),
    b: Math.round((first.b + second.b) / 2),
    a: Math.round((first.a + second.a) / 2),
  }
}

export { assertValidColor }
