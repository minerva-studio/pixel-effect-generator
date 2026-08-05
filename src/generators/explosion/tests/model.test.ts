import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  MODERN_EXPLOSION_PARAMETERS,
  assertValidExplosionParameters,
  createExplosionSurface,
  explosionFrameLimits,
  explosionShapeCount,
  resizeExplosionCanvas,
} from '../model'

describe('combustion explosion parameter model', () => {
  it('defaults to the classic retro radial look while modern defaults stay billowing', () => {
    expect(DEFAULT_EXPLOSION_PARAMETERS.body.shape).toBe('legacyRadial')
    expect(DEFAULT_EXPLOSION_PARAMETERS.surface.style).toBe('retroPixel')
    expect(DEFAULT_EXPLOSION_PARAMETERS.tongues.enabled).toBe(false)
    expect(MODERN_EXPLOSION_PARAMETERS.body.shape).toBe('billowingFireball')
    expect(MODERN_EXPLOSION_PARAMETERS.tongues.enabled).toBe(true)
  })

  it('validates defaults and rejects invalid shapes, surfaces, curves, and timing', () => {
    expect(() => assertValidExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS)).not.toThrow()
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape: 'cloud' as never },
    })).toThrow(/shape/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      surface: { style: 'smooth' as never, coverage: 0.9 },
    })).toThrow(/style/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      motion: { ...DEFAULT_EXPLOSION_PARAMETERS.motion, motionCurve: 'wave' as never },
    })).toThrow(/motionCurve/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      motion: {
        ...DEFAULT_EXPLOSION_PARAMETERS.motion,
        formationDuration: 0.7,
        holdDuration: 0.3,
        dissolveStart: 0.6,
      },
    })).toThrow(/dissolveStart/i)
  })

  it('exposes per-shape direction counts and size-dependent limits', () => {
    expect(explosionShapeCount('billowingFireball')).toBe(8)
    expect(explosionShapeCount('pressureBurst')).toBe(6)
    expect(explosionShapeCount('legacyRadial')).toBe(8)
    expect(explosionFrameLimits({ width: 64, height: 32 }).maxRadius).toBe(16)
    expect(explosionFrameLimits({ width: 128, height: 128 }).maxTongueLength).toBe(96)
  })

  it('scales pixel-space values from the short canvas edge', () => {
    const resized = resizeExplosionCanvas(DEFAULT_EXPLOSION_PARAMETERS, { width: 64, height: 32 }, true)
    expect(resized.canvasWidth).toBe(64)
    expect(resized.canvasHeight).toBe(32)
    expect(resized.body.radius).toBeLessThanOrEqual(16)
    expect(resized.tongues.length).toBeLessThanOrEqual(24)
    expect(resized.fragments.travelDistance).toBeLessThanOrEqual(16)
  })

  it('creates style-specific default surfaces', () => {
    expect(createExplosionSurface('burningLayers')).toMatchObject({ style: 'burningLayers', bandWarp: 0.18, edgeBreakup: 0.32 })
    expect(createExplosionSurface('rollingSoot')).toMatchObject({ style: 'rollingSoot', sootAmount: 0.3, sootScale: 11 })
    expect(createExplosionSurface('retroPixel')).toEqual({ style: 'retroPixel', coverage: 0.96 })
  })
})
