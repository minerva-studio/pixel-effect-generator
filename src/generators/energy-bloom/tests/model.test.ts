import { describe, expect, it } from 'vitest'
import {
  DEFAULT_BLOOM_PARAMETERS,
  assertValidBloomParameters,
  bloomFrameLimits,
  bloomShapeCount,
  createBloomSurface,
  resizeBloomCanvas,
} from '../model'

describe('energy bloom parameter model', () => {
  it('defaults to soft petals with tongues disabled', () => {
    expect(DEFAULT_BLOOM_PARAMETERS.body.shape).toBe('softPetals')
    expect(DEFAULT_BLOOM_PARAMETERS.tongues.enabled).toBe(false)
    expect(() => assertValidBloomParameters(DEFAULT_BLOOM_PARAMETERS)).not.toThrow()
  })

  it('rejects invalid shapes, surfaces, curves, and timing', () => {
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'daisy' as never },
    })).toThrow(/shape/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      surface: { style: 'smooth' as never, coverage: 0.9 },
    })).toThrow(/style/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      motion: { ...DEFAULT_BLOOM_PARAMETERS.motion, motionCurve: 'wave' as never },
    })).toThrow(/motionCurve/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, corollaLayers: 4 },
    })).toThrow(/corollaLayers/i)
  })

  it('rejects invalid shockwave modes, color modes, and field ranges', () => {
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, mode: 'arcs' as never },
    })).toThrow(/shockwave\.mode/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, colorMode: 'stripes' as never },
    })).toThrow(/shockwave\.colorMode/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, ringCount: 0 },
    })).toThrow(/shockwave\.ringCount/i)
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, squashAngle: -1 },
    })).toThrow(/shockwave\.squashAngle/i)
  })

  it('exposes shape-specific direction counts and size-dependent limits', () => {
    expect(bloomShapeCount(DEFAULT_BLOOM_PARAMETERS.body)).toBe(7)
    expect(bloomShapeCount({ ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'sharpStarburst' })).toBe(10)
    expect(bloomShapeCount({ ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'layeredCorolla' })).toBe(7)
    expect(bloomFrameLimits({ width: 64, height: 32 }).maxRadius).toBe(16)
  })

  it('scales pixel-space values from the short canvas edge', () => {
    const resized = resizeBloomCanvas(DEFAULT_BLOOM_PARAMETERS, { width: 64, height: 32 }, true)
    expect(resized.canvasWidth).toBe(64)
    expect(resized.canvasHeight).toBe(32)
    expect(resized.body.radius).toBeLessThanOrEqual(16)
    expect(resized.tongues.length).toBeLessThanOrEqual(24)
  })

  it('creates style-specific default surfaces', () => {
    expect(createBloomSurface('celBands')).toMatchObject({ style: 'celBands', bandWarp: 0.15, edgeBreakup: 0.3 })
    expect(createBloomSurface('crystalShards')).toMatchObject({ style: 'crystalShards', chunkSize: 8, crackWidth: 1 })
    expect(createBloomSurface('gridNoise')).toEqual({ style: 'gridNoise', coverage: 0.96 })
    expect(createBloomSurface('pixelNoise')).toEqual({ style: 'pixelNoise', coverage: 0.96, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 })
  })

  it('rejects invalid pixel-noise dissolve styles', () => {
    expect(() => assertValidBloomParameters({
      ...DEFAULT_BLOOM_PARAMETERS,
      surface: { style: 'pixelNoise', coverage: 0.9, dissolveStyle: 'sweep' as never, dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
    })).toThrow(/dissolveStyle/i)
  })

  it('rejects out-of-range pixel-noise dissolve settings', () => {
    const surface = { style: 'pixelNoise' as const, coverage: 0.9, dissolveStyle: 'pixelNoise' as const, dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 }
    expect(() => assertValidBloomParameters({ ...DEFAULT_BLOOM_PARAMETERS, surface: { ...surface, dissolveSize: 2 } })).toThrow(/dissolveSize/i)
    expect(() => assertValidBloomParameters({ ...DEFAULT_BLOOM_PARAMETERS, surface: { ...surface, dissolveSpeed: 0.4 } })).toThrow(/dissolveSpeed/i)
    expect(() => assertValidBloomParameters({ ...DEFAULT_BLOOM_PARAMETERS, surface: { ...surface, dissolveDensity: 1.5 } })).toThrow(/dissolveDensity/i)
  })
})
