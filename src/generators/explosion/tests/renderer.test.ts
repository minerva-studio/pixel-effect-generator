import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import {
  createExplosionSurface,
  DEFAULT_EXPLOSION_PARAMETERS,
  MODERN_EXPLOSION_PARAMETERS,
  resizeExplosionCanvas,
  type ExplosionParameters,
  type ExplosionSurfaceStyle,
} from '../model'
import { EXPLOSION_BUILTIN_PRESETS, applyExplosionPreset } from '../presets'
import { renderExplosionFrames } from '../renderer'

const SURFACES: readonly ExplosionSurfaceStyle[] = ['burningLayers', 'rollingSoot', 'retroPixel']
const FULL_RETRO_BASELINE_HASH = 'ad4d95b'

describe('renderExplosionFrames', () => {
  it('renders deterministic binary-alpha frames with transparent endpoints', () => {
    const first = renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS)
    const repeated = renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS)
    const changed = renderExplosionFrames({ ...DEFAULT_EXPLOSION_PARAMETERS, seed: DEFAULT_EXPLOSION_PARAMETERS.seed + 1 })
    expect(frameBytes(first)).toEqual(frameBytes(repeated))
    expect(frameBytes(first)).not.toEqual(frameBytes(changed))
    expect(countOpaque(first[0])).toBe(0)
    expect(countOpaque(first.at(-1)!)).toBe(0)
    expect(new Set(first.flatMap(alphaValues))).toEqual(new Set([0, 255]))
  })

  it('supports resized rectangular canvases', () => {
    const resized = resizeExplosionCanvas(DEFAULT_EXPLOSION_PARAMETERS, { width: 64, height: 32 }, true)
    const frames = renderExplosionFrames({ ...resized, frameCount: 6 })
    expect(frames.every((frame) => frame.width === 64 && frame.height === 32)).toBe(true)
  })

  it('uses only transparent pixels and exact palette colors for every surface', () => {
    for (const style of SURFACES) {
      const parameters = { ...DEFAULT_EXPLOSION_PARAMETERS, surface: createExplosionSurface(style) }
      const allowed = new Set(['0,0,0,0', ...parameters.palette.map(({ r, g, b }) => `${r},${g},${b},255`)])
      expect([...new Set(renderExplosionFrames(parameters).flatMap(colors))].every((color) => allowed.has(color)), style).toBe(true)
    }
  })

  it('produces three structurally distinct deterministic shapes', () => {
    const signatures = (['billowingFireball', 'pressureBurst', 'legacyRadial'] as const).map((shape) => {
      const parameters = quietParameters({ body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape } })
      const frames = renderExplosionFrames(parameters)
      expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(parameters)))
      return fullFrameHash(frames)
    })
    expect(new Set(signatures).size).toBe(3)
  })

  it('reads the default middle frame as a rounded billowing fireball, not a flower or star', () => {
    const frame = renderExplosionFrames(quietParameters({}, MODERN_EXPLOSION_PARAMETERS))[4]
    expect(occupiedAngleBins(frame, 72)).toBeGreaterThanOrEqual(64)
    expect(angularRadiusRatio(frame, 36)).toBeLessThanOrEqual(1.8)
  })

  it('keeps the pressure burst center-connected without petals', () => {
    const parameters = quietParameters({
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape: 'pressureBurst', pressureWidth: 8, pressureSharpness: 0.95 },
      surface: { style: 'burningLayers', coverage: 0.95, bandWarp: 0.1, edgeBreakup: 0.2 },
    })
    const frame = renderExplosionFrames(parameters)[4]
    expect(opaqueComponents(frame)).toBe(1)
    expect(occupiedAngleBins(frame, 72)).toBeGreaterThanOrEqual(64)
    expect(countOpaqueInside(frame, 6)).toBeGreaterThan(0)
  })

  it('keeps Retro Burst byte-identical through a full-byte golden hash', () => {
    const retro = applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, EXPLOSION_BUILTIN_PRESETS[2].payload)
    expect(fullFrameHash(renderExplosionFrames(retro))).toBe(FULL_RETRO_BASELINE_HASH)
    expect(retro.body.shape).toBe('legacyRadial')
    expect(retro.surface.style).toBe('retroPixel')
    expect(retro.shockwave.mode).toBe('ring')
    expect(retro.tongues.enabled).toBe(false)
  })

  it('defaults the explosion family to the classic retro radial parameters', () => {
    expect(DEFAULT_EXPLOSION_PARAMETERS.body.shape).toBe('legacyRadial')
    expect(DEFAULT_EXPLOSION_PARAMETERS.surface.style).toBe('retroPixel')
    expect(DEFAULT_EXPLOSION_PARAMETERS.shockwave.mode).toBe('ring')
    expect(DEFAULT_EXPLOSION_PARAMETERS.tongues.enabled).toBe(false)
    expect(fullFrameHash(renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS))).toBe(FULL_RETRO_BASELINE_HASH)
  })

  it('draws filled fire jets outside the protected center and keeps extreme lengths bounded', () => {
    const parameters = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      tongues: { enabled: true, count: 3, length: 60, width: 5, curvature: 1, variation: 1 },
    })
    const frame = renderExplosionFrames(parameters)[3]
    expect(countOpaque(frame)).toBeGreaterThan(0)
    expect(countOpaqueInside(frame, parameters.body.radius * 0.35)).toBe(0)
    expect(maximumRadius(frame)).toBeLessThan(parameters.body.radius * 0.9 + parameters.tongues.length * 1.3)
  })

  it('renders multiple complete rings chasing along the same radial path', () => {
    const base = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      shockwave: {
        ...DEFAULT_EXPLOSION_PARAMETERS.shockwave,
        mode: 'multiRing',
        colorMode: 'flat',
        thickness: 2,
        ringCount: 3,
        ringSpacing: 0.55,
        squash: 0,
        squashAngle: 0,
      },
    })
    const frame = renderExplosionFrames(base)[4]
    const bands = radialBands(frame)
    expect(bands).toHaveLength(3)
    expect(bands.every((band) => band.angleBins >= 64)).toBe(true)
    expect(occupiedAngleBins(frame, 72)).toBeGreaterThan(64)
  })

  it('maps gradient rings from palette[0] at the outer edge to palette[last] inward', () => {
    const base = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      shockwave: {
        ...DEFAULT_EXPLOSION_PARAMETERS.shockwave,
        mode: 'ring',
        colorMode: 'gradient',
        thickness: 6,
        squash: 0,
        squashAngle: 0,
      },
    })
    const frame = renderExplosionFrames(base)[4]
    const outermost = opaqueSamples(frame).sort((a, b) => b.radius - a.radius)[0]
    const innermost = opaqueSamples(frame).sort((a, b) => a.radius - b.radius)[0]
    expect(outermost.color).toBe(`${base.palette[0].r},${base.palette[0].g},${base.palette[0].b}`)
    expect(innermost.color).toBe(`${base.palette.at(-1)!.r},${base.palette.at(-1)!.g},${base.palette.at(-1)!.b}`)
  })

  it('keeps flat rings in a single palette color', () => {
    const base = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      shockwave: {
        ...DEFAULT_EXPLOSION_PARAMETERS.shockwave,
        mode: 'multiRing',
        colorMode: 'flat',
        ringCount: 3,
        ringSpacing: 0.55,
        squash: 0,
        squashAngle: 0,
      },
    })
    const frame = renderExplosionFrames(base)[4]
    const flatColor = `${base.palette[1].r},${base.palette[1].g},${base.palette[1].b}`
    const opaque = opaqueSamples(frame)
    expect(opaque.length).toBeGreaterThan(0)
    expect([...new Set(opaque.map((sample) => sample.color))]).toEqual([flatColor])
  })

  it('squashes rings elliptically and keeps squash 0 circular', () => {
    const base = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      shockwave: {
        ...DEFAULT_EXPLOSION_PARAMETERS.shockwave,
        mode: 'ring',
        colorMode: 'flat',
        thickness: 2,
        squash: 0.5,
        squashAngle: 0,
      },
    })
    const squashed = renderExplosionFrames(base)[4]
    const round = renderExplosionFrames({ ...base, shockwave: { ...base.shockwave, squash: 0 } })[4]
    const ratio = axisRadiusRatio(squashed, 72)
    expect(ratio).toBeGreaterThan(1.18)
    expect(ratio).toBeLessThan(1.32)
    expect(axisRadiusRatio(round, 72)).toBeLessThan(1.05)
  })

  it('changes shockwave thickness without creating rays or changing angular coverage', () => {
    const base = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, mode: 'ring', colorMode: 'flat', squash: 0, squashAngle: 0 },
    })
    const thin = renderExplosionFrames({ ...base, shockwave: { ...base.shockwave, thickness: 1 } })[3]
    const thick = renderExplosionFrames({ ...base, shockwave: { ...base.shockwave, thickness: 6 } })[3]
    expect(occupiedAngleBins(thin, 72)).toBeGreaterThanOrEqual(64)
    expect(occupiedAngleBins(thick, 72)).toBeGreaterThanOrEqual(64)
    expect(Math.abs(meanOpaqueRadius(thin) - meanOpaqueRadius(thick))).toBeLessThan(1)
    expect(maximumRadius(thick)).toBeLessThanOrEqual(DEFAULT_EXPLOSION_PARAMETERS.body.radius * base.shockwave.endRadiusScale + 4)
  })

  it('sweeps retro-pixel dissolve from the top-left corner on the legacy path', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'scanSweep', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[6]
    const diagonal = frame.width + frame.height
    expect(countOpaqueRegion(frame, (x, y) => x + y <= diagonal / 2))
      .toBeLessThan(countOpaqueRegion(frame, (x, y) => x + y > diagonal / 2))
  })

  it('applies scan-sweep dissolve to the modern retro-pixel path', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.95, dissolveStyle: 'scanSweep', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...MODERN_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    }, MODERN_EXPLOSION_PARAMETERS)
    const frame = renderExplosionFrames(parameters)[6]
    const diagonal = frame.width + frame.height
    expect(countOpaqueRegion(frame, (x, y) => x + y <= diagonal / 2))
      .toBeLessThan(countOpaqueRegion(frame, (x, y) => x + y > diagonal / 2))
  })

  it('fades retro-pixel bodies in whole 2x2 blocks', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'blockFade', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[7]
    const innerRadius = DEFAULT_EXPLOSION_PARAMETERS.body.radius * 0.7
    for (let by = 0; by < frame.height; by += 2) {
      for (let bx = 0; bx < frame.width; bx += 2) {
        if (Math.hypot(bx + 1.5 - frame.width / 2, by + 1.5 - frame.height / 2) > innerRadius) continue
        const alphas = new Set<number>()
        for (let oy = 0; oy < 2; oy += 1) for (let ox = 0; ox < 2; ox += 1) {
          alphas.add(frame.pixels[((by + oy) * frame.width + bx + ox) * 4 + 3])
        }
        expect(alphas.size).toBeLessThanOrEqual(1)
      }
    }
  })

  it('keeps circle-fade surfaces seamless without fixed grid gaps', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.95, dissolveStyle: 'circleFade', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[4]
    const innerRadius = DEFAULT_EXPLOSION_PARAMETERS.body.radius * 0.8
    let corner = 0
    let cornerOpaque = 0
    for (let y = 0; y < frame.height; y += 1) {
      for (let x = 0; x < frame.width; x += 1) {
        if (Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2) > innerRadius) continue
        if (x % 8 === 0 && y % 8 === 0) {
          corner += 1
          if (frame.pixels[(y * frame.width + x) * 4 + 3] === 255) cornerOpaque += 1
        }
      }
    }
    expect(corner).toBeGreaterThan(0)
    expect(cornerOpaque / corner).toBeGreaterThan(0.9)
  })

  it('tunes circle-fade size, density, and speed deterministically', () => {
    const surfaceFor = (overrides: {
      readonly dissolveSize?: number
      readonly dissolveDensity?: number
      readonly dissolveSpeed?: number
    } = {}) => ({
      style: 'retroPixel' as const,
      coverage: 0.95,
      dissolveStyle: 'circleFade' as const,
      dissolveSize: 6,
      dissolveJitter: 0.5,
      dissolveDensity: 0,
      dissolveSpeed: 1,
      ...overrides,
    })
    const base = quietParameters({
      surface: surfaceFor(),
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frames = renderExplosionFrames(base)
    expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(base)))
    const larger = renderExplosionFrames({ ...base, surface: surfaceFor({ dissolveSize: 8 }) })
    const sparse = renderExplosionFrames({ ...base, surface: surfaceFor({ dissolveDensity: 1 }) })
    const faster = renderExplosionFrames({ ...base, surface: surfaceFor({ dissolveSpeed: 1.5 }) })
    expect(frameBytes(larger)).not.toEqual(frameBytes(frames))
    expect(frameBytes(sparse)).not.toEqual(frameBytes(frames))
    expect(countOpaque(faster[7])).toBeLessThan(countOpaque(frames[7]))
  })

  it('rolls retro-pixel dissolve inward from the edge', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'edgeRoll', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[7]
    const center = countOpaqueInside(frame, DEFAULT_EXPLOSION_PARAMETERS.body.radius * 0.4)
    const edge = countOpaqueRegion(frame, (x, y) =>
      Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2) > DEFAULT_EXPLOSION_PARAMETERS.body.radius * 0.75)
    expect(center).toBeGreaterThan(edge)
  })

  it('expands the body outward and contracts the same skeleton inward', () => {
    const quiet = quietParameters()
    const explosion = renderExplosionFrames({ ...quiet, motion: { ...quiet.motion, mode: 'explosion' } })
    const implosion = renderExplosionFrames({ ...quiet, motion: { ...quiet.motion, mode: 'implosion' } })
    expect(maximumRadius(explosion[1])).toBeLessThan(maximumRadius(explosion[4]))
    expect(maximumRadius(implosion[4])).toBeGreaterThan(maximumRadius(implosion[8]))
  })

  it('draws char fragments as filled squares', () => {
    const parameters = quietParameters({
      surface: { style: 'burningLayers', coverage: 0, bandWarp: 0, edgeBreakup: 0 },
      fragments: { enabled: true, count: 1, minSize: 3, maxSize: 3, travelDistance: 0, tangentialDrift: 0, lifetime: 1 },
    })
    const frames = renderExplosionFrames(parameters)
    const counts = frames.slice(1, -1).map(countOpaque)
    expect(Math.max(...counts)).toBe(9)
  })
})

/** Disables all optional layers unless a test explicitly overrides one. */
function quietParameters(
  overrides: Partial<ExplosionParameters> = {},
  base: ExplosionParameters = DEFAULT_EXPLOSION_PARAMETERS,
): ExplosionParameters {
  return {
    ...base,
    core: { ...base.core, enabled: false },
    shockwave: { ...base.shockwave, mode: 'none' as const },
    tongues: { ...base.tongues, enabled: false },
    fragments: { ...base.fragments, enabled: false },
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

/** Counts angular bins containing at least one opaque sample. */
function occupiedAngleBins(frame: PixelFrame, bins: number): number {
  const occupied = new Set<number>()
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    occupied.add(Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins)))
  }
  return occupied.size
}

/** Splits opaque pixels into contiguous radial bands with their angular coverage. */
function radialBands(frame: PixelFrame): { readonly angleBins: number }[] {
  const occupied = new Map<number, Set<number>>()
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const radius = Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2)
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    const bucket = Math.floor(radius)
    const bins = occupied.get(bucket) ?? new Set<number>()
    bins.add(Math.min(71, Math.floor(angle / (Math.PI * 2) * 72)))
    occupied.set(bucket, bins)
  }
  const buckets = [...occupied.keys()].sort((a, b) => a - b)
  const bands: { readonly angleBins: number }[] = []
  let current = new Set<number>()
  let previous = Number.NaN
  for (const bucket of buckets) {
    if (!Number.isNaN(previous) && bucket > previous + 1) {
      bands.push({ angleBins: current.size })
      current = new Set<number>()
    }
    occupied.get(bucket)!.forEach((bin) => current.add(bin))
    previous = bucket
  }
  if (current.size > 0) bands.push({ angleBins: current.size })
  return bands
}

/** Collects every opaque sample with its radial distance and serialized color. */
function opaqueSamples(frame: PixelFrame): { readonly radius: number; readonly color: string }[] {
  const samples: { readonly radius: number; readonly color: string }[] = []
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const offset = (y * frame.width + x) * 4
    if (frame.pixels[offset + 3] === 0) continue
    samples.push({
      radius: Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2),
      color: Array.from(frame.pixels.subarray(offset, offset + 3)).join(','),
    })
  }
  return samples
}

/** Ratio between the largest and smallest angular-bin mean opaque radii. */
function axisRadiusRatio(frame: PixelFrame, bins: number): number {
  const totals = new Array<number>(bins).fill(0)
  const counts = new Array<number>(bins).fill(0)
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const radius = Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2)
    const angle = Math.atan2(y + 0.5 - frame.height / 2, x + 0.5 - frame.width / 2) + Math.PI
    const bin = Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins))
    totals[bin] += radius
    counts[bin] += 1
  }
  const means = totals.map((total, index) => total / Math.max(1, counts[index])).filter((value, index) => counts[index] > 0)
  return Math.max(...means) / Math.max(1, Math.min(...means))
}

/** Measures the average opaque radius. */
function meanOpaqueRadius(frame: PixelFrame): number {
  let total = 0
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) if (frame.pixels[(y * frame.width + x) * 4 + 3] === 255) {
    total += Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2)
    count += 1
  }
  return total / Math.max(1, count)
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
