import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import {
  createBloomSurface,
  DEFAULT_BLOOM_PARAMETERS,
  resizeBloomCanvas,
  type BloomParameters,
  type BloomSurfaceStyle,
} from '../model'
import { BLOOM_BUILTIN_PRESETS, applyBloomPreset } from '../presets'
import { renderBloomFrames } from '../renderer'

const SURFACES: readonly BloomSurfaceStyle[] = ['celBands', 'moltenCavities', 'crystalShards', 'gridNoise', 'pixelNoise']

describe('renderBloomFrames', () => {
  it('renders deterministic binary-alpha frames with transparent endpoints', () => {
    const first = renderBloomFrames(DEFAULT_BLOOM_PARAMETERS)
    const repeated = renderBloomFrames(DEFAULT_BLOOM_PARAMETERS)
    const changed = renderBloomFrames({ ...DEFAULT_BLOOM_PARAMETERS, seed: DEFAULT_BLOOM_PARAMETERS.seed + 1 })
    expect(frameBytes(first)).toEqual(frameBytes(repeated))
    expect(frameBytes(first)).not.toEqual(frameBytes(changed))
    expect(countOpaque(first[0])).toBe(0)
    expect(countOpaque(first.at(-1)!)).toBe(0)
    expect(new Set(first.flatMap(alphaValues))).toEqual(new Set([0, 255]))
  })

  it('supports resized rectangular canvases', () => {
    const resized = resizeBloomCanvas(DEFAULT_BLOOM_PARAMETERS, { width: 64, height: 32 }, true)
    const frames = renderBloomFrames({ ...resized, frameCount: 6 })
    expect(frames.every((frame) => frame.width === 64 && frame.height === 32)).toBe(true)
  })

  it('uses only transparent pixels and exact palette colors for every surface', () => {
    for (const style of SURFACES) {
      const parameters = { ...DEFAULT_BLOOM_PARAMETERS, surface: createBloomSurface(style) }
      const allowed = new Set(['0,0,0,0', ...parameters.palette.map(({ r, g, b }) => `${r},${g},${b},255`)])
      expect([...new Set(renderBloomFrames(parameters).flatMap(colors))].every((color) => allowed.has(color)), style).toBe(true)
    }
  })

  it('produces three structurally distinct deterministic shapes', () => {
    const signatures = (['softPetals', 'sharpStarburst', 'layeredCorolla'] as const).map((shape) => {
      const parameters = quietParameters({ body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape } })
      const frames = renderBloomFrames(parameters)
      expect(frameBytes(frames)).toEqual(frameBytes(renderBloomFrames(parameters)))
      return fullFrameHash(frames)
    })
    expect(new Set(signatures).size).toBe(3)
  })

  it('keeps soft-petal tongues off by default and renders nothing else without layers', () => {
    const parameters = quietParameters({ surface: { style: 'celBands', coverage: 0, bandWarp: 0, edgeBreakup: 0 } })
    expect(parameters.tongues.enabled).toBe(false)
    expect(renderBloomFrames(parameters).every((frame) => countOpaque(frame) === 0)).toBe(true)
  })

  it('enables balanced soft-petal tongues that start at the body tip and never cross the center', () => {
    const parameters = quietParameters({
      surface: { style: 'celBands', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      tongues: { enabled: true, count: 3, length: 40, width: 4, curvature: 0.4, variation: 0.3 },
    })
    const frame = renderBloomFrames(parameters)[4]
    expect(countOpaque(frame)).toBeGreaterThan(0)
    expect(occupiedAngleRuns(frame, 72)).toBe(3)
    expect(countOpaqueInside(frame, parameters.body.radius * 0.3)).toBe(0)
    expect(maximumRadius(frame)).toBeLessThan(parameters.body.radius * 0.9 + parameters.tongues.length * 1.3)
  })

  it('renders a sharp starburst with narrow spiky rays', () => {
    const parameters = quietParameters({
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'sharpStarburst', rayCount: 12, rayTaper: 0.8 },
      surface: { style: 'celBands', coverage: 1, bandWarp: 0, edgeBreakup: 0 },
    })
    const frame = renderBloomFrames(parameters)[4]
    expect(occupiedAngleRunsOutside(frame, 72, parameters.body.radius * 0.25)).toBe(12)
    expect(angularRadiusRatio(frame, 36)).toBeGreaterThan(2)
  })

  it('keeps cel shading connected and free of enclosed transparent holes', () => {
    const parameters = quietParameters({
      surface: { style: 'celBands', coverage: 1, bandWarp: 0.35, edgeBreakup: 0.8 },
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, dissolveStart: 0.55 },
    })
    const frames = renderBloomFrames(parameters)
    expect(opaqueComponents(frames[4])).toBe(1)
    expect(enclosedTransparentPixels(frames[4])).toBe(0)
    expect(enclosedTransparentPixels(frames[7])).toBe(0)
  })

  it('opens layered corolla petals in sequence with a delayed outer layer', () => {
    const parameters = quietParameters({
      body: {
        ...DEFAULT_BLOOM_PARAMETERS.body,
        shape: 'layeredCorolla',
        corollaLayers: 2,
        layerDelay: 0.35,
      },
      surface: { style: 'celBands', coverage: 1, bandWarp: 0, edgeBreakup: 0 },
    })
    const frames = renderBloomFrames(parameters)
    expect(maximumRadius(frames[3])).toBeGreaterThan(0)
    expect(maximumRadius(frames[7])).toBeGreaterThan(maximumRadius(frames[3]))
  })

  it('expands the body outward and contracts the same skeleton inward', () => {
    const quiet = quietParameters()
    const explosion = renderBloomFrames({ ...quiet, motion: { ...quiet.motion, mode: 'explosion' } })
    const implosion = renderBloomFrames({ ...quiet, motion: { ...quiet.motion, mode: 'implosion' } })
    expect(maximumRadius(explosion[1])).toBeLessThan(maximumRadius(explosion[4]))
    expect(maximumRadius(implosion[4])).toBeGreaterThan(maximumRadius(implosion[8]))
  })

  it('draws energy shards as diamonds instead of squares', () => {
    const parameters = quietParameters({
      surface: { style: 'celBands', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      fragments: { enabled: true, count: 1, minSize: 3, maxSize: 3, travelDistance: 0, tangentialDrift: 0, lifetime: 1 },
    })
    const counts = renderBloomFrames(parameters).slice(1, -1).map(countOpaque)
    expect(Math.max(...counts)).toBe(5)
  })

  it('renders every built-in bloom preset without throwing', () => {
    for (const preset of BLOOM_BUILTIN_PRESETS) {
      expect(() => renderBloomFrames(applyBloomPreset(DEFAULT_BLOOM_PARAMETERS, preset.payload))).not.toThrow()
    }
  })

  it('sweeps pixel-noise dissolve from the top-left corner', () => {
    const parameters = quietParameters({
      surface: { style: 'pixelNoise', coverage: 0.95, dissolveStyle: 'scanSweep', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, dissolveStart: 0.55 },
    })
    const frame = renderBloomFrames(parameters)[7]
    const diagonal = frame.width + frame.height
    expect(countOpaqueRegion(frame, (x, y) => x + y <= diagonal / 2))
      .toBeLessThan(countOpaqueRegion(frame, (x, y) => x + y > diagonal / 2))
  })
})

/** Disables all optional layers unless a test explicitly overrides one. */
function quietParameters(overrides: Partial<BloomParameters> = {}): BloomParameters {
  return {
    ...DEFAULT_BLOOM_PARAMETERS,
    core: { ...DEFAULT_BLOOM_PARAMETERS.core, enabled: false },
    shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, mode: 'none' as const },
    tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: false },
    fragments: { ...DEFAULT_BLOOM_PARAMETERS.fragments, enabled: false },
    ...overrides,
  }
}

/** Copies every frame byte for exact deterministic comparisons. */
function frameBytes(frames: readonly PixelFrame[]): number[][] { return frames.map((frame) => Array.from(frame.pixels)) }

/** Collects every alpha sample from one frame. */
function alphaValues(frame: PixelFrame): number[] {
  const result: number[] = []
  for (let index = 3; index < frame.pixels.length; index += 4) result.push(frame.pixels[index])
  return result
}

/** Serializes every RGBA sample for palette membership checks. */
function colors(frame: PixelFrame): string[] {
  const result: string[] = []
  for (let index = 0; index < frame.pixels.length; index += 4) result.push(Array.from(frame.pixels.subarray(index, index + 4)).join(','))
  return result
}

/** Counts all opaque pixels in one frame. */
function countOpaque(frame: PixelFrame): number { return alphaValues(frame).filter((alpha) => alpha === 255).length }

/** Counts opaque samples inside a centered radius. */
function countOpaqueInside(frame: PixelFrame, radius: number): number {
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2) <= radius && frame.pixels[(y * frame.width + x) * 4 + 3] === 255) count += 1
  }
  return count
}

/** Counts opaque samples satisfying a pixel predicate. */
function countOpaqueRegion(frame: PixelFrame, predicate: (x: number, y: number) => boolean): number {
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (predicate(x, y) && frame.pixels[(y * frame.width + x) * 4 + 3] === 255) count += 1
  }
  return count
}

/** Counts four-neighbor opaque components. */
function opaqueComponents(frame: PixelFrame): number {
  const seen = new Uint8Array(frame.width * frame.height)
  let components = 0
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || frame.pixels[start * 4 + 3] !== 255) continue
    components += 1
    seen[start] = 1
    flood(frame, [start], seen)
  }
  return components
}

/** Flood-fills opaque pixels. */
function flood(frame: PixelFrame, queue: number[], seen: Uint8Array): void {
  while (queue.length > 0) {
    const current = queue.pop()!
    const x = current % frame.width
    const y = Math.floor(current / frame.width)
    for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nextX < 0 || nextY < 0 || nextX >= frame.width || nextY >= frame.height) continue
      const next = nextY * frame.width + nextX
      if (seen[next] || frame.pixels[next * 4 + 3] !== 255) continue
      seen[next] = 1
      queue.push(next)
    }
  }
}

/** Counts transparent pixels unreachable from the canvas border. */
function enclosedTransparentPixels(frame: PixelFrame): number {
  const reachable = new Uint8Array(frame.width * frame.height)
  const queue: number[] = []
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (x !== 0 && y !== 0 && x !== frame.width - 1 && y !== frame.height - 1) continue
    const index = y * frame.width + x
    if (frame.pixels[index * 4 + 3] === 0 && !reachable[index]) {
      reachable[index] = 1
      queue.push(index)
    }
  }
  floodTransparent(frame, queue, reachable)
  let enclosed = 0
  for (let index = 0; index < reachable.length; index += 1) if (frame.pixels[index * 4 + 3] === 0 && !reachable[index]) enclosed += 1
  return enclosed
}

/** Flood-fills transparent pixels from the border. */
function floodTransparent(frame: PixelFrame, queue: number[], seen: Uint8Array): void {
  while (queue.length > 0) {
    const current = queue.pop()!
    const x = current % frame.width
    const y = Math.floor(current / frame.width)
    for (const [nextX, nextY] of [[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]]) {
      if (nextX < 0 || nextY < 0 || nextX >= frame.width || nextY >= frame.height) continue
      const next = nextY * frame.width + nextX
      if (seen[next] || frame.pixels[next * 4 + 3] !== 0) continue
      seen[next] = 1
      queue.push(next)
    }
  }
}

/** Counts contiguous occupied angular sectors on a circular histogram. */
function occupiedAngleRuns(frame: PixelFrame, bins: number): number {
  const occupied = Array.from({ length: bins }, () => false)
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    occupied[Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins))] = true
  }
  let runs = 0
  for (let index = 0; index < bins; index += 1) if (occupied[index] && !occupied[(index - 1 + bins) % bins]) runs += 1
  return runs
}

/** Counts contiguous occupied angular sectors outside a centered radius. */
function occupiedAngleRunsOutside(frame: PixelFrame, bins: number, minimumRadius: number): number {
  const occupied = Array.from({ length: bins }, () => false)
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const radius = Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2)
    if (radius <= minimumRadius || frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    occupied[Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins))] = true
  }
  let runs = 0
  for (let index = 0; index < bins; index += 1) if (occupied[index] && !occupied[(index - 1 + bins) % bins]) runs += 1
  return runs
}

/** Measures the furthest opaque sample from center. */
function maximumRadius(frame: PixelFrame): number {
  let maximum = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) if (frame.pixels[(y * frame.width + x) * 4 + 3] === 255) maximum = Math.max(maximum, Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2))
  return maximum
}

/** Ratio between the largest and smallest occupied angular radius bins. */
function angularRadiusRatio(frame: PixelFrame, bins: number): number {
  const maxima = new Array<number>(bins).fill(0)
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    const bin = Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins))
    maxima[bin] = Math.max(maxima[bin], Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2))
  }
  const occupied = maxima.filter((value) => value > 0)
  return Math.max(...occupied) / Math.max(1, Math.min(...occupied))
}

/** Hashes every byte of every frame with FNV-1a. */
function fullFrameHash(frames: readonly { readonly pixels: Uint8ClampedArray }[]): string {
  let hash = 2166136261
  for (const frame of frames) for (const byte of frame.pixels) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(16)
}
