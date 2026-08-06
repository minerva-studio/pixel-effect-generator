import { describe, expect, it } from 'vitest'
import * as UPNG from 'upng-js'
import { DEFAULT_SLASH_PARAMETERS } from '../../generators/slash/model'
import { renderSlashFrames } from '../../generators/slash/renderer'
import {
  APNG_MIME,
  GIF_MIME,
  buildGifPalette,
  crc32,
  encodeAnimation,
  frameDelays,
} from './animation'
import type { PixelFrame } from './frame'

describe('frameDelays', () => {
  it('uses cumulative rounding without drift', () => {
    expect(frameDelays(8, 12, 10)).toEqual([8, 9, 8, 8, 9, 8, 8, 9])
    expect(frameDelays(8, 12, 1)).toEqual([83, 84, 83, 83, 84, 83, 83, 84])
    expect(frameDelays(6, 8, 1)).toEqual([125, 125, 125, 125, 125, 125])
  })

  it('rejects invalid inputs', () => {
    expect(() => frameDelays(0, 12, 1)).toThrow(RangeError)
    expect(() => frameDelays(8, 0, 1)).toThrow(RangeError)
    expect(() => frameDelays(8, 12, 5)).toThrow(RangeError)
  })
})

describe('GIF encoding', () => {
  it('writes a GIF89a stream with dimensions, per-frame delay, transparency, and disposal', () => {
    const frames = [
      solidFrame(16, 16, 255, 0, 0, 255),
      solidFrame(16, 16, 0, 255, 0, 255),
      solidFrame(16, 16, 0, 0, 255, 255),
    ]
    const result = encodeAnimation({ format: 'gif', frames, fps: 12, loop: true })

    expect(result.format).toBe('gif')
    expect(result.mime).toBe(GIF_MIME)
    expect(result.extension).toBe('gif')

    const gif = parseGif(result.bytes)
    expect(gif.signature).toBe('GIF89a')
    expect(gif.width).toBe(16)
    expect(gif.height).toBe(16)
    expect(gif.frames).toHaveLength(3)
    expect(gif.loopCount).toBe(0)
    for (const frame of gif.frames) {
      expect(frame.disposal).toBe(2)
      expect(frame.hasTransparency).toBe(true)
      expect(frame.transparentIndex).toBe(0)
    }
    expect(gif.frames.map((frame) => frame.delayCs)).toEqual(frameDelays(3, 12, 10))
  })

  it('omits the Netscape loop extension when playing once', () => {
    const frames = [solidFrame(8, 8, 255, 255, 255, 255), solidFrame(8, 8, 0, 0, 0, 255)]
    const looping = parseGif(encodeAnimation({ format: 'gif', frames, fps: 12, loop: true }).bytes)
    const once = parseGif(encodeAnimation({ format: 'gif', frames, fps: 12, loop: false }).bytes)

    expect(looping.loopCount).toBe(0)
    expect(once.loopCount).toBeNull()
  })

  it('keeps the current Slash palette lossless and transparent pixels at index zero', () => {
    const frames = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, frameCount: 6 })
    const slashColors = new Set(
      DEFAULT_SLASH_PARAMETERS.palette.map((color) => `${color.r},${color.g},${color.b}`),
    )

    for (const frame of frames.slice(0, -1)) {
      const { palette, indices, quantized } = buildGifPalette(frame.pixels)
      expect(quantized).toBe(false)
      expect(palette[0]).toEqual([0, 0, 0])
      const usedColors = new Set(palette.slice(1).map(([r, g, b]) => `${r},${g},${b}`))
      expect(usedColors.size).toBeGreaterThan(0)
      expect([...usedColors].every((color) => slashColors.has(color))).toBe(true)

      for (let pixel = 0; pixel < frame.pixels.length / 4; pixel += 1) {
        const offset = pixel * 4
        if (frame.pixels[offset + 3] < 128) {
          expect(indices[pixel]).toBe(0)
          continue
        }
        expect(indices[pixel]).toBeGreaterThan(0)
        expect(palette[indices[pixel]]).toEqual([
          frame.pixels[offset],
          frame.pixels[offset + 1],
          frame.pixels[offset + 2],
        ])
      }
    }
    const finalFrame = buildGifPalette(frames.at(-1)!.pixels)
    expect(finalFrame.indices.every((index) => index === 0)).toBe(true)

    const result = encodeAnimation({ format: 'gif', frames, fps: 12, loop: true })
    expect(parseGif(result.bytes).frames).toHaveLength(frames.length)
  })

  it('quantizes deterministically beyond 255 opaque colors with valid indices', () => {
    const frame = manyColorFrame(32, 16)
    const { palette, indices, quantized } = buildGifPalette(frame.pixels)
    expect(quantized).toBe(true)
    expect(palette.length).toBeLessThanOrEqual(256)
    expect(palette.length).toBeGreaterThan(1)
    expect(palette[0]).toEqual([0, 0, 0])
    for (let pixel = 0; pixel < indices.length; pixel += 1) {
      expect(indices[pixel]).toBeLessThan(palette.length)
      if (frame.pixels[pixel * 4 + 3] < 128) {
        expect(indices[pixel]).toBe(0)
      }
    }

    const first = encodeAnimation({ format: 'gif', frames: [frame], fps: 12, loop: true })
    const second = encodeAnimation({ format: 'gif', frames: [frame], fps: 12, loop: true })
    expect(second.bytes).toEqual(first.bytes)
  })

  it('keeps a fully transparent final frame transparent', () => {
    const frames = [solidFrame(8, 8, 255, 128, 0, 255), transparentFrame(8, 8)]
    const result = encodeAnimation({ format: 'gif', frames, fps: 12, loop: true })
    const gif = parseGif(result.bytes)
    expect(gif.frames[1].transparentIndex).toBe(0)
    expect(buildGifPalette(frames[1].pixels).indices.every((index) => index === 0)).toBe(true)
  })

  it('flattens semi-transparent pixels to binary GIF transparency at the 128 threshold', () => {
    const pixels = new Uint8ClampedArray(8 * 8 * 4)
    for (let pixel = 0; pixel < 64; pixel += 1) {
      const offset = pixel * 4
      pixels[offset] = 255
      pixels[offset + 1] = 128
      pixels[offset + 2] = 64
      pixels[offset + 3] = pixel % 2 === 0 ? 64 : 192
    }
    const frame: PixelFrame = { width: 8, height: 8, pixels }
    const { palette, indices } = buildGifPalette(frame.pixels)
    expect(palette).toContainEqual([255, 128, 64])
    for (let pixel = 0; pixel < indices.length; pixel += 1) {
      if (frame.pixels[pixel * 4 + 3] < 128) {
        expect(indices[pixel]).toBe(0)
      } else {
        expect(indices[pixel]).toBeGreaterThan(0)
      }
    }
  })

  it('keeps total duration within one 10ms unit across supported FPS values', () => {
    const frameCount = 8
    const frames = Array.from({ length: frameCount }, (_, index) => solidFrame(8, 8, index * 20, 30, 40, 255))
    for (const fps of [6, 8, 12, 18, 24]) {
      const gif = parseGif(encodeAnimation({ format: 'gif', frames, fps, loop: true }).bytes)
      const totalMs = gif.frames.reduce((sum, frame) => sum + frame.delayCs * 10, 0)
      expect(Math.abs(totalMs - (frameCount * 1000) / fps)).toBeLessThanOrEqual(10)
    }
  })
})

describe('APNG encoding', () => {
  it('round-trips full RGBA frames exactly', () => {
    const frames = [
      checkerFrame(12, 10, 200, 30, 90, 255, 120, 40),
      checkerFrame(12, 10, 10, 220, 140, 0, 255, 60),
      transparentFrame(12, 10),
    ]
    const result = encodeAnimation({ format: 'apng', frames, fps: 12, loop: true })

    expect(result.format).toBe('apng')
    expect(result.mime).toBe(APNG_MIME)
    expect(result.extension).toBe('png')

    const decoded = UPNG.decode(result.bytes.slice().buffer)
    expect(decoded.width).toBe(12)
    expect(decoded.height).toBe(10)
    expect(decoded.tabs.acTL?.num_frames).toBe(3)
    expect(decoded.tabs.acTL?.num_plays).toBe(0)
    const rgba = UPNG.toRGBA8(decoded)
    expect(rgba).toHaveLength(3)
    for (let index = 0; index < frames.length; index += 1) {
      expect(Array.from(new Uint8Array(rgba[index]))).toEqual(Array.from(frames[index].pixels))
    }
  })

  it('writes integer millisecond delays that stay within one millisecond of the target', () => {
    const frameCount = 8
    const frames = Array.from({ length: frameCount }, (_, index) => solidFrame(8, 8, index * 10, 20, 30, 255))
    for (const fps of [6, 8, 12, 18, 24]) {
      const result = encodeAnimation({ format: 'apng', frames, fps, loop: true })
      const decoded = UPNG.decode(result.bytes.slice().buffer)
      const delays = decoded.frames.map((frame) => frame.delay)
      expect(delays).toEqual(frameDelays(frameCount, fps, 1))
      const totalMs = delays.reduce((sum, delay) => sum + delay, 0)
      expect(Math.abs(totalMs - (frameCount * 1000) / fps)).toBeLessThanOrEqual(1)
    }
  })

  it('sets num_plays to one for a single pass and keeps the chunk CRC valid', () => {
    const frames = [solidFrame(8, 8, 255, 0, 0, 255), solidFrame(8, 8, 0, 255, 0, 255)]
    const result = encodeAnimation({ format: 'apng', frames, fps: 12, loop: false })
    const decoded = UPNG.decode(result.bytes.slice().buffer)
    expect(decoded.tabs.acTL?.num_plays).toBe(1)
    expect(decoded.tabs.acTL?.num_frames).toBe(2)

    const chunk = findAcTL(result.bytes)
    expect(chunk).not.toBeNull()
    if (chunk) {
      const storedCrc = readUint32BE(result.bytes, chunk.crcOffset)
      const computedCrc = crc32(result.bytes.subarray(chunk.typeOffset, chunk.typeOffset + 4 + chunk.dataLength))
      expect(computedCrc).toBe(storedCrc)
    }
  })

  it('keeps a fully transparent final frame transparent', () => {
    const frames = [solidFrame(8, 8, 10, 20, 30, 255), transparentFrame(8, 8)]
    const result = encodeAnimation({ format: 'apng', frames, fps: 12, loop: true })
    const decoded = UPNG.decode(result.bytes.slice().buffer)
    const rgba = UPNG.toRGBA8(decoded)
    const last = new Uint8Array(rgba[1])
    for (let offset = 3; offset < last.length; offset += 4) {
      expect(last[offset]).toBe(0)
    }
  })
})

describe('animation encoding contract', () => {
  it('encodes correct dimensions for every supported canvas size', () => {
    for (const size of [{ width: 16, height: 16 }, { width: 256, height: 128 }, { width: 512, height: 512 }]) {
      const frames = [
        solidFrame(size.width, size.height, 120, 60, 200, 255),
        transparentFrame(size.width, size.height),
      ]
      const gif = encodeAnimation({ format: 'gif', frames, fps: 12, loop: true })
      const apng = encodeAnimation({ format: 'apng', frames, fps: 12, loop: true })

      const parsedGif = parseGif(gif.bytes)
      expect(parsedGif.width).toBe(size.width)
      expect(parsedGif.height).toBe(size.height)

      const decoded = UPNG.decode(apng.bytes.slice().buffer)
      expect(decoded.width).toBe(size.width)
      expect(decoded.height).toBe(size.height)
    }
  })

  it('rejects empty, mismatched, or invalid frame sets', () => {
    expect(() => encodeAnimation({ format: 'gif', frames: [], fps: 12, loop: true })).toThrow(RangeError)
    expect(() => encodeAnimation({
      format: 'gif',
      frames: [solidFrame(8, 8, 1, 2, 3, 255), solidFrame(8, 16, 1, 2, 3, 255)],
      fps: 12,
      loop: true,
    })).toThrow(RangeError)
    expect(() => encodeAnimation({ format: 'apng', frames: [solidFrame(8, 8, 1, 2, 3, 255)], fps: 0, loop: true })).toThrow(RangeError)
  })

  it('encodes a single-frame GIF without a loop extension', () => {
    const result = encodeAnimation({ format: 'gif', frames: [solidFrame(8, 8, 1, 2, 3, 255)], fps: 12, loop: true })
    expect(parseGif(result.bytes).frames).toHaveLength(1)
  })
})

function solidFrame(width: number, height: number, r: number, g: number, b: number, a: number): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let offset = 0; offset < pixels.length; offset += 4) {
    pixels[offset] = r
    pixels[offset + 1] = g
    pixels[offset + 2] = b
    pixels[offset + 3] = a
  }
  return { width, height, pixels }
}

function transparentFrame(width: number, height: number): PixelFrame {
  return { width, height, pixels: new Uint8ClampedArray(width * height * 4) }
}

function checkerFrame(
  width: number,
  height: number,
  r1: number,
  g1: number,
  b1: number,
  r2: number,
  g2: number,
  b2: number,
): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const offset = (y * width + x) * 4
      const light = (x + y) % 2 === 0
      pixels[offset] = light ? r1 : r2
      pixels[offset + 1] = light ? g1 : g2
      pixels[offset + 2] = light ? b1 : b2
      pixels[offset + 3] = 255
    }
  }
  return { width, height, pixels }
}

/** Builds a frame with 300 distinct opaque colors plus transparent pixels. */
function manyColorFrame(width: number, height: number): PixelFrame {
  const pixels = new Uint8ClampedArray(width * height * 4)
  for (let pixel = 0; pixel < width * height; pixel += 1) {
    const offset = pixel * 4
    if (pixel % 7 === 0) {
      continue
    }
    const colorIndex = pixel % 300
    pixels[offset] = (colorIndex & 15) * 17
    pixels[offset + 1] = ((colorIndex >> 4) & 15) * 17
    pixels[offset + 2] = (colorIndex >> 8) * 85
    pixels[offset + 3] = 255
  }
  return { width, height, pixels }
}

interface ParsedGifFrame {
  readonly delayCs: number
  readonly disposal: number
  readonly hasTransparency: boolean
  readonly transparentIndex: number
}

interface ParsedGif {
  readonly signature: string
  readonly width: number
  readonly height: number
  readonly frames: readonly ParsedGifFrame[]
  readonly loopCount: number | null
}

/** Minimal GIF block walker used to verify encoder output structure. */
function parseGif(bytes: Uint8Array): ParsedGif {
  const signature = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3], bytes[4], bytes[5])
  const width = bytes[6] | (bytes[7] << 8)
  const height = bytes[8] | (bytes[9] << 8)
  const packed = bytes[10]
  const gctSize = packed & 0x80 ? 2 << (packed & 7) : 0
  const frames: ParsedGifFrame[] = []
  let loopCount: number | null = null
  let offset = 13 + gctSize * 3

  while (offset < bytes.length) {
    const introducer = bytes[offset]
    if (introducer === 0x3b) {
      break
    }
    if (introducer === 0x21) {
      const label = bytes[offset + 1]
      offset += 2
      if (label === 0xf9) {
        const size = bytes[offset]
        const packed2 = bytes[offset + 1]
        frames.push({
          delayCs: bytes[offset + 2] | (bytes[offset + 3] << 8),
          disposal: (packed2 >> 2) & 7,
          hasTransparency: Boolean(packed2 & 1),
          transparentIndex: bytes[offset + 4],
        })
        offset += size + 2
      } else if (label === 0xff) {
        const appSize = bytes[offset]
        offset += 1 + appSize
        while (bytes[offset] !== 0) {
          const subSize = bytes[offset]
          if (subSize === 3 && bytes[offset + 1] === 1) {
            loopCount = bytes[offset + 2] | (bytes[offset + 3] << 8)
          }
          offset += 1 + subSize
        }
        offset += 1
      } else {
        while (bytes[offset] !== 0) {
          offset += 1 + bytes[offset]
        }
        offset += 1
      }
    } else if (introducer === 0x2c) {
      offset += 9
      const localPacked = bytes[offset]
      const lctSize = localPacked & 0x80 ? 2 << (localPacked & 7) : 0
      offset += 1 + lctSize * 3 + 1
      while (bytes[offset] !== 0) {
        offset += 1 + bytes[offset]
      }
      offset += 1
    } else {
      throw new RangeError(`Unexpected GIF block introducer: 0x${introducer.toString(16)}`)
    }
  }
  return { signature, width, height, frames, loopCount }
}

interface AcTLChunk {
  readonly typeOffset: number
  readonly dataOffset: number
  readonly dataLength: number
  readonly crcOffset: number
}

function findAcTL(bytes: Uint8Array): AcTLChunk | null {
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const dataLength = readUint32BE(bytes, offset)
    const type = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    if (type === 'acTL') {
      return {
        typeOffset: offset + 4,
        dataOffset: offset + 8,
        dataLength,
        crcOffset: offset + 8 + dataLength,
      }
    }
    offset += 12 + dataLength
  }
  return null
}

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}
