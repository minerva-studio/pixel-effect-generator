import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../frame'
import { chooseCompactColumns, packSpriteSheet } from '../atlas'
import { packHorizontalSheet } from '../spritesheet'

function sampleFrame(index: number, width = 128, height = 128): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = index
    pixels[offset + 1] = index * 2
    pixels[offset + 2] = index * 3
    pixels[offset + 3] = 255
  }
  return { width, height, pixels }
}

describe('chooseCompactColumns', () => {
  it('picks the most square grid for common frame counts', () => {
    expect(chooseCompactColumns(5, 128, 128)).toBe(2)
    expect(chooseCompactColumns(8, 128, 128)).toBe(3)
    expect(chooseCompactColumns(12, 128, 128)).toBe(3)
    expect(chooseCompactColumns(17, 128, 128)).toBe(4)
    expect(chooseCompactColumns(24, 128, 128)).toBe(5)
  })

  it('prefers fewer empty cells and fewer columns on ties', () => {
    expect(chooseCompactColumns(6, 128, 128)).toBe(2)
    expect(chooseCompactColumns(1, 128, 128)).toBe(1)
    expect(() => chooseCompactColumns(0, 128, 128)).toThrow(RangeError)
  })

  it('keeps aspect-aware layouts for non-square frames', () => {
    expect(chooseCompactColumns(8, 256, 128)).toBe(2)
    expect(chooseCompactColumns(8, 128, 256)).toBe(4)
  })
})

describe('packSpriteSheet', () => {
  it('keeps horizontal packing byte-identical to the existing helper', () => {
    const frames = [sampleFrame(0), sampleFrame(1), sampleFrame(2)]
    const packed = packSpriteSheet(frames, 'horizontal', 'slash')
    expect(packed.frame).toEqual(packHorizontalSheet(frames))
    expect(packed.columns).toBe(3)
    expect(packed.rows).toBe(1)
    expect(packed.sprites.map((sprite) => sprite.name)).toEqual(['slash_000', 'slash_001', 'slash_002'])
  })

  it('packs compact grids row-major and restores every frame', () => {
    const frames = Array.from({ length: 8 }, (_, index) => sampleFrame(index))
    const packed = packSpriteSheet(frames, 'compact', 'slash')
    expect(packed.columns).toBe(3)
    expect(packed.rows).toBe(3)
    expect(packed.frame.width).toBe(384)
    expect(packed.frame.height).toBe(384)
    for (const sprite of packed.sprites) {
      expect(extractRect(packed.frame, sprite)).toEqual(Array.from(frames[sprite.index].pixels))
    }
  })

  it('leaves unused compact grid cells fully transparent', () => {
    const frames = Array.from({ length: 8 }, (_, index) => sampleFrame(index))
    const packed = packSpriteSheet(frames, 'compact', 'slash')
    for (let y = 256; y < 384; y += 1) {
      for (let x = 256; x < 384; x += 1) {
        const offset = (y * 384 + x) * 4
        expect(packed.frame.pixels[offset]).toBe(0)
        expect(packed.frame.pixels[offset + 3]).toBe(0)
      }
    }
  })

  it('works for square, horizontal, and vertical canvases', () => {
    expect(packSpriteSheet(Array.from({ length: 5 }, () => sampleFrame(1)), 'compact', 's').frame.width).toBe(256)
    expect(packSpriteSheet(Array.from({ length: 5 }, () => sampleFrame(1, 256, 128)), 'compact', 's').frame.width).toBe(512)
    expect(packSpriteSheet(Array.from({ length: 5 }, () => sampleFrame(1, 128, 256)), 'compact', 's').frame.height).toBe(512)
  })

  it('rejects empty frame sets', () => {
    expect(() => packSpriteSheet([], 'compact', 's')).toThrow(RangeError)
  })
})

function extractRect(sheet: PixelFrame, sprite: { x: number; y: number; width: number; height: number }): number[] {
  const pixels: number[] = []
  for (let y = 0; y < sprite.height; y += 1) {
    const start = ((sprite.y + y) * sheet.width + sprite.x) * 4
    pixels.push(...sheet.pixels.subarray(start, start + sprite.width * 4))
  }
  return pixels
}
