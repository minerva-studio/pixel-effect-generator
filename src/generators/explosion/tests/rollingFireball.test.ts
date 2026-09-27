import { describe, expect, it } from 'vitest'
import { MODERN_EXPLOSION_PARAMETERS } from '../model'
import { renderExplosionFrames } from '../renderer'
import { renderRollingFireballBody } from '../rollingFireball'

function areas(frames: ReturnType<typeof renderExplosionFrames>): number[] {
  return frames.map(({ pixels }) => {
    let count = 0
    for (let index = 3; index < pixels.length; index += 4) if (pixels[index] > 0) count += 1
    return count
  })
}

describe('staggered rolling fireballs', () => {
  it('repeats the same layers for one seed and changes their arrangement for another', () => {
    const base = { ...MODERN_EXPLOSION_PARAMETERS, frameCount: 24 }
    const first = renderExplosionFrames(base)[11].pixels
    expect(renderExplosionFrames(base)[11].pixels).toEqual(first)
    expect(renderExplosionFrames({ ...base, seed: base.seed + 1 })[11].pixels).not.toEqual(first)
  })

  it('delays visible growth when the burst interval increases', () => {
    const base = {
      ...MODERN_EXPLOSION_PARAMETERS,
      frameCount: 24,
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }
    const together = areas(renderExplosionFrames({ ...base, body: { ...base.body, burstStagger: 0 } }))
    const staggered = areas(renderExplosionFrames({ ...base, body: { ...base.body, burstStagger: 1 } }))
    expect(together[3]).toBeGreaterThan(staggered[3] * 1.4)
    expect(staggered[10]).toBeGreaterThan(staggered[3])
  })

  it('changes the middle frame when churn turns the fireball surfaces', () => {
    const base = {
      ...MODERN_EXPLOSION_PARAMETERS,
      frameCount: 24,
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }
    const still = renderExplosionFrames({ ...base, body: { ...base.body, churnAmount: 0 } })[11]
    const rolling = renderExplosionFrames({ ...base, body: { ...base.body, churnAmount: 1 } })[11]
    expect(rolling.pixels).not.toEqual(still.pixels)
  })

  it('places the first ball hotspot away from its geometric center', () => {
    const parameters = { ...MODERN_EXPLOSION_PARAMETERS, body: { ...MODERN_EXPLOSION_PARAMETERS.body, burstStagger: 1 } }
    const pixels = new Uint8ClampedArray(128 * 128 * 4)
    renderRollingFireballBody(pixels, 128, 128, parameters, 0.09)
    const white = parameters.palette[0]
    let count = 0
    let sumX = 0
    let sumY = 0
    for (let y = 0; y < 128; y += 1) for (let x = 0; x < 128; x += 1) {
      const offset = (y * 128 + x) * 4
      if (pixels[offset] !== white.r || pixels[offset + 1] !== white.g || pixels[offset + 2] !== white.b || pixels[offset + 3] === 0) continue
      count += 1
      sumX += x + 0.5
      sumY += y + 0.5
    }
    expect(count).toBeGreaterThan(0)
    expect(Math.hypot(sumX / count - 64, sumY / count - 64)).toBeGreaterThan(1.5)
  })

  it('keeps molten hot pixels alive longer without changing the silhouette', () => {
    const base = {
      ...MODERN_EXPLOSION_PARAMETERS,
      seed: 20260810,
      frameCount: 24,
      core: { ...MODERN_EXPLOSION_PARAMETERS.core, enabled: false },
      fragments: { ...MODERN_EXPLOSION_PARAMETERS.fragments, enabled: false },
    }
    const hard = renderExplosionFrames(base)[17]
    const molten = renderExplosionFrames({ ...base, volume: { enabled: true, profile: 'moltenCore' } })[17]
    expect(areas([hard])).toEqual(areas([molten]))
    const warm = (pixels: Uint8ClampedArray) => {
      let count = 0
      for (let offset = 0; offset < pixels.length; offset += 4) if (pixels[offset + 3] > 0 && pixels[offset] > 200) count += 1
      return count
    }
    expect(warm(molten.pixels)).toBeGreaterThan(warm(hard.pixels))
  })
})
