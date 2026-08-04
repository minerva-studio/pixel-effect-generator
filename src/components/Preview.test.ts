import { describe, expect, it } from 'vitest'
import { nextFrameIndex } from './Preview'

describe('nextFrameIndex', () => {
  it('advances within the current frame count', () => {
    expect(nextFrameIndex(2, 8)).toBe(3)
  })

  it('wraps the final frame back to the first frame', () => {
    expect(nextFrameIndex(7, 8)).toBe(0)
  })

  it('uses the latest frame count after the animation length changes', () => {
    expect(nextFrameIndex(7, 5)).toBe(3)
  })

  it('rejects an invalid frame count', () => {
    expect(() => nextFrameIndex(0, 0)).toThrow(RangeError)
  })
})
