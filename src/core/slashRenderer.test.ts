import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLASH_PARAMETERS,
  FRAME_SIZE,
  bayerThreshold,
  createXorshift32,
  generateFragments,
  integerLinePoints,
  insertPaletteColor,
  jaggedContourInset,
  packHorizontalSheet,
  removePaletteColor,
  renderSlashFrames,
  slashCutDepth,
  visibleDirectedProgress,
  type DissolveMode,
  type EdgeBreakupMode,
  type FragmentMode,
  type SlashFrame,
  type SlashParameters,
} from './slashRenderer'

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
})

describe('composable breakup modes', () => {
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

  it('keeps modern edge modes within the configured edge depth', () => {
    for (const seed of [1, 1337, 999_999, 0xffffffff]) {
      for (let sample = 0; sample < 2000; sample += 1) {
        const arcDistancePixels = sample / 2
        expect(slashCutDepth(seed, arcDistancePixels, 1, 0.5)).toBeLessThanOrEqual(0.5)
        expect(slashCutDepth(seed, arcDistancePixels, 0.5, 0.3)).toBeLessThanOrEqual(0.3)
        expect(jaggedContourInset(seed, arcDistancePixels, 1, 0.5)).toBeLessThanOrEqual(0.5)
        expect(jaggedContourInset(seed, arcDistancePixels, 0.5, 0.3)).toBeLessThanOrEqual(0.3)
      }
    }
  })

  it('distributes modern edge variation across 180, 360, and 720 degree arcs', () => {
    for (const sweepDegrees of [180, 360, 720]) {
      const arcLength = sweepDegrees * Math.PI / 180 * DEFAULT_SLASH_PARAMETERS.radius
      const cutCells = new Set<number>()
      const jaggedValues = new Set<number>()
      for (let arcDistance = 0; arcDistance <= arcLength; arcDistance += 0.5) {
        if (slashCutDepth(1337, arcDistance, 1, 0.5) > 0) {
          cutCells.add(Math.floor(arcDistance / 8))
        }
        jaggedValues.add(Math.round(jaggedContourInset(1337, arcDistance, 1, 0.5) * 1000))
      }
      expect(cutCells.size).toBeGreaterThan(1)
      expect(jaggedValues.size).toBeGreaterThan(4)
    }
  })

  it('keeps shard and spark motion continuous with bounded spawn and lifetime descriptors', () => {
    const parameters: SlashParameters = {
      ...DEFAULT_SLASH_PARAMETERS,
      fragmentAmount: 1,
      fragmentSize: 3,
    }
    for (const fragmentMode of ['directionalShards', 'energySparks'] as const) {
      const fragments = generateFragments({ ...parameters, fragmentMode })
      expect(fragments).toHaveLength(24)
      expect(fragments.every((fragment) => fragment.spawnTime >= 0 && fragment.spawnTime <= 0.9)).toBe(true)
      expect(fragments.every((fragment) => fragment.lifetime > 0 && fragment.size >= 1 && fragment.size <= 3)).toBe(true)
      expect(generateFragments({ ...parameters, fragmentMode })).toEqual(fragments)
      expect(generateFragments({ ...parameters, fragmentMode, seed: parameters.seed + 1 })).not.toEqual(fragments)
    }
  })

  it('keeps modern fragment sizes within the configured inclusive maximum', () => {
    for (const fragmentMode of ['directionalShards', 'energySparks'] as const) {
      for (const fragmentSize of [1, 2, 3]) {
        const fragments = generateFragments({
          ...DEFAULT_SLASH_PARAMETERS,
          fragmentMode,
          fragmentAmount: 1,
          fragmentSize,
        })
        expect(fragments.every((fragment) => fragment.size >= 1 && fragment.size <= fragmentSize)).toBe(true)
        expect(Math.max(...fragments.map((fragment) => fragment.size))).toBe(fragmentSize)
      }
    }
  })
})

describe('portable helpers', () => {
  it('rasterizes one-to-three-pixel shard lines with integer coordinates', () => {
    expect(integerLinePoints(10, 10, 10, 10)).toEqual([{ x: 10, y: 10 }])
    expect(integerLinePoints(10, 10, 11, 10)).toEqual([{ x: 10, y: 10 }, { x: 11, y: 10 }])
    expect(integerLinePoints(10, 10, 12, 11)).toEqual([
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 11 },
    ])
  })

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

  it('resolves repeated spatial angles on later sweep revolutions', () => {
    const fullCircle = Math.PI * 2
    expect(visibleDirectedProgress(0.25, fullCircle, fullCircle + 1, fullCircle * 2)).toBeCloseTo(fullCircle + 0.25)
    expect(visibleDirectedProgress(2, fullCircle, fullCircle + 1, fullCircle * 2)).toBeUndefined()
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

function framesSignature(frames: readonly SlashFrame[]): string {
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

function hasOnlyBinaryAlpha(frames: readonly SlashFrame[]): boolean {
  for (const frame of frames) {
    for (let index = 3; index < frame.pixels.length; index += 4) {
      if (frame.pixels[index] !== 0 && frame.pixels[index] !== 255) {
        return false
      }
    }
  }
  return true
}

function hasOnlyPaletteAndTransparent(frames: readonly SlashFrame[], palette: readonly { r: number; g: number; b: number }[]): boolean {
  const allowed = new Set<string>(['0,0,0,0'])
  for (const color of palette) {
    allowed.add(`${color.r},${color.g},${color.b},255`)
  }
  return collectColors(frames).size === allowed.size
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
