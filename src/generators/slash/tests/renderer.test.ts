import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import {
  DEFAULT_SLASH_PARAMETERS,
  FRAME_SIZE,
  type DissolveMode,
  type EdgeBreakupMode,
  type FragmentMode,
  type SlashParameters,
} from '../model'
import { renderSlashFrames, visibleDirectedProgress } from '../renderer'

const DISSOLVE_MODES: readonly DissolveMode[] = ['ordered', 'clusteredNoise', 'directionalStreaks']
const EDGE_MODES: readonly EdgeBreakupMode[] = ['blockChips', 'jaggedContour', 'slashCuts']
const FRAGMENT_MODES: readonly FragmentMode[] = ['pixelChunks', 'directionalShards', 'energySparks']

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
      sweepDegrees: 720,
      tiltDegrees: 90,
      frameCount: 24,
      edgeBreakup: 1,
      fragmentAmount: 1,
    })

    expect(frames).toHaveLength(24)
    expect(countOpaquePixels(frames[10])).toBeGreaterThan(0)
    expect(countOpaquePixels(frames.at(-1)!)).toBe(0)
  })

  it('keeps the main arc visible at a 90 degree perspective tilt', () => {
    const frames = renderSlashFrames({ ...quietParameters(), sweepDegrees: 720, tiltDegrees: 90 })

    expect(countOpaquePixels(frames[3])).toBeGreaterThan(0)
  })

  it('keeps the explicit legacy combination pixel-compatible with the previous renderer', () => {
    const frames = renderSlashFrames({
      ...DEFAULT_SLASH_PARAMETERS,
      dissolveMode: 'ordered',
      edgeBreakupMode: 'blockChips',
      fragmentMode: 'pixelChunks',
    })
    const hashes = frames.map((frame) => legacyHash(frame.pixels))
    const golden = [
      'a17860032952b3ad',
      '64a93799cc00df27',
      '15819b8b43b81505',
      '8e20cef5e0386acb',
      'fe1aac531c15884d',
      'ce34ffa350378c35',
      'bc29c6e56b4f86cb',
      '5e509dc5602c0193',
    ]
    expect(hashes).toEqual(golden)
  })

  it('keeps the modern default output pixel-identical across the refactor', () => {
    const hashes = renderSlashFrames(DEFAULT_SLASH_PARAMETERS).map((frame) => legacyHash(frame.pixels))
    const golden = [
      '430b12b70d366d79',
      '61e83e45b16976e3',
      '6dc7109351d02005',
      'c09118affb204fd9',
      '169d60a7cb7de0d9',
      'c12bdaefe2a10d99',
      '288a561b50d209dd',
      '5e509dc5602c0193',
    ]
    expect(hashes).toEqual(golden)
  })

  it('renders every mode combination at minimum and maximum parameter values', () => {
    for (const dissolveMode of DISSOLVE_MODES) {
      for (const edgeBreakupMode of EDGE_MODES) {
        for (const fragmentMode of FRAGMENT_MODES) {
          const minimum = renderSlashFrames({
            ...quietParameters(),
            dissolveMode,
            edgeBreakupMode,
            fragmentMode,
            dissolveLength: 0,
            edgeBreakup: 0,
            edgeDepth: 0.05,
            fragmentAmount: 0,
            fragmentSize: 1,
          })
          const maximum = renderSlashFrames({
            ...DEFAULT_SLASH_PARAMETERS,
            dissolveMode,
            edgeBreakupMode,
            fragmentMode,
            dissolveLength: 1,
            edgeBreakup: 1,
            edgeDepth: 0.5,
            fragmentAmount: 1,
            fragmentSize: 3,
            sweepDegrees: 720,
            tiltDegrees: 90,
            frameCount: 24,
          })

          expect(hasOnlyPaletteAndTransparent(maximum, DEFAULT_SLASH_PARAMETERS.palette)).toBe(true)
          expect(countOpaquePixels(maximum[10])).toBeGreaterThan(0)
          expect(countOpaquePixels(maximum.at(-1)!)).toBe(0)
          expect(hasOnlyBinaryAlpha(minimum)).toBe(true)
          expect(hasOnlyBinaryAlpha(maximum)).toBe(true)
        }
      }
    }
  })

  it('reproduces the same seed exactly and changes each procedural subsystem', () => {
    const scenarios: SlashParameters[] = [
      ...(['clusteredNoise', 'directionalStreaks'] as const).map((dissolveMode) => ({
        ...quietParameters(), dissolveMode, dissolveLength: 0.8,
      })),
      ...EDGE_MODES.map((edgeBreakupMode) => ({
        ...quietParameters(), edgeBreakupMode, edgeBreakup: 0.9, edgeDepth: 0.5,
      })),
      ...FRAGMENT_MODES.map((fragmentMode) => ({
        ...quietParameters(), fragmentMode, fragmentAmount: 1,
      })),
    ].map((parameters) => ({ ...parameters, frameCount: 5, seed: 4242 }))

    for (const parameters of scenarios) {
      const first = framesSignature(renderSlashFrames(parameters))
      expect(framesSignature(renderSlashFrames(parameters))).toBe(first)
      expect(framesSignature(renderSlashFrames({ ...parameters, seed: 4243 }))).not.toBe(first)
    }
  })

  it('produces distinguishable output for all nine mode combinations', () => {
    const combinations = DISSOLVE_MODES.flatMap((dissolveMode) =>
      EDGE_MODES.flatMap((edgeBreakupMode) =>
        FRAGMENT_MODES.map((fragmentMode) => ({ dissolveMode, edgeBreakupMode, fragmentMode })),
      ),
    )
    const signatures = combinations.map((combination) => {
      const frames = renderSlashFrames({
        ...DEFAULT_SLASH_PARAMETERS,
        ...combination,
        dissolveLength: 0.6,
        edgeBreakup: 0.45,
        edgeDepth: 0.3,
        fragmentAmount: 0.8,
        fragmentSize: 3,
        frameCount: 5,
      })
      return frames.map((frame) => legacyHash(frame.pixels)).join('/')
    })
    expect(new Set(signatures).size).toBe(combinations.length)
  })

  it('keeps a recognizable body at maximum edge intensity and clears the final frame', () => {
    for (const edgeBreakupMode of EDGE_MODES) {
      const frames = renderSlashFrames({
        ...quietParameters(),
        edgeBreakupMode,
        edgeBreakup: 1,
        edgeDepth: 0.5,
      })
      const intact = renderSlashFrames({
        ...quietParameters(),
        edgeBreakupMode,
        edgeBreakup: 0,
      })
      expect(countOpaquePixels(frames[3])).toBeGreaterThan(0)
      expect(countOpaquePixels(frames[3])).toBeLessThan(countOpaquePixels(intact[3]))
      expect(countOpaquePixels(frames.at(-1)!)).toBe(0)
    }
  })

  it('forms clustered noise dissolve into irregular blocks rather than a checkerboard', () => {
    const frame = renderSlashFrames({
      ...quietParameters(),
      dissolveMode: 'clusteredNoise',
      dissolveLength: 0.5,
    })[2]
    let rowFlips = 0
    let columnFlips = 0
    for (let y = 0; y < FRAME_SIZE; y += 1) {
      for (let x = 0; x < FRAME_SIZE; x += 1) {
        const current = frame.pixels[(y * FRAME_SIZE + x) * 4 + 3]
        if (x > 0 && current !== frame.pixels[(y * FRAME_SIZE + x - 1) * 4 + 3]) {
          rowFlips += 1
        }
        if (y > 0 && current !== frame.pixels[((y - 1) * FRAME_SIZE + x) * 4 + 3]) {
          columnFlips += 1
        }
      }
    }
    expect(rowFlips).toBeGreaterThan(0)
    expect(columnFlips).toBeGreaterThan(0)
    expect(Math.min(rowFlips, columnFlips) / Math.max(rowFlips, columnFlips)).toBeLessThan(0.85)
  })

  it('aligns directional streak bands with the local sweep direction', () => {
    const frame = renderSlashFrames({
      ...quietParameters(),
      dissolveMode: 'directionalStreaks',
      dissolveLength: 0.5,
    })[2]
    const band = new Set<number>()
    for (let x = 40; x < 88; x += 1) {
      for (let y = 30; y < 98; y += 1) {
        band.add(frame.pixels[(y * FRAME_SIZE + x) * 4 + 3])
      }
    }
    expect(band.size).toBe(2)
  })

  it('resolves repeated spatial angles on later sweep revolutions', () => {
    const fullCircle = Math.PI * 2
    expect(visibleDirectedProgress(0.25, fullCircle, fullCircle + 1, fullCircle * 2)).toBeCloseTo(fullCircle + 0.25)
    expect(visibleDirectedProgress(2, fullCircle, fullCircle + 1, fullCircle * 2)).toBeUndefined()
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

function frameBytes(frames: readonly PixelFrame[]): number[][] {
  return frames.map((frame) => Array.from(frame.pixels))
}

function framesSignature(frames: readonly PixelFrame[]): string {
  return frames.map((frame) => legacyHash(frame.pixels)).join('/')
}

/** Stable FNV-1a digest used as the legacy pixel-compatibility golden. */
function legacyHash(bytes: Uint8ClampedArray): string {
  let h1 = 0x811c9dc5
  let h2 = 0x01000193
  for (let index = 0; index < bytes.length; index += 1) {
    const value = bytes[index]
    h1 ^= value
    h1 = Math.imul(h1, 0x01000193) >>> 0
    h2 = (Math.imul(h2, 0x01000193) ^ value) >>> 0
  }
  return `${h1.toString(16).padStart(8, '0')}${h2.toString(16).padStart(8, '0')}`
}

function hasOnlyBinaryAlpha(frames: readonly PixelFrame[]): boolean {
  for (const frame of frames) {
    for (let index = 3; index < frame.pixels.length; index += 4) {
      if (frame.pixels[index] !== 0 && frame.pixels[index] !== 255) {
        return false
      }
    }
  }
  return true
}

function hasOnlyPaletteAndTransparent(frames: readonly PixelFrame[], palette: readonly { r: number; g: number; b: number }[]): boolean {
  const allowed = new Set<string>(['0,0,0,0'])
  for (const color of palette) {
    allowed.add(`${color.r},${color.g},${color.b},255`)
  }
  return collectColors(frames).size === allowed.size
}

function collectColors(frames: readonly PixelFrame[]): Set<string> {
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

function countOpaquePixels(frame: PixelFrame): number {
  let count = 0
  for (let index = 3; index < frame.pixels.length; index += 4) {
    if (frame.pixels[index] !== 0) {
      count += 1
    }
  }
  return count
}

function pixelAt(frame: PixelFrame, x: number, y: number): number[] {
  const index = (y * frame.width + x) * 4
  return Array.from(frame.pixels.subarray(index, index + 4))
}
