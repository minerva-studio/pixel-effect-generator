import { describe, expect, it } from 'vitest'
import {
  assertValidParameters,
  DEFAULT_SLASH_PARAMETERS,
  MAX_FRAGMENT_SIZE,
  frameLimits,
  resizeSlashCanvas,
  updateFragmentMaxSize,
  updateFragmentMinSize,
} from '../model'

describe('slash model', () => {
  it('accepts the modern defaults and rejects invalid mode values', () => {
    expect(() => assertValidParameters(DEFAULT_SLASH_PARAMETERS)).not.toThrow()
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, dissolveMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, edgeBreakupMode: 'invalid' as never })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMode: 'invalid' as never })).toThrow(RangeError)
  })

  it('uses half of the longer canvas side as the radius limit', () => {
    expect(frameLimits({ width: 256, height: 128 }).maxRadius).toBe(128)
    expect(frameLimits({ width: 128, height: 128 }).maxRadius).toBe(64)
    expect(frameLimits({ width: 512, height: 512 }).maxRadius).toBe(256)
    expect(frameLimits({ width: 64, height: 128 }).maxRadius).toBe(64)
  })

  it('keeps fragment sizes in the fixed 1 to 16 pixel range', () => {
    expect(frameLimits({ width: 16, height: 16 }).maxFragmentSize).toBe(MAX_FRAGMENT_SIZE)
    expect(frameLimits({ width: 128, height: 128 }).maxFragmentSize).toBe(MAX_FRAGMENT_SIZE)
    expect(frameLimits({ width: 512, height: 512 }).maxFragmentSize).toBe(MAX_FRAGMENT_SIZE)
  })

  it('scales selected geometry when resize scale is enabled', () => {
    const next = resizeSlashCanvas(
      {
        ...DEFAULT_SLASH_PARAMETERS,
        radius: 40,
        thickness: 20,
        fragmentMinSize: 2,
        fragmentMaxSize: 16,
        fragmentTangentSpeed: 8,
        fragmentOutwardSpeed: 4,
      },
      { width: 64, height: 32 },
      true,
    )
    const limits = frameLimits({ width: 64, height: 32 })

    expect(next.canvasWidth).toBe(64)
    expect(next.canvasHeight).toBe(32)
    expect(next.radius).toBe(10)
    expect(next.thickness).toBe(5)
    expect(next.fragmentMinSize).toBe(1)
    expect(next.fragmentMaxSize).toBe(4)
    expect(next.fragmentTangentSpeed).toBe(2)
    expect(next.fragmentOutwardSpeed).toBe(1)
    expect(next.radius).toBeLessThanOrEqual(limits.maxRadius)
  })

  it('scales fragment sizes into 1 to 16 and restores the legal order', () => {
    const next = resizeSlashCanvas(
      { ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 2, fragmentMaxSize: 16 },
      { width: 256, height: 256 },
      true,
    )
    expect(next.fragmentMinSize).toBe(4)
    expect(next.fragmentMaxSize).toBe(16)
  })

  it('scales the radius by the short edge and clamps to the new long-edge limit', () => {
    const next = resizeSlashCanvas(
      { ...DEFAULT_SLASH_PARAMETERS, radius: 128, thickness: 20 },
      { width: 128, height: 128 },
      true,
    )
    expect(next.radius).toBe(64)
    expect(next.thickness).toBe(20)
  })

  it('keeps manual values when resize scale is disabled and clamps only to bounds', () => {
    const next = resizeSlashCanvas(
      {
        ...DEFAULT_SLASH_PARAMETERS,
        radius: 60,
        thickness: 60,
        fragmentMinSize: 6,
        fragmentMaxSize: 16,
        fragmentTangentSpeed: 32,
        fragmentOutwardSpeed: 24,
      },
      { width: 20, height: 20 },
      false,
    )
    const limits = frameLimits({ width: 20, height: 20 })

    expect(next.canvasWidth).toBe(20)
    expect(next.canvasHeight).toBe(20)
    expect(next.radius).toBe(10)
    expect(next.thickness).toBe(10)
    expect(next.fragmentMinSize).toBe(6)
    expect(next.fragmentMaxSize).toBe(16)
    expect(next.fragmentTangentSpeed).toBe(limits.maxFragmentTangentSpeed)
    expect(next.fragmentOutwardSpeed).toBe(limits.maxFragmentOutwardSpeed)
  })

  it('keeps the radius unchanged when scale is disabled and it stays within the new limit', () => {
    const next = resizeSlashCanvas(
      { ...DEFAULT_SLASH_PARAMETERS, radius: 40, thickness: 20 },
      { width: 128, height: 64 },
      false,
    )
    expect(next.radius).toBe(40)
    expect(next.thickness).toBe(20)
  })

  it('cross-updates fragment size bounds to keep minimum at most maximum', () => {
    const raisedMinimum = updateFragmentMinSize(
      { ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 2, fragmentMaxSize: 4 },
      6,
    )
    expect(raisedMinimum.fragmentMinSize).toBe(6)
    expect(raisedMinimum.fragmentMaxSize).toBe(6)

    const loweredMaximum = updateFragmentMaxSize(
      { ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 4, fragmentMaxSize: 8 },
      3,
    )
    expect(loweredMaximum.fragmentMaxSize).toBe(3)
    expect(loweredMaximum.fragmentMinSize).toBe(3)

    const widenedMaximum = updateFragmentMaxSize(
      { ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 2, fragmentMaxSize: 4 },
      6,
    )
    expect(widenedMaximum.fragmentMaxSize).toBe(6)
    expect(widenedMaximum.fragmentMinSize).toBe(2)
  })

  it('rejects invalid fragment size ranges and non-integer sizes', () => {
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 5, fragmentMaxSize: 4 })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 0 })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMaxSize: 17 })).toThrow(RangeError)
    expect(() => assertValidParameters({ ...DEFAULT_SLASH_PARAMETERS, fragmentMinSize: 1.5, fragmentMaxSize: 3 })).toThrow(RangeError)
  })
})
