import { describe, expect, it } from 'vitest'
import { assertValidColor, hexToRgb, rgbaToHex, rgbToHex } from './color'

describe('hexToRgb', () => {
  it('parses 6-digit hex colors as fully opaque', () => {
    expect(hexToRgb('#ff8040')).toEqual({ r: 255, g: 128, b: 64, a: 255 })
  })

  it('parses 8-digit hex colors including alpha', () => {
    expect(hexToRgb('#ff804080')).toEqual({ r: 255, g: 128, b: 64, a: 128 })
    expect(hexToRgb('#00000000').a).toBe(0)
  })

  it('rejects malformed hex strings', () => {
    expect(() => hexToRgb('ff8040')).toThrow(TypeError)
    expect(() => hexToRgb('#ff80')).toThrow(TypeError)
    expect(() => hexToRgb('#ff8040gg')).toThrow(TypeError)
  })
})

describe('hex serialization', () => {
  it('serializes both 6-digit and 8-digit forms', () => {
    const color = { r: 255, g: 128, b: 64, a: 128 }
    expect(rgbToHex(color)).toBe('#ff8040')
    expect(rgbaToHex(color)).toBe('#ff804080')
    expect(rgbaToHex({ ...color, a: 255 })).toBe('#ff8040ff')
  })
})

describe('assertValidColor', () => {
  it('accepts integer channels inside the inclusive range', () => {
    expect(() => assertValidColor({ r: 0, g: 128, b: 255, a: 0 }, 'color')).not.toThrow()
    expect(() => assertValidColor({ r: 255, g: 255, b: 255, a: 255 }, 'color')).not.toThrow()
  })

  it('rejects out-of-range or fractional alpha', () => {
    expect(() => assertValidColor({ r: 1, g: 1, b: 1, a: 256 }, 'color')).toThrow(/a must be between 0 and 255/)
    expect(() => assertValidColor({ r: 1, g: 1, b: 1, a: -1 }, 'color')).toThrow(/a must be between 0 and 255/)
    expect(() => assertValidColor({ r: 1, g: 1, b: 1, a: 1.5 }, 'color')).toThrow(/channels must be integers/)
  })
})
