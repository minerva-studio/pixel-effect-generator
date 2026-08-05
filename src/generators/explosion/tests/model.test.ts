import { describe, expect, it } from 'vitest'
import {
  DEFAULT_EXPLOSION_PARAMETERS,
  assertValidExplosionParameters,
  explosionFrameLimits,
  resizeExplosionCanvas,
  updateFragmentMaxSize,
  updateFragmentMinSize,
} from '../model'

describe('explosion parameter model', () => {
  it('validates defaults and rejects invalid modes and size intervals', () => {
    expect(() => assertValidExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS)).not.toThrow()
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, mode: 'other' as 'explosion' })).toThrow(/mode/i)
    expect(() => assertValidExplosionParameters({ ...DEFAULT_EXPLOSION_PARAMETERS, fragmentMinSize: 4, fragmentMaxSize: 2 })).toThrow(/fragmentMinSize/i)
  })

  it('scales pixel-space values from the short canvas edge', () => {
    const resized = resizeExplosionCanvas(DEFAULT_EXPLOSION_PARAMETERS, { width: 64, height: 32 }, true)
    const limits = explosionFrameLimits({ width: 64, height: 32 })
    expect(resized.canvasWidth).toBe(64)
    expect(resized.canvasHeight).toBe(32)
    expect(resized.radius).toBeLessThanOrEqual(limits.maxRadius)
    expect(resized.coreRadius).toBe(4)
    expect(resized.fragmentRadialSpeed).toBeLessThanOrEqual(limits.maxFragmentSpeed)
  })

  it('keeps fragment size edits ordered', () => {
    const raised = updateFragmentMinSize(DEFAULT_EXPLOSION_PARAMETERS, 5)
    expect(raised.fragmentMinSize).toBe(5)
    expect(raised.fragmentMaxSize).toBe(5)
    const lowered = updateFragmentMaxSize(raised, 2)
    expect(lowered.fragmentMinSize).toBe(2)
    expect(lowered.fragmentMaxSize).toBe(2)
  })
})
