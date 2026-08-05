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
  })
})
