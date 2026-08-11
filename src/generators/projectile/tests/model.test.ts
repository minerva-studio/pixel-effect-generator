import { describe, expect, it } from 'vitest'
import {
  DEFAULT_PROJECTILE_PARAMETERS,
  MAX_AFTERIMAGE_COUNT,
  MAX_LOOP_CYCLES,
  MAX_SPARK_COUNT,
  PROJECTILE_FRAME_SIZE,
  assertValidProjectileParameters,
  projectileFrameLimits,
  resizeProjectileCanvas,
  type ProjectileParameters,
} from '../model'

describe('projectile model', () => {
  it('exposes valid 128×128 defaults with ten flight frames', () => {
    expect(DEFAULT_PROJECTILE_PARAMETERS.canvasWidth).toBe(PROJECTILE_FRAME_SIZE)
    expect(DEFAULT_PROJECTILE_PARAMETERS.canvasHeight).toBe(PROJECTILE_FRAME_SIZE)
    expect(DEFAULT_PROJECTILE_PARAMETERS.frameCount).toBe(10)
    expect(DEFAULT_PROJECTILE_PARAMETERS.kind).toBe('fireball')
    expect(DEFAULT_PROJECTILE_PARAMETERS.rotationDegrees).toBe(0)
    expect(DEFAULT_PROJECTILE_PARAMETERS.bodyLength).toBe(38)
    expect(DEFAULT_PROJECTILE_PARAMETERS.afterimageSpacing).toBe(0.18)
    expect(DEFAULT_PROJECTILE_PARAMETERS.afterimageDecay).toBe(0.75)
    expect(() => assertValidProjectileParameters(DEFAULT_PROJECTILE_PARAMETERS)).not.toThrow()
  })

  it('derives the radius cap from the short canvas edge', () => {
    expect(projectileFrameLimits({ width: 64, height: 64 }).maxRadius).toBe(32)
    expect(projectileFrameLimits({ width: 64, height: 64 }).maxBodyLength).toBe(60)
    expect(projectileFrameLimits({ width: 32, height: 64 }).maxRadius).toBe(16)
    expect(projectileFrameLimits({ width: 16, height: 16 }).maxRadius).toBe(8)
  })

  it('rejects invalid enums, ranges, booleans, and palettes', () => {
    const base = DEFAULT_PROJECTILE_PARAMETERS
    expect(() => assertValidProjectileParameters({ ...base, kind: 'missile' as never })).toThrow(/kind|invalid/i)
    expect(() => assertValidProjectileParameters({ ...base, crystalForm: 'orb' as never })).toThrow(/crystalForm|invalid/i)
    expect(() => assertValidProjectileParameters({ ...base, fireMottleAmount: 1.1 })).toThrow(/fireMottleAmount/)
    expect(() => assertValidProjectileParameters({ ...base, arrowMaterial: 'steel' as never })).toThrow(/arrowMaterial|invalid/i)
    expect(() => assertValidProjectileParameters({ ...base, trailMode: 'glow' as never })).toThrow(/trailMode|invalid/i)
    expect(() => assertValidProjectileParameters({ ...base, radius: 65 })).toThrow(/radius/)
    expect(() => assertValidProjectileParameters({ ...base, radius: 1 })).toThrow(/radius/)
    expect(() => assertValidProjectileParameters({ ...base, bodyLength: 125 })).toThrow(/bodyLength/)
    expect(() => assertValidProjectileParameters({ ...base, trailWidth: base.radius + 1 })).toThrow(/trailWidth/)
    expect(() => assertValidProjectileParameters({ ...base, loopCycles: MAX_LOOP_CYCLES + 1 })).toThrow(/loopCycles/)
    expect(() => assertValidProjectileParameters({ ...base, sparkCount: MAX_SPARK_COUNT + 1 })).toThrow(/sparkCount/)
    expect(() => assertValidProjectileParameters({ ...base, afterimageCount: MAX_AFTERIMAGE_COUNT + 1 })).toThrow(/afterimageCount/)
    expect(() => assertValidProjectileParameters({ ...base, sparksEnabled: 1 as never })).toThrow(/sparksEnabled/)
    expect(() => assertValidProjectileParameters({ ...base, bodyPalette: [base.bodyPalette[0]] })).toThrow(/bodyPalette/)
    expect(() => assertValidProjectileParameters({ ...base, energyPalette: [...base.energyPalette, base.energyPalette[0], base.energyPalette[0], base.energyPalette[0]] })).toThrow(/energyPalette/)
    expect(() => assertValidProjectileParameters({
      ...base,
      energyPalette: base.energyPalette.map((color, index) => index === 0 ? { ...color, a: 256 } : color),
    })).toThrow(/a must be between 0 and 255/)
  })

  it('scales radius and trail width proportionally and clamps on small canvases', () => {
    const scaled = resizeProjectileCanvas(DEFAULT_PROJECTILE_PARAMETERS, { width: 256, height: 256 }, true)
    expect(scaled.canvasWidth).toBe(256)
    expect(scaled.radius).toBe(36)
    expect(scaled.bodyLength).toBe(76)
    expect(scaled.trailWidth).toBe(24)

    const unscaled = resizeProjectileCanvas(DEFAULT_PROJECTILE_PARAMETERS, { width: 256, height: 256 }, false)
    expect(unscaled.radius).toBe(18)
    expect(unscaled.bodyLength).toBe(38)
    expect(unscaled.trailWidth).toBe(12)

    const tiny = resizeProjectileCanvas(DEFAULT_PROJECTILE_PARAMETERS, { width: 16, height: 16 }, true)
    expect(tiny.radius).toBe(2)
    expect(tiny.bodyLength).toBe(5)
    expect(tiny.trailWidth).toBe(2)
    expect(() => assertValidProjectileParameters(tiny)).not.toThrow()
  })

  it('keeps the trail width within the radius after resizing', () => {
    const parameters: ProjectileParameters = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      canvasWidth: 128,
      canvasHeight: 128,
      radius: 32,
      trailWidth: 32,
    }
    const resized = resizeProjectileCanvas(parameters, { width: 64, height: 64 }, true)
    expect(resized.radius).toBe(16)
    expect(resized.trailWidth).toBeLessThanOrEqual(resized.radius)
  })
})
