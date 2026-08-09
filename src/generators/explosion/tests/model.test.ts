import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  MODERN_EXPLOSION_PARAMETERS,
  assertValidExplosionParameters,
  createExplosionSurface,
  explosionFrameLimits,
  explosionShapeCount,
  explosionVolumeProfiles,
  normalizeExplosionVolume,
  resizeExplosionCanvas,
} from '../model'

describe('combustion explosion parameter model', () => {
  it('defaults to the classic retro radial look while modern defaults stay billowing', () => {
    expect(DEFAULT_EXPLOSION_PARAMETERS.body.shape).toBe('legacyRadial')
    expect(DEFAULT_EXPLOSION_PARAMETERS.surface.style).toBe('retroPixel')
    expect(DEFAULT_EXPLOSION_PARAMETERS.tongues.enabled).toBe(false)
    expect(MODERN_EXPLOSION_PARAMETERS.body.shape).toBe('gameFireball')
    expect(MODERN_EXPLOSION_PARAMETERS.body.smokeCount).toBe(5)
    expect(MODERN_EXPLOSION_PARAMETERS.body.smokeMotion).toBe('billowing')
    expect(MODERN_EXPLOSION_PARAMETERS.tongues.enabled).toBe(false)
  })

  it('validates defaults and rejects invalid shapes, surfaces, curves, and timing', () => {
    expect(() => assertValidExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS)).not.toThrow()
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape: 'cloud' as never },
    })).toThrow(/shape/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      surface: { style: 'smooth' as never, coverage: 0.9, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
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

  it('rejects invalid shockwave modes, color modes, and field ranges', () => {
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, mode: 'arcs' as never },
    })).toThrow(/shockwave\.mode/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, colorMode: 'stripes' as never },
    })).toThrow(/shockwave\.colorMode/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, ringCount: 5 },
    })).toThrow(/shockwave\.ringCount/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, ringSpacing: 1.5 },
    })).toThrow(/shockwave\.ringSpacing/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, squash: -0.1 },
    })).toThrow(/shockwave\.squash/i)
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, squashAngle: 360 },
    })).toThrow(/shockwave\.squashAngle/i)
  })

  it('exposes per-shape direction counts and size-dependent limits', () => {
    expect(explosionShapeCount('gameFireball')).toBe(5)
    expect(explosionShapeCount('gameFireball', 8)).toBe(8)
    expect(explosionShapeCount('directionalBlast')).toBe(5)
    expect(explosionShapeCount('smokeBurst')).toBe(6)
    expect(explosionShapeCount('legacyRadial')).toBe(8)
    expect(explosionFrameLimits({ width: 64, height: 32 }).maxRadius).toBe(16)
    expect(explosionFrameLimits({ width: 128, height: 128 }).maxTongueLength).toBe(96)
  })

  it('accepts only the two supported smoke motion languages', () => {
    for (const smokeMotion of ['billowing', 'particulate'] as const) {
      expect(() => assertValidExplosionParameters({
        ...MODERN_EXPLOSION_PARAMETERS,
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, smokeMotion },
      })).not.toThrow()
    }
    expect(() => assertValidExplosionParameters({
      ...MODERN_EXPLOSION_PARAMETERS,
      body: { ...MODERN_EXPLOSION_PARAMETERS.body, smokeMotion: 'anchoredScale' as never },
    })).toThrow(/smokeMotion/i)
  })

  it('requires smoke count to be an integer from three to nine', () => {
    for (const smokeCount of [3, 5, 9]) {
      expect(() => assertValidExplosionParameters({
        ...MODERN_EXPLOSION_PARAMETERS,
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, smokeCount },
      })).not.toThrow()
    }
    for (const smokeCount of [2, 10, 4.5]) {
      expect(() => assertValidExplosionParameters({
        ...MODERN_EXPLOSION_PARAMETERS,
        body: { ...MODERN_EXPLOSION_PARAMETERS.body, smokeCount },
      })).toThrow(/smokeCount|integer/i)
    }
  })

  it('limits and normalizes volume profiles per active shape', () => {
    expect(explosionVolumeProfiles('gameFireball')).toEqual(['hardShell', 'moltenCore'])
    expect(explosionVolumeProfiles('smokeBurst')).toEqual(['smokeFire'])
    expect(normalizeExplosionVolume('smokeBurst', { enabled: true, profile: 'hardShell' })).toEqual({ enabled: true, profile: 'smokeFire' })
    expect(normalizeExplosionVolume('legacyRadial', { enabled: true, profile: 'moltenCore' })).toEqual({ enabled: false, profile: 'hardShell' })
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
    expect(createExplosionSurface('retroPixel')).toEqual({ style: 'retroPixel', coverage: 0.96, dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 })
  })

  it('rejects invalid retro-pixel dissolve styles', () => {
    expect(() => assertValidExplosionParameters({
      ...DEFAULT_EXPLOSION_PARAMETERS,
      surface: { style: 'retroPixel', coverage: 0.9, dissolveStyle: 'sweep' as never, dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 },
    })).toThrow(/dissolveStyle/i)
  })

  it('rejects out-of-range retro-pixel dissolve settings', () => {
    const surface = { style: 'retroPixel' as const, coverage: 0.9, dissolveStyle: 'pixelNoise' as const, dissolveSize: 6, dissolveJitter: 0.5, dissolveDensity: 0, dissolveSpeed: 1 }
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { ...surface, dissolveSize: 9 } })).toThrow(/dissolveSize/i)
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { ...surface, dissolveJitter: -0.1 } })).toThrow(/dissolveJitter/i)
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { ...surface, dissolveDensity: 1.2 } })).toThrow(/dissolveDensity/i)
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { ...surface, dissolveSpeed: 2 } })).toThrow(/dissolveSpeed/i)
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, surface: { ...surface, dissolveSize: 6.5 } })).toThrow(/dissolveSize/i)
  })
})
