import { describe, expect, it } from 'vitest'
import { assertValidParameters, DEFAULT_SLASH_PARAMETERS, frameLimits, resizeSlashCanvas } from '../model'

describe('slash model', () => {
  it('accepts the modern defaults and rejects invalid mode values', () => {
    expect(() => assertValidParameters(DEFAULT_SLASH_PARAMETERS)).not.toThrow()
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, dissolveMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, edgeBreakupMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMode: 'invalid' as never })).toThrow(RangeError)
  })

  it('scales selected geometry when resize scale is enabled', () => {
    const next = resizeSlashCanvas(
      { ...DEFAULT_SLASH_PARAMETERS, radius: 40, thickness: 20, fragmentSize: 3, fragmentTangentSpeed: 8, fragmentOutwardSpeed: 4 },
      { width: 64, height: 32 },
      true,
    )
    const limits = frameLimits({ width: 64, height: 32 })

    expect(next.canvasWidth).toBe(64)
    expect(next.canvasHeight).toBe(32)
    expect(next.radius).toBe(10)
    expect(next.thickness).toBe(5)
    expect(next.fragmentSize).toBe(1)
    expect(next.fragmentTangentSpeed).toBe(2)
    expect(next.fragmentOutwardSpeed).toBe(1)
    expect(next.radius).toBeLessThanOrEqual(limits.maxRadius)
  })

  it('keeps manual values when resize scale is disabled and clamps only to bounds', () => {
    const next = resizeSlashCanvas(
      { ...DEFAULT_SLASH_PARAMETERS, radius: 60, thickness: 60, fragmentSize: 6, fragmentTangentSpeed: 32, fragmentOutwardSpeed: 24 },
      { width: 20, height: 20 },
      false,
    )
    const limits = frameLimits({ width: 20, height: 20 })

    expect(next.canvasWidth).toBe(20)
    expect(next.canvasHeight).toBe(20)
    expect(next.radius).toBe(9)
    expect(next.thickness).toBe(9)
    expect(next.fragmentSize).toBe(limits.maxFragmentSize)
    expect(next.fragmentTangentSpeed).toBe(limits.maxFragmentTangentSpeed)
    expect(next.fragmentOutwardSpeed).toBe(limits.maxFragmentOutwardSpeed)
  })
})
