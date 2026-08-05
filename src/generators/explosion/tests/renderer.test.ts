import { describe, expect, it } from 'vitest'
import type { PixelFrame } from '../../../shared/pixel/frame'
import { DEFAULT_EXPLOSION_PARAMETERS, resizeExplosionCanvas } from '../model'
import { renderExplosionFrames } from '../renderer'

describe('renderExplosionFrames', () => {
  it('is deterministic, seed-sensitive, and dimensionally stable', () => {
    const first = renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS)
    const repeated = renderExplosionFrames(DEFAULT_EXPLOSION_PARAMETERS)
    const changed = renderExplosionFrames({ ...DEFAULT_EXPLOSION_PARAMETERS, seed: DEFAULT_EXPLOSION_PARAMETERS.seed + 1 })
    expect(bytes(first)).toEqual(bytes(repeated))
    expect(bytes(first)).not.toEqual(bytes(changed))
    expect(first).toHaveLength(DEFAULT_EXPLOSION_PARAMETERS.frameCount)
    expect(first.every((frame) => frame.width === 128 && frame.height === 128)).toBe(true)
  })

  it('keeps the first and last frames transparent with binary alpha', () => {
    for (const mode of ['explosion', 'implosion'] as const) {
      const frames = renderExplosionFrames({ ...DEFAULT_EXPLOSION_PARAMETERS, mode })
      expect(countOpaque(frames[0])).toBe(0)
      expect(countOpaque(frames.at(-1)!)).toBe(0)
      expect(new Set(frames.flatMap((frame) => alphaValues(frame)))).toEqual(new Set([0, 255]))
      expect(frames.some((frame) => countOpaque(frame) > 0)).toBe(true)
    }
  })

  it('uses only transparent pixels and exact palette colors', () => {
    const parameters = DEFAULT_EXPLOSION_PARAMETERS
    const allowed = new Set(['0,0,0,0', ...parameters.palette.map(({ r, g, b }) => `${r},${g},${b},255`)])
    const actual = new Set(renderExplosionFrames(parameters).flatMap((frame) => colors(frame)))
    expect([...actual].every((color) => allowed.has(color))).toBe(true)
  })

  it('supports resized rectangular canvases', () => {
    const resized = resizeExplosionCanvas(DEFAULT_EXPLOSION_PARAMETERS, { width: 64, height: 32 }, true)
    const frames = renderExplosionFrames({ ...resized, frameCount: 6 })
    expect(frames).toHaveLength(6)
    expect(frames.every((frame) => frame.width === 64 && frame.height === 32)).toBe(true)
  })

  it('allows every visual layer to be disabled independently', () => {
    const base = { ...DEFAULT_EXPLOSION_PARAMETERS, frameCount: 7 }
    const scenarios = [
      { ...base, bodyStrength: 0 },
      { ...base, coreRadius: 0 },
      { ...base, shockwaveWidth: 0 },
      { ...base, fragmentAmount: 0 },
    ]
    for (const parameters of scenarios) {
      expect(() => renderExplosionFrames(parameters)).not.toThrow()
      expect(renderExplosionFrames(parameters).some((frame) => countOpaque(frame) > 0)).toBe(true)
    }
    const empty = renderExplosionFrames({ ...base, bodyStrength: 0, coreRadius: 0, shockwaveWidth: 0, fragmentAmount: 0 })
    expect(empty.every((frame) => countOpaque(frame) === 0)).toBe(true)
  })

  it('gives explosion and implosion distinct temporal output', () => {
    const explosion = renderExplosionFrames({ ...DEFAULT_EXPLOSION_PARAMETERS, mode: 'explosion' })
    const implosion = renderExplosionFrames({ ...DEFAULT_EXPLOSION_PARAMETERS, mode: 'implosion' })
    expect(bytes(explosion)).not.toEqual(bytes(implosion))
    expect(maximumRadius(explosion[1])).toBeLessThan(maximumRadius(explosion.at(-2)!))
    expect(maximumRadius(implosion[1])).toBeGreaterThan(maximumRadius(implosion.at(-2)!))
  })
})

/** Copies frame bytes into structural values for deterministic comparisons. */
function bytes(frames: readonly PixelFrame[]): number[][] {
  return frames.map((frame) => Array.from(frame.pixels))
}

/** Collects every alpha sample from one frame. */
function alphaValues(frame: PixelFrame): number[] {
  const values: number[] = []
  for (let index = 3; index < frame.pixels.length; index += 4) values.push(frame.pixels[index])
  return values
}

/** Serializes every RGBA sample for palette membership checks. */
function colors(frame: PixelFrame): string[] {
  const result: string[] = []
  for (let index = 0; index < frame.pixels.length; index += 4) {
    result.push(Array.from(frame.pixels.subarray(index, index + 4)).join(','))
  }
  return result
}

/** Counts opaque pixels in one binary-alpha frame. */
function countOpaque(frame: PixelFrame): number {
  return alphaValues(frame).filter((alpha) => alpha === 255).length
}

/** Measures the furthest opaque sample from the fixed canvas center. */
function maximumRadius(frame: PixelFrame): number {
  const centerX = frame.width / 2
  const centerY = frame.height / 2
  let maximum = 0
  for (let y = 0; y < frame.height; y += 1) {
    for (let x = 0; x < frame.width; x += 1) {
      if (frame.pixels[(y * frame.width + x) * 4 + 3] === 255) {
        maximum = Math.max(maximum, Math.hypot(x + 0.5 - centerX, y + 0.5 - centerY))
      }
    }
  }
  return maximum
}
