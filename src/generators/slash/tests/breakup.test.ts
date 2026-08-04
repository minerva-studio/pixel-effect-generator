import { describe, expect, it } from 'vitest'
import { bayerThreshold, jaggedContourInset, slashCutDepth } from '../breakup'
import { createXorshift32 } from '../../../shared/pixel/rng'

describe('breakup helpers', () => {
  it('produces a stable non-zero xorshift32 sequence even for seed zero', () => {
    const first = createXorshift32(0)
    const second = createXorshift32(0)
    const firstValues = [first(), first(), first(), first()]
    expect(firstValues).toEqual([second(), second(), second(), second()])
    expect(firstValues.every((value) => Number.isInteger(value) && value >= 0)).toBe(true)
    expect(new Set(firstValues).size).toBeGreaterThan(1)
  })

  it('exposes all sixteen Bayer thresholds exactly once', () => {
    const thresholds = Array.from({ length: 16 }, (_, index) => bayerThreshold(index % 4, Math.floor(index / 4)))
    expect(new Set(thresholds).size).toBe(16)
    expect(Math.min(...thresholds)).toBeGreaterThan(0)
    expect(Math.max(...thresholds)).toBeLessThan(1)
  })

  it('keeps modern edge modes within the configured edge depth', () => {
    for (const seed of [1, 1337, 999_999, 0xffffffff]) {
      for (let sample = 0; sample < 2000; sample += 1) {
        const arcDistancePixels = sample / 2
        expect(slashCutDepth(seed, arcDistancePixels, 1, 0.5)).toBeLessThanOrEqual(0.5)
        expect(slashCutDepth(seed, arcDistancePixels, 0.5, 0.3)).toBeLessThanOrEqual(0.3)
        expect(jaggedContourInset(seed, arcDistancePixels, 1, 0.5)).toBeLessThanOrEqual(0.5)
        expect(jaggedContourInset(seed, arcDistancePixels, 0.5, 0.3)).toBeLessThanOrEqual(0.3)
      }
    }
  })

  it('distributes modern edge variation across 180, 360, and 720 degree arcs', () => {
    for (const sweepDegrees of [180, 360, 720]) {
      const arcLength = sweepDegrees * Math.PI / 180 * 44
      const cutCells = new Set<number>()
      const jaggedValues = new Set<number>()
      for (let arcDistance = 0; arcDistance <= arcLength; arcDistance += 0.5) {
        if (slashCutDepth(1337, arcDistance, 1, 0.5) > 0) {
          cutCells.add(Math.floor(arcDistance / 8))
        }
        jaggedValues.add(Math.round(jaggedContourInset(1337, arcDistance, 1, 0.5) * 1000))
      }
      expect(cutCells.size).toBeGreaterThan(1)
      expect(jaggedValues.size).toBeGreaterThan(4)
    }
  })
})
