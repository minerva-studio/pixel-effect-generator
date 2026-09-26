import { describe, expect, it } from 'vitest'
import type { RgbColor } from '../shared/pixel/color'
import { insertColor, moveColor, removeColor, setColorAlpha, setColorHex } from './paletteOps'

const palette: readonly RgbColor[] = [
  { r: 0, g: 20, b: 40, a: 255 },
  { r: 100, g: 120, b: 140, a: 200 },
  { r: 200, g: 220, b: 240, a: 100 },
]

describe('palette operations', () => {
  it('inserts the midpoint between adjacent colors and respects maximum size', () => {
    expect(insertColor(palette, 1, { minimum: 1, maximum: 4 })).toEqual([
      palette[0], { r: 50, g: 70, b: 90, a: 228 }, palette[1], palette[2],
    ])
    const full = [palette[0], palette[1]]
    expect(insertColor(full, 2, { minimum: 1, maximum: 2 })).toBe(full)
  })

  it('uses a slot insertion function when provided', () => {
    const slotInsert = (colors: readonly RgbColor[]) => [...colors, { r: 9, g: 8, b: 7, a: 255 }]
    expect(insertColor(palette, 3, { minimum: 1, maximum: 4, insert: slotInsert })).toEqual([
      ...palette, { r: 9, g: 8, b: 7, a: 255 },
    ])
  })

  it('can insert into a one-color palette without reading outside its bounds', () => {
    const single = [palette[0]]
    expect(insertColor(single, 0, { minimum: 1, maximum: 2 })).toEqual([
      { r: 0, g: 20, b: 40, a: 255 }, palette[0],
    ])
  })

  it('removes a color only above the slot minimum', () => {
    expect(removeColor(palette, 1, { minimum: 2 })).toEqual([palette[0], palette[2]])
    const minimumPalette = [palette[0], palette[1]]
    expect(removeColor(minimumPalette, 0, { minimum: 2 })).toBe(minimumPalette)
  })

  it('moves colors by swapping them with the adjacent position', () => {
    expect(moveColor(palette, 0, 1)).toEqual([palette[1], palette[0], palette[2]])
    expect(moveColor(palette, 0, -1)).toBe(palette)
  })

  it('sets RGB from a valid six-digit HEX value and ignores invalid values', () => {
    expect(setColorHex(palette, 1, '#ABCDEF')).toEqual([palette[0], { r: 171, g: 205, b: 239, a: 200 }, palette[2]])
    expect(setColorHex(palette, 1, '#abc')).toBe(palette)
  })

  it('sets alpha inside the byte range', () => {
    expect(setColorAlpha(palette, 1, 42)[1]).toEqual({ ...palette[1], a: 42 })
    expect(setColorAlpha(palette, 1, 300)[1]).toEqual({ ...palette[1], a: 255 })
  })
})
