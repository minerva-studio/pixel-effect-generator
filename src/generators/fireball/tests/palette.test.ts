import { describe, expect, it } from 'vitest'
import { fitFireballPalette } from '../palette'

describe('fireball palette fitting', () => {
  it('keeps endpoints and interpolates a saved two-color ramp into five bands', () => {
    const source = [
      { r: 0, g: 20, b: 40, a: 255 },
      { r: 200, g: 120, b: 80, a: 155 },
    ]
    expect(fitFireballPalette(source, 5)).toEqual([
      { r: 0, g: 20, b: 40, a: 255 },
      { r: 50, g: 45, b: 50, a: 230 },
      { r: 100, g: 70, b: 60, a: 205 },
      { r: 150, g: 95, b: 70, a: 180 },
      { r: 200, g: 120, b: 80, a: 155 },
    ])
  })
})
