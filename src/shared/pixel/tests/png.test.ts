import { describe, expect, it } from 'vitest'
import * as UPNG from 'upng-js'
import type { PixelFrame } from '../frame'
import { encodePng } from '../png'

function sampleFrame(width: number, height: number): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index += 1) {
    pixels[index * 4] = (index * 7) & 255
    pixels[index * 4 + 1] = (index * 13) & 255
    pixels[index * 4 + 2] = (index * 29) & 255
    pixels[index * 4 + 3] = index % 8 === 0 ? 0 : 255
  }
  return { width, height, pixels }
}

describe('encodePng', () => {
  it('round-trips RGBA pixels losslessly through PNG', () => {
    for (const [width, height] of [[16, 16], [256, 128], [512, 512]] as const) {
      const frame = sampleFrame(width, height)
      const bytes = encodePng(frame)
      const decoded = UPNG.decode(bytes.buffer as ArrayBuffer)
      expect(decoded.width).toBe(width)
      expect(decoded.height).toBe(height)
      const rgba = new Uint8ClampedArray(UPNG.toRGBA8(decoded)[0])
      expect(Array.from(rgba)).toEqual(Array.from(frame.pixels))
    }
  })

  it('produces identical bytes for identical frames and copies the source', () => {
    const frame = sampleFrame(32, 32)
    const first = encodePng(frame)
    const second = encodePng({ ...frame, pixels: new Uint8ClampedArray(frame.pixels) })
    expect(bytesEqual(first, second)).toBe(true)
    expect(Array.from(frame.pixels)).toEqual(Array.from(sampleFrame(32, 32).pixels))
  })

  it('rejects invalid dimensions and mismatched buffers', () => {
    expect(() => encodePng({ width: 0, height: 16, pixels: new Uint8ClampedArray(0) })).toThrow(RangeError)
    expect(() => encodePng({ width: 16, height: 16, pixels: new Uint8ClampedArray(10) })).toThrow(RangeError)
  })
})

function bytesEqual(left: Uint8Array, right: Uint8Array): boolean {
  if (left.length !== right.length) {
    return false
  }
  for (let index = 0; index < left.length; index += 1) {
    if (left[index] !== right[index]) {
      return false
    }
  }
  return true
}
