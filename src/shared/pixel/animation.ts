import { GIFEncoder, applyPalette, quantize } from 'gifenc'
import * as UPNG from 'upng-js'
import type { PixelFrame } from './frame'

export type AnimationFormat = 'gif' | 'apng'

export const GIF_MIME = 'image/gif'
export const APNG_MIME = 'image/png'

/** Contract for encoding one animation from already-rendered frames. */
export interface AnimationEncodeInput {
  readonly format: AnimationFormat
  readonly frames: readonly PixelFrame[]
  readonly fps: number
  readonly loop: boolean
}

/** Encoded animation with the MIME type and extension needed for download. */
export interface AnimationResult {
  readonly format: AnimationFormat
  readonly mime: string
  readonly extension: string
  readonly bytes: Uint8Array
}

/** Palette build result kept visible for losslessness verification. */
export interface GifPaletteBuild {
  readonly palette: readonly (readonly [number, number, number])[]
  readonly indices: Uint8Array
  readonly quantized: boolean
}

/**
 * Computes per-frame delays with cumulative rounding so the total duration
 * never drifts. `unitMs` is 1 for APNG (integer milliseconds) and 10 for GIF
 * (centiseconds), making non-divisible FPS alternate between adjacent units.
 */
export function frameDelays(frameCount: number, fps: number, unitMs: number): number[] {
  if (!Number.isInteger(frameCount) || frameCount <= 0) {
    throw new RangeError('frameCount must be a positive integer.')
  }
  if (!Number.isFinite(fps) || fps <= 0) {
    throw new RangeError('fps must be a positive number.')
  }
  if (unitMs !== 1 && unitMs !== 10) {
    throw new RangeError('unitMs must be 1 (APNG) or 10 (GIF).')
  }
  const delays: number[] = []
  let previous = 0
  for (let frameIndex = 1; frameIndex <= frameCount; frameIndex += 1) {
    const cumulative = Math.round((frameIndex * 1000) / fps / unitMs)
    delays.push(cumulative - previous)
    previous = cumulative
  }
  return delays
}

/** Encodes an animation from a frame set without touching the renderer. */
export function encodeAnimation(input: AnimationEncodeInput): AnimationResult {
  validateFrames(input.frames)
  if (!Number.isFinite(input.fps) || input.fps <= 0) {
    throw new RangeError('fps must be a positive number.')
  }
  if (input.format === 'gif') {
    return {
      format: 'gif',
      mime: GIF_MIME,
      extension: 'gif',
      bytes: encodeGif(input.frames, input.fps, input.loop),
    }
  }
  return {
    format: 'apng',
    mime: APNG_MIME,
    extension: 'png',
    bytes: encodeApng(input.frames, input.fps, input.loop),
  }
}

/**
 * Builds an indexed frame with palette index 0 fixed as transparent. Up to 255
 * opaque colors map exactly; beyond that the opaque colors are deterministically
 * quantized to 255 and transparent pixels always keep index 0.
 */
export function buildGifPalette(rgba: Uint8ClampedArray): GifPaletteBuild {
  const pixelCount = rgba.length / 4
  const indices = new Uint8Array(pixelCount)
  const colorToIndex = new Map<number, number>()
  let nextIndex = 1
  let needsQuantization = false

  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4
    if (rgba[offset + 3] < 128) {
      indices[pixel] = 0
      continue
    }
    const key = (rgba[offset] << 16) | (rgba[offset + 1] << 8) | rgba[offset + 2]
    const existing = colorToIndex.get(key)
    if (existing !== undefined) {
      indices[pixel] = existing
      continue
    }
    if (colorToIndex.size >= 255) {
      needsQuantization = true
      break
    }
    colorToIndex.set(key, nextIndex)
    indices[pixel] = nextIndex
    nextIndex += 1
  }

  if (!needsQuantization) {
    const palette: [number, number, number][] = [[0, 0, 0]]
    for (const [key, index] of colorToIndex) {
      palette[index] = [(key >> 16) & 255, (key >> 8) & 255, key & 255]
    }
    return { palette, indices, quantized: false }
  }

  const opaqueCount = countOpaquePixels(rgba)
  const compacted = new Uint8Array(opaqueCount * 4)
  let compactedOffset = 0
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    const offset = pixel * 4
    if (rgba[offset + 3] < 128) {
      continue
    }
    compacted[compactedOffset] = rgba[offset]
    compacted[compactedOffset + 1] = rgba[offset + 1]
    compacted[compactedOffset + 2] = rgba[offset + 2]
    compacted[compactedOffset + 3] = 255
    compactedOffset += 4
  }

  const opaquePalette = quantize(compacted, 255)
  const mapped = applyPalette(rgba, opaquePalette)
  const palette: [number, number, number][] = [[0, 0, 0]]
  for (let index = 0; index < opaquePalette.length; index += 1) {
    palette.push([opaquePalette[index][0], opaquePalette[index][1], opaquePalette[index][2]])
  }
  for (let pixel = 0; pixel < pixelCount; pixel += 1) {
    indices[pixel] = rgba[pixel * 4 + 3] < 128 ? 0 : mapped[pixel] + 1
  }
  return { palette, indices, quantized: true }
}

function encodeGif(frames: readonly PixelFrame[], fps: number, loop: boolean): Uint8Array {
  const { width, height } = frames[0]
  const delays = frameDelays(frames.length, fps, 10)
  const gif = GIFEncoder()
  for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
    const { palette, indices } = buildGifPalette(frames[frameIndex].pixels)
    gif.writeFrame(indices, width, height, {
      palette,
      delay: delays[frameIndex] * 10,
      transparent: true,
      transparentIndex: 0,
      repeat: loop ? 0 : -1,
      dispose: 2,
    })
  }
  gif.finish()
  return gif.bytes()
}

function encodeApng(frames: readonly PixelFrame[], fps: number, loop: boolean): Uint8Array {
  const { width, height } = frames[0]
  const delays = frameDelays(frames.length, fps, 1)
  const buffers = frames.map((frame) => new Uint8Array(frame.pixels).buffer)
  const encoded = UPNG.encode(buffers, width, height, 0, delays)
  const bytes = new Uint8Array(encoded)
  if (!loop) {
    patchApngNumPlays(bytes, 1)
  }
  return bytes
}

/**
 * Overwrites the APNG `acTL.num_plays` value and recomputes the chunk CRC.
 * A missing acTL means a still image, where the loop state is irrelevant.
 */
export function patchApngNumPlays(bytes: Uint8Array, numPlays: number): void {
  const chunk = findPngChunk(bytes, 'acTL')
  if (chunk === undefined) {
    return
  }
  writeUint32BE(bytes, numPlays, chunk.dataOffset + 4)
  const crc = crc32(bytes.subarray(chunk.typeOffset, chunk.typeOffset + 4 + chunk.dataLength))
  writeUint32BE(bytes, crc, chunk.crcOffset)
}

/** PNG chunk locator used to patch metadata without re-encoding. */
interface PngChunkLocation {
  readonly typeOffset: number
  readonly dataOffset: number
  readonly dataLength: number
  readonly crcOffset: number
}

function findPngChunk(bytes: Uint8Array, type: string): PngChunkLocation | undefined {
  let offset = 8
  while (offset + 12 <= bytes.length) {
    const dataLength = readUint32BE(bytes, offset)
    const chunkType = String.fromCharCode(bytes[offset + 4], bytes[offset + 5], bytes[offset + 6], bytes[offset + 7])
    const location = {
      typeOffset: offset + 4,
      dataOffset: offset + 8,
      dataLength,
      crcOffset: offset + 8 + dataLength,
    }
    if (chunkType === type) {
      return location
    }
    offset = location.crcOffset + 4
  }
  return undefined
}

/** Standard PNG CRC-32 (reflected polynomial 0xEDB88320). */
export function crc32(bytes: Uint8Array): number {
  let crc = 0xffffffff
  for (const byte of bytes) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ byte) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

const CRC_TABLE = (() => {
  const table = new Uint32Array(256)
  for (let index = 0; index < 256; index += 1) {
    let value = index
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }
    table[index] = value >>> 0
  }
  return table
})()

function readUint32BE(bytes: Uint8Array, offset: number): number {
  return ((bytes[offset] << 24) | (bytes[offset + 1] << 16) | (bytes[offset + 2] << 8) | bytes[offset + 3]) >>> 0
}

function writeUint32BE(bytes: Uint8Array, value: number, offset: number): void {
  bytes[offset] = (value >>> 24) & 255
  bytes[offset + 1] = (value >>> 16) & 255
  bytes[offset + 2] = (value >>> 8) & 255
  bytes[offset + 3] = value & 255
}

function countOpaquePixels(rgba: Uint8ClampedArray): number {
  let count = 0
  for (let offset = 3; offset < rgba.length; offset += 4) {
    if (rgba[offset] >= 128) {
      count += 1
    }
  }
  return count
}

function validateFrames(frames: readonly PixelFrame[]): void {
  if (frames.length === 0) {
    throw new RangeError('At least one frame is required.')
  }
  const { width, height } = frames[0]
  for (const frame of frames) {
    if (frame.width !== width || frame.height !== height) {
      throw new RangeError('All frames must have the same dimensions.')
    }
  }
}
