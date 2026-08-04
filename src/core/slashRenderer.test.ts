import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLASH_PARAMETERS,
  FRAME_SIZE,
  bayerThreshold,
  createXorshift32,
  generateFragments,
  insertPaletteColor,
  packHorizontalSheet,
  removePaletteColor,
  renderSlashFrames,
  type SlashFrame,
  type SlashParameters,
} from './slashRenderer'

describe('renderSlashFrames', () => {
  it('renders deterministic frames with fixed dimensions', () => {
    const first = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)
    const second = renderSlashFrames(DEFAULT_SLASH_PARAMETERS)

    expect(first).toHaveLength(DEFAULT_SLASH_PARAMETERS.frameCount)
    expect(first[0].width).toBe(FRAME_SIZE)
    expect(first[0].height).toBe(FRAME_SIZE)
    expect(frameBytes(first)).toEqual(frameBytes(second))
  })

  it('supports two through six palette colors without introducing other RGBA values', () => {
    for (let colorCount = 2; colorCount <= 6; colorCount += 1) {
      const palette = Array.from({ length: colorCount }, (_, index) => ({
        r: 20 + index * 10,
        g: 40 + index * 10,
        b: 60 + index * 10,
      }))
      const frames = renderSlashFrames({ ...quietParameters(), palette })
      const allowed = new Set(['0,0,0,0', ...palette.map((color) => `${color.r},${color.g},${color.b},255`)])
      expect(collectColors(frames)).toEqual(allowed)
    }
  })

  it('travels from the same start angle in opposite directions', () => {
    const geometry = { ...quietParameters(), startAngleDegrees: 0, sweepDegrees: 90 }
    const clockwise = renderSlashFrames({ ...geometry, direction: 'clockwise' })[2]
    const counterClockwise = renderSlashFrames({ ...geometry, direction: 'counterClockwise' })[2]

    for (let y = 0; y < FRAME_SIZE; y += 1) {
      for (let x = 0; x < FRAME_SIZE; x += 1) {
        expect(pixelAt(clockwise, x, y)).toEqual(pixelAt(counterClockwise, x, FRAME_SIZE - 1 - y))
      }
    }
  })

  it('rotates the complete local sweep without changing its shape', () => {
    const geometry = { ...quietParameters(), startAngleDegrees: 0, sweepDegrees: 90 }
    const original = renderSlashFrames({ ...geometry, rotationDegrees: 0 })[2]
    const rotated = renderSlashFrames({ ...geometry, rotationDegrees: 180 })[2]

    for (let y = 0; y < FRAME_SIZE; y += 1) {
      for (let x = 0; x < FRAME_SIZE; x += 1) {
        expect(pixelAt(original, x, y)).toEqual(pixelAt(rotated, FRAME_SIZE - 1 - x, FRAME_SIZE - 1 - y))
      }
    }
  })

  it('changes breakup and fragments with the seed while preserving exact reproduction', () => {
    const first = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, seed: 100 })
    const repeated = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, seed: 100 })
    const changed = renderSlashFrames({ ...DEFAULT_SLASH_PARAMETERS, seed: 101 })

    expect(frameBytes(first)).toEqual(frameBytes(repeated))
    expect(frameBytes(first)).not.toEqual(frameBytes(changed))
  })

  it('keeps an identifiable inner body at maximum edge breakup', () => {
    const intact = renderSlashFrames({ ...quietParameters(), edgeBreakup: 0 })[3]
    const broken = renderSlashFrames({ ...quietParameters(), edgeBreakup: 1, edgeDepth: 0.5 })[3]

    expect(countOpaquePixels(broken)).toBeGreaterThan(0)
    expect(countOpaquePixels(broken)).toBeLessThan(countOpaquePixels(intact))
  })

  it('uses only binary alpha during ordered dissolve', () => {
    const frames = renderSlashFrames({ ...quietParameters(), dissolveLength: 1 })
    const alphaValues = new Set<number>()
    for (const frame of frames) {
      for (let index = 3; index < frame.pixels.length; index += 4) {
        alphaValues.add(frame.pixels[index])
      }
    }
    expect(alphaValues).toEqual(new Set([0, 255]))
  })

  it('handles extreme geometry and clears the final frame', () => {
    const frames = renderSlashFrames({
      ...DEFAULT_SLASH_PARAMETERS,
      radius: 63,
      thickness: 63,
      sweepDegrees: 360,
      tiltDegrees: 75,
      frameCount: 24,
      edgeBreakup: 1,
      fragmentAmount: 1,
    })

    expect(frames).toHaveLength(24)
    expect(countOpaquePixels(frames[10])).toBeGreaterThan(0)
    expect(countOpaquePixels(frames.at(-1)!)).toBe(0)
  })
})

describe('portable helpers', () => {
  it('produces a stable non-zero xorshift32 sequence even for seed zero', () => {
    const first = createXorshift32(0)
    const second = createXorshift32(0)
    const firstValues = [first(), first(), first(), first()]
    expect(firstValues).toEqual([second(), second(), second(), second()])
    expect(firstValues.every((value) => Number.isInteger(value) && value >= 0)).toBe(true)
    expect(new Set(firstValues).size).toBeGreaterThan(1)
  })

  it('exposes all sixteen Bayer thresholds exactly once', () => {
    const thresholds = Array.from({ length: 16 }, (_, index) => bayerThreshold(index % 4, Math.floor(index / 4)))
    expect(new Set(thresholds).size).toBe(16)
    expect(Math.min(...thresholds)).toBeGreaterThan(0)
    expect(Math.max(...thresholds)).toBeLessThan(1)
  })

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

  it('generates bounded fragments with continuous lifetime descriptors', () => {
    const parameters: SlashParameters = {
      ...DEFAULT_SLASH_PARAMETERS,
      fragmentAmount: 1,
      fragmentSize: 3,
    }
    const fragments = generateFragments(parameters)

    expect(fragments).toHaveLength(24)
    expect(fragments.every((fragment) => fragment.spawnTime >= 0 && fragment.spawnTime <= 0.9)).toBe(true)
    expect(fragments.every((fragment) => fragment.lifetime > 0 && fragment.size >= 1 && fragment.size <= 3)).toBe(true)
    expect(generateFragments(parameters)).toEqual(fragments)
    expect(generateFragments({ ...parameters, seed: parameters.seed + 1 })).not.toEqual(fragments)
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

function quietParameters(): SlashParameters {
  return {
    ...DEFAULT_SLASH_PARAMETERS,
    dissolveLength: 0,
    edgeBreakup: 0,
    fragmentAmount: 0,
  }
}

function frameBytes(frames: readonly SlashFrame[]): number[][] {
  return frames.map((frame) => Array.from(frame.pixels))
}

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

function pixelAt(frame: SlashFrame, x: number, y: number): number[] {
  const index = (y * frame.width + x) * 4
  return Array.from(frame.pixels.subarray(index, index + 4))
}

function extractFrame(sheet: SlashFrame, frameIndex: number): number[] {
  const pixels: number[] = []
  for (let y = 0; y < sheet.height; y += 1) {
    const start = (y * sheet.width + frameIndex * FRAME_SIZE) * 4
    pixels.push(...sheet.pixels.subarray(start, start + FRAME_SIZE * 4))
  }
  return pixels
}
