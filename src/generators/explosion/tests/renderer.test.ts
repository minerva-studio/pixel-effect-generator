import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import {
  createExplosionSurface,
  LEGACY_EXPLOSION_PARAMETERS,
  MODERN_EXPLOSION_PARAMETERS,
  SMOKE_EXPLOSION_PALETTE,
  resizeExplosionCanvas,
  type ExplosionParameters,
  type ExplosionSurfaceStyle,
} from '../model'
import { EXPLOSION_BUILTIN_PRESETS, applyExplosionPreset } from '../presets'
import { renderExplosionFrames } from '../renderer'
import { renderShockwave } from '../../shared-effects/shockwave'

const SURFACES: readonly ExplosionSurfaceStyle[] = ['burningLayers', 'rollingSoot', 'retroPixel']

describe('renderExplosionFrames', () => {
  it('renders deterministic binary-alpha frames with transparent endpoints', () => {
    const first = renderExplosionFrames(LEGACY_EXPLOSION_PARAMETERS)
    const repeated = renderExplosionFrames(LEGACY_EXPLOSION_PARAMETERS)
    const changed = renderExplosionFrames({ ...LEGACY_EXPLOSION_PARAMETERS, seed: LEGACY_EXPLOSION_PARAMETERS.seed + 1 })
    expect(frameBytes(first)).toEqual(frameBytes(repeated))
    expect(frameBytes(first)).not.toEqual(frameBytes(changed))
    expect(countOpaque(first[0])).toBe(0)
    expect(countOpaque(first.at(-1)!)).toBe(0)
    expect(new Set(first.flatMap(alphaValues))).toEqual(new Set([0, 255]))
  })

  it('writes per-band palette alpha into rendered pixels', () => {
    const palette = LEGACY_EXPLOSION_PARAMETERS.palette.map((color, index) => ({ ...color, a: 223 - index * 32 }))
    const frames = renderExplosionFrames({ ...LEGACY_EXPLOSION_PARAMETERS, palette })
    const allowed = new Set(['0,0,0,0', ...palette.map(({ r, g, b, a }) => `${r},${g},${b},${a}`)])
    expect([...new Set(frames.flatMap(colors))].every((color) => allowed.has(color))).toBe(true)
    const alphas = new Set(frames.flatMap(alphaValues))
    expect(alphas).not.toContain(255)
    expect(alphas.has(223)).toBe(true)
  })

  it('supports resized rectangular canvases', () => {
    const resized = resizeExplosionCanvas(LEGACY_EXPLOSION_PARAMETERS, { width: 64, height: 32 }, true)
    const frames = renderExplosionFrames({ ...resized, frameCount: 6 })
    expect(frames.every((frame) => frame.width === 64 && frame.height === 32)).toBe(true)
  })

  it('uses only transparent pixels and exact palette colors for every surface', () => {
    for (const style of SURFACES) {
      const parameters = { ...LEGACY_EXPLOSION_PARAMETERS, surface: createExplosionSurface(style) }
      const allowed = new Set(['0,0,0,0', ...parameters.palette.map(({ r, g, b }) => `${r},${g},${b},255`)])
      expect([...new Set(renderExplosionFrames(parameters).flatMap(colors))].every((color) => allowed.has(color)), style).toBe(true)
    }
  })

  it('produces three structurally distinct deterministic modern shapes', () => {
    const signatures = (['rollingFireball', 'shockBlast', 'smokeBurst'] as const).map((shape) => {
      const parameters = quietParameters({
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape },
        volume: { enabled: true, profile: shape === 'smokeBurst' ? 'smokeFire' : 'hardShell' },
      }, MODERN_EXPLOSION_PARAMETERS)
      const frames = renderExplosionFrames(parameters)
      expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(parameters)))
      return fullFrameHash(frames)
    })
    expect(new Set(signatures).size).toBe(3)
  })

  it('keeps all three active modern volume silhouettes structurally distinct', () => {
    const shapes = ['rollingFireball', 'shockBlast', 'smokeBurst'] as const
    const signatures = shapes.map((shape) => {
      const parameters = quietParameters({
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape },
        volume: { enabled: true, profile: shape === 'smokeBurst' ? 'smokeFire' : 'hardShell' },
        shockwave: { ...MODERN_EXPLOSION_PARAMETERS.shockwave, mode: 'none' },
        tongues: { ...MODERN_EXPLOSION_PARAMETERS.tongues, enabled: false },
        fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
        core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false },
      }, MODERN_EXPLOSION_PARAMETERS)
      const frame = renderExplosionFrames(parameters)[4]
      return silhouetteSignature(frame)
    })
    expect(new Set(signatures).size).toBe(3)
  })

  it('renders each volume profile deterministically with visible layering differences', () => {
    const cases = [
      { shape: 'rollingFireball', profile: 'hardShell' },
      { shape: 'rollingFireball', profile: 'moltenCore' },
      { shape: 'smokeBurst', profile: 'smokeFire' },
    ] as const
    const profiles = cases.map(({ shape, profile }) => {
      const parameters = quietParameters({
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape },
        volume: { enabled: true, profile },
        surface: { style: 'burningLayers', coverage: 1, bandWarp: 0, edgeBreakup: 0 },
        core: { ...MODERN_EXPLOSION_PARAMETERS.core, duration: 0.8 },
      }, MODERN_EXPLOSION_PARAMETERS)
      const frames = renderExplosionFrames(parameters)
      expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(parameters)))
      expect(new Set(frames.flatMap(colors)).size).toBeGreaterThan(1)
      expect(new Set(frames.flatMap(alphaValues))).toEqual(new Set([0, 255]))
      return fullFrameHash(frames)
    })
    expect(new Set(profiles).size).toBe(3)
  })

  it('requires layered volume for independent rolling fireballs', () => {
    const flat = quietParameters({ volume: { enabled: false, profile: 'hardShell' } }, MODERN_EXPLOSION_PARAMETERS)
    expect(() => renderExplosionFrames(flat)).toThrow(/volume is not compatible/)
  })

  it('spreads independent fireballs around the center', () => {
    const frame = renderExplosionFrames(quietParameters({}, MODERN_EXPLOSION_PARAMETERS))[4]
    expect(occupiedAngleBins(frame, 72)).toBeGreaterThanOrEqual(64)
    expect(angularRadiusRatio(frame, 36)).toBeGreaterThan(2)
  })

  it('renders five high-energy shock wedges that narrow monotonically away from the core', () => {
    const parameters = quietParameters({
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'shockBlast', pressureWidth: 14, pressureSharpness: 0.8, rotation: 0 },
      volume: { enabled: true, profile: 'hardShell' },
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    const middle = frames[3]
    expect(opaqueComponents(middle)).toBeGreaterThanOrEqual(4)
    expect(opaqueComponents(middle)).toBeLessThanOrEqual(6)
    expect(countOpaqueInside(middle, 6)).toBeGreaterThan(0)
    expect(occupiedAngleBinsOutside(middle, 72, parameters.body.radius * 0.35)).toBeLessThan(64)
    expect(countOpaqueRegion(middle, (x, y) => Math.hypot(x - middle.width / 2, y - middle.height / 2) > parameters.body.radius * 0.3))
      .toBeGreaterThan(countOpaqueInside(middle, parameters.body.radius * 0.3))
    expect(countExactColorOutside(middle, parameters.palette[0], 0), 'the contracting flash stays white-hot').toBeGreaterThan(0)
    const wedgeSpans = [34, 36, 38].map((radius) => angularSpanNear(middle, radius, 0, 0.7))
    expect(wedgeSpans[0]).toBeGreaterThan(wedgeSpans[1])
    expect(wedgeSpans[1]).toBeGreaterThan(wedgeSpans[2])
  })

  it('keeps shock plates whole and pushing outward every frame while they thin', () => {
    const preset = EXPLOSION_BUILTIN_PRESETS.find(({ id }) => id === 'pressureBurst')!
    const applied = applyExplosionPreset({ ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 }, preset.payload)
    const parameters = { ...applied, fragments: { ...applied.fragments, enabled: false } }
    const frames = renderExplosionFrames(parameters)
    for (let index = 15; index <= 20; index += 1) {
      expect(occupiedAngleRunsOutside(frames[index], 144, parameters.body.radius * 0.5), `frame ${index} plates`).toBe(parameters.body.pressureCount)
      expect(countOpaque(frames[index]), `frame ${index} area`).toBeLessThan(countOpaque(frames[index - 1]))
    }
    for (let index = 2; index <= 21; index += 1) {
      expect(maximumRadius(frames[index]), `frame ${index} front`).toBeGreaterThan(maximumRadius(frames[index - 1]))
    }
  })

  it('keeps the thinning shock front travelling in the last two visible frames', () => {
    const preset = EXPLOSION_BUILTIN_PRESETS.find(({ id }) => id === 'pressureBurst')!
    const parameters = applyExplosionPreset({ ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 }, preset.payload)
    const frames = renderExplosionFrames(parameters)
    for (const frame of frames.slice(-3, -1)) {
      expect(countOpaqueRegion(frame, (x, y) => Math.hypot(x - frame.width / 2, y - frame.height / 2) > parameters.body.radius * 0.9))
        .toBeGreaterThan(0)
      expect(countOpaqueInside(frame, 6), 'the old central flash must finish before the cinders').toBe(0)
    }
  })

  it('lets dissolve start move the legacy-body burnout without changing other parameters', () => {
    for (const presetId of ['pressureBurst', 'rollingFireball', 'smokeBurst', 'particleSmokeBurst']) {
      const preset = EXPLOSION_BUILTIN_PRESETS.find(({ id }) => id === presetId)!
      const parameters = applyExplosionPreset({ ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 }, preset.payload)
      const earlier = renderExplosionFrames({ ...parameters, motion: { ...parameters.motion, dissolveStart: 0.5 } })[17]
      const later = renderExplosionFrames({ ...parameters, motion: { ...parameters.motion, dissolveStart: 0.72 } })[17]
      expect(countOpaque(earlier), `${presetId} should recede sooner`).toBeLessThan(countOpaque(later))
    }
  })

  it('renders the requested 3 to 12 separated shock wedges deterministically', () => {
    for (const pressureCount of [3, 5, 12]) {
      const parameters = quietParameters({
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'shockBlast', pressureCount, pressureWidth: 14, shapeIrregularity: 0, rotation: 0 },
        volume: { enabled: true, profile: 'hardShell' },
      }, MODERN_EXPLOSION_PARAMETERS)
      const frames = renderExplosionFrames(parameters)
      expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(parameters)))
      expect(occupiedAngleRunsOutside(frames[4], 144, parameters.body.radius * 0.35)).toBe(pressureCount)
    }
  })

  it('changes only shock-plate radial bandwidth when shell thickness changes', () => {
    const base = quietParameters({
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'shockBlast', pressureWidth: 4, pressureSharpness: 0.8, shapeIrregularity: 0, rotation: 0 },
      volume: { enabled: true, profile: 'hardShell' },
    }, MODERN_EXPLOSION_PARAMETERS)
    const thin = renderExplosionFrames(base)[3]
    const normal = renderExplosionFrames({ ...base, body: { ...base.body, pressureWidth: 14 } })[3]
    const thick = renderExplosionFrames({ ...base, body: { ...base.body, pressureWidth: 24 } })[3]
    const maximum = renderExplosionFrames({ ...base, body: { ...base.body, pressureWidth: 48 } })[3]
    const minimumRadius = base.body.radius * 0.35
    expect(countOpaque(normal)).toBeGreaterThan(countOpaque(thin))
    expect(countOpaque(thick)).toBeGreaterThan(countOpaque(normal))
    expect(countOpaque(maximum)).toBeGreaterThan(countOpaque(thick))
    expect(occupiedAngleRunsOutside(maximum, 144, minimumRadius)).toBe(5)
    expect(Math.abs(occupiedAngleBinsOutside(thin, 72, minimumRadius) - occupiedAngleBinsOutside(thick, 72, minimumRadius))).toBeLessThanOrEqual(3)
    // Plates launch centered on the core edge, so the front sits half the extra width further out.
    expect(Math.abs(maximumRadius(thick) - maximumRadius(thin) - (24 - 4) / 2)).toBeLessThanOrEqual(1.5)
  })

  it('does not let hidden flat-surface coverage suppress volume rendering', () => {
    const visible = quietParameters({
      volume: { enabled: true, profile: 'hardShell' },
      surface: { style: 'burningLayers', coverage: 1, bandWarp: 0.2, edgeBreakup: 0.2 },
    }, MODERN_EXPLOSION_PARAMETERS)
    const hiddenCoverage = {
      ...visible,
      surface: { ...visible.surface, coverage: 0 },
    } as ExplosionParameters
    expect(frameBytes(renderExplosionFrames(hiddenCoverage))).toEqual(frameBytes(renderExplosionFrames(visible)))
  })

  it('grows the game fireball into mid-clip without a held frame before burnout', () => {
    const parameters = quietParameters({}, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    const visibleAreas = frames.slice(1, -1).map(countOpaque)
    for (let index = 1; index <= 3; index += 1) {
      expect(visibleAreas[index], `visible frame ${index + 1} must keep expanding`).toBeGreaterThan(visibleAreas[index - 1])
    }
    expect(countOpaque(frames[5])).toBeLessThan(countOpaque(frames[4]))
    expect(countOpaque(frames[7])).toBeLessThan(countOpaque(frames[6]))
    expect(countOpaque(frames[6])).toBeLessThan(countOpaque(frames[5]))
  })

  it('lets the rolling body catch the opening flash without an area dip', () => {
    const frames = renderExplosionFrames({ ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 })
    for (let frameIndex = 2; frameIndex <= 4; frameIndex += 1) {
      expect(countOpaque(frames[frameIndex]), `frame ${frameIndex} should grow from the previous frame`)
        .toBeGreaterThanOrEqual(countOpaque(frames[frameIndex - 1]))
    }
  })

  it('keeps the middle rolling silhouette visibly in motion', () => {
    const frames = renderExplosionFrames({ ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 })
    const peak = Math.max(...frames.map(countOpaque))
    let totalChanged = 0
    for (let index = 9; index <= 13; index += 1) {
      let changed = 0
      for (let offset = 3; offset < frames[index].pixels.length; offset += 4) {
        if ((frames[index].pixels[offset] > 0) !== (frames[index - 1].pixels[offset] > 0)) changed += 1
      }
      expect(changed, `middle frame ${index} should change its outline`).toBeGreaterThan(0)
      totalChanged += changed
    }
    expect(totalChanged / 5 / peak).toBeGreaterThanOrEqual(0.06)
  })

  it('burns down both rolling fireball profiles in distributed steps at 10 and 24 frames', () => {
    const moltenPreset = EXPLOSION_BUILTIN_PRESETS.find(({ id }) => id === 'moltenCoreFireball')!
    for (const frameCount of [10, 24]) for (const parameters of [
      { ...MODERN_EXPLOSION_PARAMETERS, frameCount },
      applyExplosionPreset({ ...MODERN_EXPLOSION_PARAMETERS, frameCount }, moltenPreset.payload),
    ]) {
      const frames = renderExplosionFrames(parameters)
      const areas = frames.map(countOpaque)
      const peak = Math.max(...areas)
      const start = Math.ceil(MODERN_EXPLOSION_PARAMETERS.motion.dissolveStart * (frameCount - 1))
      for (let index = start + 1; index < frameCount; index += 1) {
        // Ten frames leave only three visible steps after a mid-clip peak, so
        // reaching a 15% final area requires a slightly wider sampled drop.
        const maximumDrop = frameCount === 10 ? 0.3 : 0.25
        expect((areas[index - 1] - areas[index]) / peak, `${frameCount} frames, step ${index - 1}→${index}`)
          .toBeLessThanOrEqual(maximumDrop)
      }
    }
  })

  it('delays rolling-fireball cooling when dissolve starts later', () => {
    const parameters = {
      ...MODERN_EXPLOSION_PARAMETERS,
      frameCount: 24,
      motion: { ...MODERN_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.9 },
    }
    const early = renderExplosionFrames({ ...parameters, motion: { ...parameters.motion, dissolveStart: 0.5 } })[17]
    const late = renderExplosionFrames(parameters)[17]
    expect(countOpaque(late)).toBeGreaterThan(countOpaque(early))
  })

  it('plays the rolling body backwards in implosion mode', () => {
    const outward = quietParameters({ frameCount: 24 }, MODERN_EXPLOSION_PARAMETERS)
    const inward = { ...outward, motion: { ...outward.motion, mode: 'implosion' as const } }
    const explosion = renderExplosionFrames(outward)
    const implosion = renderExplosionFrames(inward)
    expect(frameBytes(implosion)).toEqual(frameBytes(explosion).reverse())
  })

  it('moves heat bands through the middle of a rolling fireball before cooling begins', () => {
    const parameters = quietParameters({
      frameCount: 24,
      motion: { ...MODERN_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.8 },
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    const first = frames[8]
    const later = frames[12]
    let sharedInterior = 0
    let recolored = 0
    for (let y = 2; y < first.height - 2; y += 1) for (let x = 2; x < first.width - 2; x += 1) {
      const offset = (y * first.width + x) * 4
      const interior = [first, later].every((frame) => [
        offset,
        offset - 4,
        offset + 4,
        offset - first.width * 4,
        offset + first.width * 4,
      ].every((sample) => frame.pixels[sample + 3] === 255))
      if (!interior) continue
      sharedInterior += 1
      if (first.pixels[offset] !== later.pixels[offset]
        || first.pixels[offset + 1] !== later.pixels[offset + 1]
        || first.pixels[offset + 2] !== later.pixels[offset + 2]) recolored += 1
    }
    expect(sharedInterior).toBeGreaterThan(500)
    expect(recolored / sharedInterior).toBeGreaterThan(0.08)
  })

  it('keeps an optional fire tongue on its orbiting lobe', () => {
    const body = quietParameters({ frameCount: 24 }, MODERN_EXPLOSION_PARAMETERS)
    const withTongue = {
      ...body,
      tongues: { enabled: true, count: 1, length: 25, width: 3, curvature: 0, variation: 0 },
    }
    const bodyFrames = renderExplosionFrames(body)
    const tongueFrames = renderExplosionFrames(withTongue)
    const addedAngle = (index: number) => {
      const base = bodyFrames[index]
      const added = tongueFrames[index]
      let sumX = 0
      let sumY = 0
      for (let y = 0; y < base.height; y += 1) for (let x = 0; x < base.width; x += 1) {
        const offset = (y * base.width + x) * 4 + 3
        if (base.pixels[offset] !== 0 || added.pixels[offset] === 0) continue
        sumX += x + 0.5 - base.width / 2
        sumY += y + 0.5 - base.height / 2
      }
      return Math.atan2(sumY, sumX)
    }
    const angularTravel = Math.atan2(
      Math.sin(addedAngle(13) - addedAngle(5)),
      Math.cos(addedAngle(13) - addedAngle(5)),
    )
    expect(Math.abs(angularTravel)).toBeGreaterThan(0.15)
  })

  it('cools game-fireball lobes through orange into the deepest burnout color', () => {
    const parameters = quietParameters({}, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    const middleOrangeRatio = countExactColor(frames[4], parameters.palette[2]) / countOpaque(frames[4])
    const lateOrangeRatio = countExactColor(frames[7], parameters.palette[2]) / countOpaque(frames[7])
    const middleDarkRatio = (countExactColor(frames[4], parameters.palette[3]) + countExactColor(frames[4], parameters.palette[4])) / countOpaque(frames[4])
    const lateDarkRatio = (countExactColor(frames[7], parameters.palette[3]) + countExactColor(frames[7], parameters.palette[4])) / countOpaque(frames[7])
    expect(lateOrangeRatio).toBeLessThan(middleOrangeRatio)
    expect(lateDarkRatio).toBeGreaterThan(middleDarkRatio)
    expect(countExactColor(frames[7], parameters.palette[4]) / countOpaque(frames[7]))
      .toBeGreaterThan(countExactColor(frames[4], parameters.palette[4]) / countOpaque(frames[4]))
  })

  it('changes the game-fireball silhouette when the fire blob count changes', () => {
    const three = quietParameters({ body: { ...MODERN_EXPLOSION_PARAMETERS.body, lobeCount: 3 } }, MODERN_EXPLOSION_PARAMETERS)
    const nine = quietParameters({ body: { ...MODERN_EXPLOSION_PARAMETERS.body, lobeCount: 9 } }, MODERN_EXPLOSION_PARAMETERS)
    expect(silhouetteSignature(renderExplosionFrames(three)[5])).not.toBe(silhouetteSignature(renderExplosionFrames(nine)[5]))
  })

  it('changes individual fireball size and placement with shape irregularity', () => {
    const regular = quietParameters({ body: { ...MODERN_EXPLOSION_PARAMETERS.body, lobeCount: 8, shapeIrregularity: 0 } }, MODERN_EXPLOSION_PARAMETERS)
    const irregular = quietParameters({ body: { ...MODERN_EXPLOSION_PARAMETERS.body, lobeCount: 8, shapeIrregularity: 1 } }, MODERN_EXPLOSION_PARAMETERS)
    const regularFrame = renderExplosionFrames(regular)[4]
    const irregularFrame = renderExplosionFrames(irregular)[4]
    expect(regularFrame.pixels).not.toEqual(irregularFrame.pixels)
  })

  it('renders every supported independent fireball count without losing the body', () => {
    for (let lobeCount = 3; lobeCount <= 9; lobeCount += 1) {
      const parameters = quietParameters({ body: { ...MODERN_EXPLOSION_PARAMETERS.body, lobeCount } }, MODERN_EXPLOSION_PARAMETERS)
      const frames = renderExplosionFrames({ ...parameters, frameCount: 24 })
      expect(Math.max(...frames.map(countOpaque)), `${lobeCount} balls should render`).toBeGreaterThan(500)
      expect(countOpaque(frames.at(-2)!), `${lobeCount} balls should leave a final ember`).toBeGreaterThan(0)
    }
  })

  it('breaks the late game fireball edge into detached directional cinders', () => {
    const frames = renderExplosionFrames(quietParameters({}, MODERN_EXPLOSION_PARAMETERS))
    expect(opaqueComponents(frames[8])).toBeGreaterThan(1)
    expect(countOpaqueRegion(frames[8], (x, y) => Math.hypot(x - 64, y - 64) > MODERN_EXPLOSION_PARAMETERS.body.radius * 0.9)).toBeGreaterThan(0)
  })

  it('expands the main smoke cloud to the requested body radius', () => {
    const parameters = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeMotion: 'billowing', smokeSpread: 1.2 },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    const peak = frames.slice(1, -1).reduce((best, frame) => countOpaque(frame) > countOpaque(best) ? frame : best)
    expect(maximumRadius(peak)).toBeGreaterThanOrEqual(parameters.body.radius * 0.8)
  })

  it('builds deterministic binary-alpha smoke fields with seed and puff-count variation', () => {
    const base = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeCount: 5, smokeSpread: 1.2 },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(base)
    expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames(base)))
    expect(alphaJaccard(frames[12], renderExplosionFrames({ ...base, seed: base.seed + 1 })[12])).toBeLessThan(0.95)
    const allowed = new Set(['0,0,0,0', ...base.palette.map(({ r, g, b, a }) => [r,g,b,a].join(','))])
    expect([...new Set(frames.flatMap(colors))].every((color) => allowed.has(color))).toBe(true)
    expect(new Set(frames.flatMap(alphaValues))).toEqual(new Set([0, 255]))
    const appearances = [3, 5, 9].map((smokeCount) => fullFrameHash(renderExplosionFrames({
      ...base, body: { ...base.body, smokeCount },
    })))
    expect(new Set(appearances).size).toBe(3)
  }, 10_000)

  it('uses spread for cloud width and rise for late upward travel', () => {
    const base = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeCount: 5 },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const narrow = renderExplosionFrames({ ...base, body: { ...base.body, smokeSpread: 0.3 } })[12]
    const wide = renderExplosionFrames({ ...base, body: { ...base.body, smokeSpread: 1.4 } })[12]
    expect(opaqueBounds(wide).width).toBeGreaterThan(opaqueBounds(narrow).width)
    const low = renderExplosionFrames({ ...base, body: { ...base.body, smokeRise: -0.5 } })[17]
    const high = renderExplosionFrames({ ...base, body: { ...base.body, smokeRise: 0.5 } })[17]
    expect(opaqueCentroid(high).y).toBeLessThan(opaqueCentroid(low).y)
  })

  it('cools the smoke after its short-lived ember bed and shades lit edges purple', () => {
    const parameters = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeMotion: 'billowing' },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(parameters)
    expect(countPaletteGroup(frames[3], parameters.palette.slice(0, 2))).toBeGreaterThan(0)
    expect(countPaletteGroup(frames[18], parameters.palette.slice(0, 2))).toBe(0)
    expect(countOpaque(frames[18])).toBeGreaterThan(0)
    expect(exposedColorCount(frames[12], parameters.palette.at(-2)!, 'lit')).toBeGreaterThan(0)
    expect(exposedColorCount(frames[12], parameters.palette.at(-1)!, 'shadow')).toBeGreaterThan(0)
    expect(enclosedTransparentPixels(frames[12])).toBe(0)
  })

  it('splits particulate smoke into detached drifting masses after the peak', () => {
    const base = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeCount: 5 },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const billowing = renderExplosionFrames({ ...base, body: { ...base.body, smokeMotion: 'billowing' } })
    const particulate = renderExplosionFrames({ ...base, body: { ...base.body, smokeMotion: 'particulate' } })
    expect(opaqueComponents(particulate[18])).toBeGreaterThan(opaqueComponents(billowing[18]))
    expect(silhouetteSignature(particulate[14])).not.toBe(silhouetteSignature(particulate[17]))
    expect(countOpaque(particulate[19])).toBeGreaterThan(0)
    expect(countExactColor(particulate[19], base.palette.at(-1)!)).toBeGreaterThan(0)
  })

  it('keeps a diminishing smoke tail through the penultimate frame without a dark scaffold', () => {
    for (const smokeMotion of ['billowing', 'particulate'] as const) {
      const parameters = quietParameters({
        frameCount: 24,
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst', smokeMotion },
        volume: { enabled: true, profile: 'smokeFire' },
        palette: SMOKE_EXPLOSION_PALETTE,
      }, MODERN_EXPLOSION_PARAMETERS)
      const frames = renderExplosionFrames(parameters)
      const peak = Math.max(...frames.map(countOpaque))
      expect(countOpaque(frames.at(-2)!)).toBeGreaterThan(0)
      expect(countOpaque(frames.at(-2)!)).toBeLessThan(peak * 0.15)
      expect(countOpaque(frames.at(-1)!)).toBe(0)
      expect(narrowBottomStemLength(frames[18])).toBeLessThanOrEqual(2)
    }
  })

  it('keeps smoke independent of the old volume and surface controls except darkness', () => {
    const base = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst' },
      volume: { enabled: true, profile: 'smokeFire' },
      surface: { style: 'rollingSoot', coverage: 0.94, sootAmount: 0.38, sootScale: 15 },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const frames = renderExplosionFrames(base)
    expect(frameBytes(frames)).toEqual(frameBytes(renderExplosionFrames({
      ...base, volume: { ...base.volume, enabled: false },
      surface: { style: 'rollingSoot', coverage: 0.5, sootAmount: 0.38, sootScale: 6 },
    })))
    const darker = renderExplosionFrames({
      ...base, surface: { style: 'rollingSoot', coverage: 0.94, sootAmount: 0.65, sootScale: 15 },
    })
    expect(frameBytes(darker)).not.toEqual(frameBytes(frames))
  })

  it('reverses the field body for implosion', () => {
    const base = quietParameters({
      frameCount: 24,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, shape: 'smokeBurst' },
      volume: { enabled: true, profile: 'smokeFire' },
      palette: SMOKE_EXPLOSION_PALETTE,
    }, MODERN_EXPLOSION_PARAMETERS)
    const outward = renderExplosionFrames(base)
    const inward = renderExplosionFrames({ ...base, motion: { ...base.motion, mode: 'implosion' } })
    expect(frameBytes(inward)).toEqual(frameBytes([...outward].reverse()))
  })

  it('preserves every retro frame when optional ring fade and cooling are zero', () => {
    const original = LEGACY_EXPLOSION_PARAMETERS
    const withoutOptions: ExplosionParameters = {
      ...original,
      shockwave: { ...original.shockwave, fade: undefined },
      surface: original.surface.style === 'retroPixel'
        ? { ...original.surface, dissolveCooling: undefined }
        : original.surface,
    }
    for (const frameCount of [10, 24]) {
      expect(frameBytes(renderExplosionFrames({ ...original, frameCount })))
        .toEqual(frameBytes(renderExplosionFrames({ ...withoutOptions, frameCount })))
    }
  })

  it('thins the retro ring before breaking it into staggered angular arcs', () => {
    const wave = { ...LEGACY_EXPLOSION_PARAMETERS.shockwave, thickness: 6, startRadiusScale: 0.6, endRadiusScale: 1.4 }
    const isolated = (time: number, fade: number): PixelFrame => {
      const frame: PixelFrame = { width: 128, height: 128, pixels: new Uint8ClampedArray(128 * 128 * 4) }
      renderShockwave(frame.pixels, frame.width, frame.height, LEGACY_EXPLOSION_PARAMETERS.palette, 'explosion', 42, { ...wave, fade }, time)
      return frame
    }
    const ratios = [0.3, 0.5, 0.7].map((time) => countOpaque(isolated(time, 1)) / countOpaque(isolated(time, 0)))
    expect(ratios[0]).toBeGreaterThan(ratios[1])
    expect(ratios[1]).toBeGreaterThan(ratios[2])
    expect(occupiedAngleBins(isolated(0.9, 1), 72)).toBeLessThan(occupiedAngleBins(isolated(0.9, 0), 72))
    expect(countOpaque(isolated(0.9, 1))).toBeGreaterThan(0)
  })

  it('applies the optional fade to compound gradient rings too', () => {
    const render = (fade: number): PixelFrame => {
      const frame: PixelFrame = { width: 128, height: 128, pixels: new Uint8ClampedArray(128 * 128 * 4) }
      renderShockwave(frame.pixels, frame.width, frame.height, LEGACY_EXPLOSION_PARAMETERS.palette, 'explosion', 42, {
        ...LEGACY_EXPLOSION_PARAMETERS.shockwave,
        mode: 'multiRing', colorMode: 'gradient', squash: 0.3, ringCount: 3, fade,
      }, 0.85)
      return frame
    }
    expect(countOpaque(render(1))).toBeGreaterThan(0)
    expect(countOpaque(render(1))).toBeLessThan(countOpaque(render(0)))
  })

  it('cools surviving retro pixels toward deeper palette bands', () => {
    const surface = LEGACY_EXPLOSION_PARAMETERS.surface
    if (surface.style !== 'retroPixel') throw new Error('Expected retro surface')
    const base: ExplosionParameters = {
      ...LEGACY_EXPLOSION_PARAMETERS,
      frameCount: 24,
      core: { ...LEGACY_EXPLOSION_PARAMETERS.core, enabled: false },
      shockwave: { ...LEGACY_EXPLOSION_PARAMETERS.shockwave, mode: 'none' },
      fragments: { ...LEGACY_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }
    const warm = renderExplosionFrames({ ...base, surface: { ...surface, dissolveCooling: 0 } })[19]
    const cool = renderExplosionFrames({ ...base, surface: { ...surface, dissolveCooling: 0.8 } })[19]
    const averageBand = (frame: PixelFrame) => base.palette.reduce((sum, color, index) => sum + index * countExactColor(frame, color), 0) / countOpaque(frame)
    expect(countOpaque(cool)).toBe(countOpaque(warm))
    expect(averageBand(cool)).toBeGreaterThan(averageBand(warm))
  })

  it('keeps the classic radial shape with the new warm default colors', () => {
    expect(LEGACY_EXPLOSION_PARAMETERS.body.shape).toBe('legacyRadial')
    expect(LEGACY_EXPLOSION_PARAMETERS.surface.style).toBe('retroPixel')
    expect(LEGACY_EXPLOSION_PARAMETERS.shockwave.mode).toBe('ring')
    expect(LEGACY_EXPLOSION_PARAMETERS.tongues.enabled).toBe(false)
    expect(fullFrameHash(renderExplosionFrames(LEGACY_EXPLOSION_PARAMETERS))).toBe('67450be0')
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
        ...LEGACY_EXPLOSION_PARAMETERS.shockwave,
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
        ...LEGACY_EXPLOSION_PARAMETERS.shockwave,
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
        ...LEGACY_EXPLOSION_PARAMETERS.shockwave,
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
        ...LEGACY_EXPLOSION_PARAMETERS.shockwave,
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
      shockwave: { ...LEGACY_EXPLOSION_PARAMETERS.shockwave, mode: 'ring', colorMode: 'flat', squash: 0, squashAngle: 0 },
    })
    const thin = renderExplosionFrames({ ...base, shockwave: { ...base.shockwave, thickness: 1 } })[3]
    const thick = renderExplosionFrames({ ...base, shockwave: { ...base.shockwave, thickness: 6 } })[3]
    expect(occupiedAngleBins(thin, 72)).toBeGreaterThanOrEqual(64)
    expect(occupiedAngleBins(thick, 72)).toBeGreaterThanOrEqual(64)
    expect(Math.abs(meanOpaqueRadius(thin) - meanOpaqueRadius(thick))).toBeLessThan(1)
    expect(maximumRadius(thick)).toBeLessThanOrEqual(LEGACY_EXPLOSION_PARAMETERS.body.radius * base.shockwave.endRadiusScale + 4)
  })

  it('sweeps retro-pixel dissolve from the top-left corner on the legacy path', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'scanSweep', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...LEGACY_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
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
    }, LEGACY_EXPLOSION_PARAMETERS)
    const frame = renderExplosionFrames(parameters)[6]
    const diagonal = frame.width + frame.height
    expect(countOpaqueRegion(frame, (x, y) => x + y <= diagonal / 2))
      .toBeLessThan(countOpaqueRegion(frame, (x, y) => x + y > diagonal / 2))
  })

  it('fades retro-pixel bodies in whole 2x2 blocks', () => {
    const parameters = quietParameters({
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'blockFade', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
      motion: { ...LEGACY_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[7]
    const innerRadius = LEGACY_EXPLOSION_PARAMETERS.body.radius * 0.7
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
      motion: { ...LEGACY_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[4]
    const innerRadius = LEGACY_EXPLOSION_PARAMETERS.body.radius * 0.8
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
      motion: { ...LEGACY_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
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
      motion: { ...LEGACY_EXPLOSION_PARAMETERS.motion, dissolveStart: 0.5 },
    })
    const frame = renderExplosionFrames(parameters)[7]
    const center = countOpaqueInside(frame, LEGACY_EXPLOSION_PARAMETERS.body.radius * 0.4)
    const edge = countOpaqueRegion(frame, (x, y) =>
      Math.hypot(x + 0.5 - frame.width / 2, y + 0.5 - frame.height / 2) > LEGACY_EXPLOSION_PARAMETERS.body.radius * 0.75)
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
  base: ExplosionParameters = LEGACY_EXPLOSION_PARAMETERS,
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

/** Samples a coarse silhouette signature for structure comparisons. */
function silhouetteSignature(frame: PixelFrame): string {
  const cells: string[] = []
  for (let gy = 0; gy < 8; gy += 1) for (let gx = 0; gx < 8; gx += 1) {
    let occupied = 0
    for (let y = Math.floor(gy * frame.height / 8); y < Math.floor((gy + 1) * frame.height / 8); y += 1) for (let x = Math.floor(gx * frame.width / 8); x < Math.floor((gx + 1) * frame.width / 8); x += 1) {
      occupied += frame.pixels[(y * frame.width + x) * 4 + 3] === 255 ? 1 : 0
    }
    cells.push(occupied > 0 ? '1' : '0')
  }
  return cells.join('')
}

/** Counts all opaque pixels in one frame. */
function countOpaque(frame: PixelFrame): number { return alphaValues(frame).filter((alpha) => alpha === 255).length }

/** Counts pixels matching one exact RGB palette entry. */
function countExactColor(frame: PixelFrame, color: { readonly r: number; readonly g: number; readonly b: number }): number {
  let count = 0
  for (let offset = 0; offset < frame.pixels.length; offset += 4) {
    if (frame.pixels[offset] === color.r && frame.pixels[offset + 1] === color.g && frame.pixels[offset + 2] === color.b && frame.pixels[offset + 3] === 255) count += 1
  }
  return count
}

/** Counts one exact opaque color beyond a center-relative radius. */
function countExactColorOutside(
  frame: PixelFrame,
  color: { readonly r: number; readonly g: number; readonly b: number },
  minimumRadius: number,
): number {
  let count = 0
  const cx = frame.width / 2
  const cy = frame.height / 2
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (Math.hypot(x + 0.5 - cx, y + 0.5 - cy) <= minimumRadius) continue
    const offset = (y * frame.width + x) * 4
    if (frame.pixels[offset] === color.r && frame.pixels[offset + 1] === color.g && frame.pixels[offset + 2] === color.b && frame.pixels[offset + 3] === 255) count += 1
  }
  return count
}

/** Measures opaque coverage inside one circular sample region. */
function opaqueFractionInCircle(frame: PixelFrame, centerX: number, centerY: number, radius: number): number {
  let samples = 0
  let opaque = 0
  for (let y = Math.floor(centerY - radius); y <= Math.ceil(centerY + radius); y += 1) for (let x = Math.floor(centerX - radius); x <= Math.ceil(centerX + radius); x += 1) {
    if ((x + 0.5 - centerX) ** 2 + (y + 0.5 - centerY) ** 2 > radius ** 2) continue
    samples += 1
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 255) opaque += 1
  }
  return opaque / Math.max(1, samples)
}

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

/** Returns the axis-aligned bounds of all opaque pixels. */
function opaqueBounds(frame: PixelFrame): { readonly width: number; readonly height: number } {
  let minimumX = frame.width
  let maximumX = -1
  let minimumY = frame.height
  let maximumY = -1
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    minimumX = Math.min(minimumX, x)
    maximumX = Math.max(maximumX, x)
    minimumY = Math.min(minimumY, y)
    maximumY = Math.max(maximumY, y)
  }
  return { width: maximumX - minimumX + 1, height: maximumY - minimumY + 1 }
}

/** Returns the centroid of every opaque pixel in one frame. */
function opaqueCentroid(frame: PixelFrame): { readonly x: number; readonly y: number } {
  let totalX = 0
  let totalY = 0
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    totalX += x
    totalY += y
    count += 1
  }
  return { x: totalX / Math.max(1, count), y: totalY / Math.max(1, count) }
}

/** Measures the vertical centroid of one exact palette color. */
function colorCentroidY(frame: PixelFrame, color: { readonly r: number; readonly g: number; readonly b: number }): number {
  let total = 0
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const offset = (y * frame.width + x) * 4
    if (frame.pixels[offset] !== color.r || frame.pixels[offset + 1] !== color.g || frame.pixels[offset + 2] !== color.b) continue
    total += y
    count += 1
  }
  return count === 0 ? Number.POSITIVE_INFINITY : total / count
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

/** Measures the vertical centroid of a group of exact palette colors. */
function paletteGroupCentroidY(frame: PixelFrame, palette: readonly { readonly r: number; readonly g: number; readonly b: number }[]): number {
  const keys = new Set(palette.map(({ r, g, b }) => `${r},${g},${b}`))
  let total = 0
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const offset = (y * frame.width + x) * 4
    if (!keys.has(`${frame.pixels[offset]},${frame.pixels[offset + 1]},${frame.pixels[offset + 2]}`)) continue
    total += y
    count += 1
  }
  return count === 0 ? Number.POSITIVE_INFINITY : total / count
}

/** Returns four-neighbor opaque component areas from largest to smallest. */
function opaqueComponentAreas(frame: PixelFrame): number[] {
  const seen = new Uint8Array(frame.width * frame.height)
  const areas: number[] = []
  for (let start = 0; start < seen.length; start += 1) {
    if (seen[start] || frame.pixels[start * 4 + 3] !== 255) continue
    const queue = [start]
    seen[start] = 1
    let area = 0
    while (queue.length > 0) {
      const current = queue.pop()!
      area += 1
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
    areas.push(area)
  }
  return areas.sort((left, right) => right - left)
}

/** Measures horizontal alpha agreement without counting shared transparent pixels. */
function horizontalMirrorAgreement(frame: PixelFrame): number {
  let union = 0
  let intersection = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const opaque = frame.pixels[(y * frame.width + x) * 4 + 3] === 255
    const mirrored = frame.pixels[(y * frame.width + frame.width - 1 - x) * 4 + 3] === 255
    if (!opaque && !mirrored) continue
    union += 1
    if (opaque && mirrored) intersection += 1
  }
  return intersection / Math.max(1, union)
}

/** Measures binary-alpha intersection over union between equal-sized frames. */
function alphaJaccard(left: PixelFrame, right: PixelFrame): number {
  let intersection = 0
  let union = 0
  for (let index = 3; index < left.pixels.length; index += 4) {
    const leftOpaque = left.pixels[index] === 255
    const rightOpaque = right.pixels[index] === 255
    if (leftOpaque || rightOpaque) union += 1
    if (leftOpaque && rightOpaque) intersection += 1
  }
  return intersection / Math.max(1, union)
}

/** Counts exact-color boundary pixels on the lit or shadow-facing side. */
function exposedColorCount(
  frame: PixelFrame,
  color: { readonly r: number; readonly g: number; readonly b: number },
  side: 'lit' | 'shadow' | 'litOnly',
): number {
  let count = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const offset = (y * frame.width + x) * 4
    if (frame.pixels[offset] !== color.r || frame.pixels[offset + 1] !== color.g || frame.pixels[offset + 2] !== color.b || frame.pixels[offset + 3] !== 255) continue
    const transparent = (sampleX: number, sampleY: number) => sampleX < 0 || sampleY < 0 || sampleX >= frame.width || sampleY >= frame.height
      || frame.pixels[(sampleY * frame.width + sampleX) * 4 + 3] === 0
    const lit = transparent(x - 1, y) || transparent(x, y - 1)
    const shadow = transparent(x + 1, y) || transparent(x, y + 1)
    if ((side === 'lit' && lit) || (side === 'shadow' && shadow) || (side === 'litOnly' && lit && !shadow)) count += 1
  }
  return count
}

/** Counts pixels matching any RGB entry in one palette group. */
function countPaletteGroup(frame: PixelFrame, palette: readonly { readonly r: number; readonly g: number; readonly b: number }[]): number {
  return palette.reduce((total, color) => total + countExactColor(frame, color), 0)
}

/** Counts matching pixels that touch transparency in the four-neighbor silhouette. */
function exposedPaletteGroupPixels(frame: PixelFrame, palette: readonly { readonly r: number; readonly g: number; readonly b: number }[]): number {
  const keys = new Set(palette.map(({ r, g, b }) => `${r},${g},${b}`))
  let exposed = 0
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    const offset = (y * frame.width + x) * 4
    if (!keys.has(`${frame.pixels[offset]},${frame.pixels[offset + 1]},${frame.pixels[offset + 2]}`)) continue
    if ([[x - 1, y], [x + 1, y], [x, y - 1], [x, y + 1]].some(([neighborX, neighborY]) => (
      neighborX < 0 || neighborY < 0 || neighborX >= frame.width || neighborY >= frame.height
      || frame.pixels[(neighborY * frame.width + neighborX) * 4 + 3] === 0
    ))) exposed += 1
  }
  return exposed
}

/** Measures consecutive one- or two-pixel-wide rows at the bottom of the opaque silhouette. */
function narrowBottomStemLength(frame: PixelFrame): number {
  let bottom = -1
  for (let y = frame.height - 1; y >= 0 && bottom < 0; y -= 1) {
    if (countOpaqueRegion(frame, (_x, sampleY) => sampleY === y) > 0) bottom = y
  }
  let length = 0
  for (let y = bottom; y >= 0; y -= 1) {
    const width = countOpaqueRegion(frame, (_x, sampleY) => sampleY === y)
    if (width === 0 || width > 2) break
    length += 1
  }
  return length
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

/** Counts occupied angular bins beyond a centered radius, excluding the solid flash core. */
function occupiedAngleBinsOutside(frame: PixelFrame, bins: number, minimumRadius: number): number {
  const occupied = new Set<number>()
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const localX = x + 0.5 - frame.width / 2
    const localY = y + 0.5 - frame.height / 2
    if (Math.hypot(localX, localY) < minimumRadius) continue
    const angle = Math.atan2(localY, localX) + Math.PI
    occupied.add(Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins)))
  }
  return occupied.size
}

/** Counts cyclic occupied angular runs beyond the centered flash core. */
function occupiedAngleRunsOutside(frame: PixelFrame, bins: number, minimumRadius: number): number {
  const occupied = Array.from({ length: bins }, () => false)
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const localX = x + 0.5 - frame.width / 2
    const localY = y + 0.5 - frame.height / 2
    if (Math.hypot(localX, localY) < minimumRadius) continue
    const angle = Math.atan2(localY, localX) + Math.PI
    occupied[Math.min(bins - 1, Math.floor(angle / (Math.PI * 2) * bins))] = true
  }
  let runs = 0
  for (let index = 0; index < bins; index += 1) {
    if (occupied[index] && !occupied[(index + bins - 1) % bins]) runs += 1
  }
  return runs
}

/** Measures one centered wedge's occupied angular span at a sampled radius. */
function angularSpanNear(
  frame: PixelFrame,
  sampleRadius: number,
  centerAngle: number,
  halfWindow: number,
): number {
  let minimum = Number.POSITIVE_INFINITY
  let maximum = Number.NEGATIVE_INFINITY
  for (let y = 0; y < frame.height; y += 1) for (let x = 0; x < frame.width; x += 1) {
    if (frame.pixels[(y * frame.width + x) * 4 + 3] === 0) continue
    const localX = x + 0.5 - frame.width / 2
    const localY = y + 0.5 - frame.height / 2
    if (Math.abs(Math.hypot(localX, localY) - sampleRadius) > 1.25) continue
    const angle = Math.atan2(localY, localX)
    const delta = Math.atan2(Math.sin(angle - centerAngle), Math.cos(angle - centerAngle))
    if (Math.abs(delta) > halfWindow) continue
    minimum = Math.min(minimum, delta)
    maximum = Math.max(maximum, delta)
  }
  return Number.isFinite(minimum) && Number.isFinite(maximum) ? maximum - minimum : 0
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

/** Counts transparent pixels that cannot reach the canvas boundary. */
function enclosedTransparentPixels(frame: PixelFrame): number {
  const seen = new Uint8Array(frame.width * frame.height)
  const queue: number[] = []
  for (let x = 0; x < frame.width; x += 1) {
    queue.push(x, (frame.height - 1) * frame.width + x)
  }
  for (let y = 1; y < frame.height - 1; y += 1) {
    queue.push(y * frame.width, y * frame.width + frame.width - 1)
  }
  while (queue.length > 0) {
    const current = queue.pop()!
    if (seen[current] || frame.pixels[current * 4 + 3] === 255) continue
    seen[current] = 1
    const x = current % frame.width
    const y = Math.floor(current / frame.width)
    if (x > 0) queue.push(current - 1)
    if (x + 1 < frame.width) queue.push(current + 1)
    if (y > 0) queue.push(current - frame.width)
    if (y + 1 < frame.height) queue.push(current + frame.width)
  }
  let enclosed = 0
  for (let index = 0; index < seen.length; index += 1) {
    if (!seen[index] && frame.pixels[index * 4 + 3] === 0) enclosed += 1
  }
  return enclosed
}

/** Hashes every byte of every frame with FNV-1a. */
function fullFrameHash(frames: readonly { readonly pixels: Uint8ClampedArray }[]): string {
  let hash = 2166136261
  for (const frame of frames) for (const byte of frame.pixels) hash = Math.imul(hash ^ byte, 16777619)
  return (hash >>> 0).toString(16)
}
