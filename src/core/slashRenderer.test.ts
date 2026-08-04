import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLASH_PARAMETERS,
  FRAME_SIZE,
  packHorizontalSheet,
  renderSlashFrames,
  type SlashFrame,
} from './slashRenderer'

describe('renderSlashFrames', () => {
  it('renders deterministic frames with fixed dimensions', () => {
    const first = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)
    const second = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)

    expect(first).toHaveLength(DEFAULT_SLASH_PARAMETERS.frameCount)
    expect(first[0].width).toBe(FRAME_SIZE)
    expect(first[0].height).toBe(FRAME_SIZE)
    expect(first.map((frame) => Array.from(frame.pixels)))
      .toEqual(second.map((frame) => Array.from(frame.pixels)))
  })

  it('uses only the three color bands and transparent pixels', () => {
    const frames = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)
    const colors = collectColors(frames)

    expect(colors).toEqual(new Set([
      '0,0,0,0',
      '255,255,255,255',
      '154,198,255,255',
      '52,140,255,255',
    ]))
  })

  it('keeps intermediate frames visible and clears the final frame', () => {
    const frames = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)

    expect(countOpaquePixels(frames[0])).toBeGreaterThan(0)
    expect(countOpaquePixels(frames[Math.floor(frames.length / 2)])).toBeGreaterThan(0)
    expect(countOpaquePixels(frames.at(-1)!)).toBe(0)
  })

  it('compresses the projected vertical span when tilted', () => {
    const flat = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, arcDegrees: 360 })[3]
    const tilted = renderSlashFrames({
      ...DEFAULT_SLASH_PARAMETERS,
      arcDegrees: 360,
      tiltDegrees: 70,
    })[3]

    expect(opaqueBounds(tilted).height).toBeLessThan(opaqueBounds(flat).height)
  })

  it('rotates the rendered pixels without changing the contract', () => {
    const base = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)[2]
    const rotated = renderSlashFrames({
      ...DEFAULT_SLASH_PARAMETERS,
      rotationDegrees: 90,
    })[2]

    expect(Array.from(rotated.pixels)).not.toEqual(Array.from(base.pixels))
    expect(countOpaquePixels(rotated)).toBeGreaterThan(0)
  })
})

describe('packHorizontalSheet', () => {
  it('packs frames from left to right without changing their pixels', () => {
    const frames = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, frameCount: 5 })
    const sheet = packHorizontalSheet(frames)

    expect(sheet.width).toBe(FRAME_SIZE * frames.length)
    expect(sheet.height).toBe(FRAME_SIZE)
    for (let frameIndex = 0; frameIndex < frames.length; frameIndex += 1) {
      expect(extractFrame(sheet, frameIndex)).toEqual(Array.from(frames[frameIndex].pixels))
    }
  })
})

function collectColors(frames: readonly SlashFrame[]): Set<string> {
  const colors = new Set<string>()
  for (const frame of frames) {
    for (let index = 0; index < frame.pixels.length; index += 4) {
      colors.add([
        frame.pixels[index],
        frame.pixels[index + 1],
        frame.pixels[index + 2],
        frame.pixels[index + 3],
      ].join(','))
    }
  }
  return colors
}

function countOpaquePixels(frame: SlashFrame): number {
  let count = 0
  for (let index = 3; index < frame.pixels.length; index += 4) {
    if (frame.pixels[index] !== 0) {
      count += 1
    }
  }
  return count
}

function opaqueBounds(frame: SlashFrame): { width: number; height: number } {
  let minimumX = frame.width
  let maximumX = -1
  let minimumY = frame.height
  let maximumY = -1

  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) {
        continue
      }
      minimumX = Math.min(minimumX, x)
      maximumX = Math.max(maximumX, x)
      minimumY = Math.min(minimumY, y)
      maximumY = Math.max(maximumY, y)
    }
  }

  return {
    width: maximumX - minimumX + 1,
    height: maximumY - minimumY + 1,
  }
}

function extractFrame(sheet: SlashFrame, frameIndex: number): number[] {
  const pixels: number[] = []
  for (let y = 0; y < sheet.height; y += 1) {
    const start = (y * sheet.width + frameIndex * FRAME_SIZE) * 4
    pixels.push(...sheet.pixels.subarray(start, start + FRAME_SIZE * 4))
  }
  return pixels
}
