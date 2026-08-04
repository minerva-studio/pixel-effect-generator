import { describe, expect, it } from 'vitest'
import { DEFAULT_SLASH_PARAMETERS } from '../model'
import { insertPaletteColor, removePaletteColor } from '../palette'

describe('palette editing', () => {
  it('adds and removes palette colors without mutating the source', () => {
    const source = [
      DEFAULT_SLASH_PARAMETERS.palette[0],
      DEFAULT_SLASH_PARAMETERS.palette.at(-1)!,
    ]
    const inserted = insertPaletteColor(source)
    const removed = removePaletteColor(inserted, 1)

    expect(source).toHaveLength(2)
    expect(inserted).toEqual(DEFAULT_SLASH_PARAMETERS.palette)
    expect(removed).toEqual(source)
  })
})
