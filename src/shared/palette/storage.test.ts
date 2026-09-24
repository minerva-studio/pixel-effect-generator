import { describe, expect, it } from 'vitest'
import { builtinPalette } from './library'
import { MAX_CUSTOM_PALETTES, normalizePaletteName, PALETTE_STORAGE_KEY, readCustomPalettes, writeCustomPalettes, type PaletteStorage, type StoredPalette } from './storage'

function memoryStorage(): PaletteStorage {
  const data = new Map<string, string>()
  return { getItem: (key) => data.get(key) ?? null, setItem: (key, value) => { data.set(key, value) } }
}

describe('custom color library storage', () => {
  const original: StoredPalette = { id: 'one', name: 'Warm', colors: builtinPalette('flameGlow') }

  it('saves, updates, renames, and deletes colors by stable id', () => {
    const storage = memoryStorage()
    expect(writeCustomPalettes([original], storage)).toBe(true)
    expect(readCustomPalettes(storage)).toEqual({ palettes: [original], warning: false })
    const changed = { ...original, name: '  Warm  '.trim(), colors: builtinPalette('irisBloom') }
    expect(writeCustomPalettes([changed], storage)).toBe(true)
    expect(readCustomPalettes(storage).palettes[0]).toEqual(changed)
    expect(writeCustomPalettes([{ ...changed, name: 'Cool' }], storage)).toBe(true)
    expect(readCustomPalettes(storage).palettes[0].name).toBe('Cool')
    expect(writeCustomPalettes([], storage)).toBe(true)
    expect(readCustomPalettes(storage).palettes).toEqual([])
  })

  it('rejects bad names, duplicate ids, count overflow, and invalid colors', () => {
    expect(normalizePaletteName('  Cool ')).toBe('Cool')
    expect(normalizePaletteName(' ')).toBeNull()
    expect(normalizePaletteName('x'.repeat(41))).toBeNull()
    const storage = memoryStorage()
    expect(writeCustomPalettes([original, original], storage)).toBe(false)
    expect(writeCustomPalettes([{ ...original, name: ' bad ' }], storage)).toBe(false)
    expect(writeCustomPalettes(Array.from({ length: MAX_CUSTOM_PALETTES + 1 }, (_, index) => ({ ...original, id: String(index) })), storage)).toBe(false)
    expect(writeCustomPalettes([{ ...original, colors: [{ ...original.colors[0], a: 300 }, original.colors[1]] }], storage)).toBe(false)
  })

  it('warns on malformed data and handles unavailable or failing storage', () => {
    const storage = memoryStorage()
    storage.setItem(PALETTE_STORAGE_KEY, '{bad json')
    expect(readCustomPalettes(storage)).toEqual({ palettes: [], warning: true })
    storage.setItem(PALETTE_STORAGE_KEY, JSON.stringify({ schema: 2, palettes: [original] }))
    expect(readCustomPalettes(storage).warning).toBe(true)
    expect(readCustomPalettes(null)).toEqual({ palettes: [], warning: false })
    expect(writeCustomPalettes([original], null)).toBe(false)
    const failure: PaletteStorage = { getItem: () => { throw Error('blocked') }, setItem: () => { throw Error('quota') } }
    expect(readCustomPalettes(failure).warning).toBe(true)
    expect(writeCustomPalettes([original], failure)).toBe(false)
  })
})
