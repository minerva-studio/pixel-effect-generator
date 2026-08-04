import { describe, expect, it } from 'vitest'
import { generateFragments, integerLinePoints } from '../fragments'
import { DEFAULT_SLASH_PARAMETERS, type SlashParameters } from '../model'

describe('fragment generation', () => {
  it('rasterizes one-to-three-pixel shard lines with integer coordinates', () => {
    expect(integerLinePoints(10, 10, 10, 10)).toEqual([{ x: 10, y: 10 }])
    expect(integerLinePoints(10, 10, 11, 10)).toEqual([{ x: 10, y: 10 }, { x: 11, y: 10 }])
    expect(integerLinePoints(10, 10, 12, 11)).toEqual([
      { x: 10, y: 10 },
      { x: 11, y: 10 },
      { x: 12, y: 11 },
    ])
  })

  it('generates bounded fragments with continuous lifetime descriptors', () => {
    const parameters: SlashParameters = {
      ...DEFAULT_SLASH_PARAMETERS,
      fragmentAmount: 1,
      fragmentSize: 3,
    }
    const fragments = generateFragments(parameters)

    expect(fragments).toHaveLength(24)
    expect(fragments.every((fragment) => fragment.spawnTime >= 0 && fragment.spawnTime <= 0.9)).toBe(true)
    expect(fragments.every((fragment) => fragment.lifetime > 0 && fragment.size >= 1 && fragment.size <= 3)).toBe(true)
    expect(generateFragments(parameters)).toEqual(fragments)
    expect(generateFragments({ ...parameters, seed: parameters.seed + 1 })).not.toEqual(fragments)
  })

  it('keeps shard and spark motion continuous with bounded spawn and lifetime descriptors', () => {
    const parameters: SlashParameters = {
      ...DEFAULT_SLASH_PARAMETERS,
      fragmentAmount: 1,
      fragmentSize: 3,
    }
    for (const fragmentMode of ['directionalShards', 'energySparks'] as const) {
      const fragments = generateFragments({ ...parameters, fragmentMode })
      expect(fragments).toHaveLength(24)
      expect(fragments.every((fragment) => fragment.spawnTime >= 0 && fragment.spawnTime <= 0.9)).toBe(true)
      expect(fragments.every((fragment) => fragment.lifetime > 0 && fragment.size >= 1 && fragment.size <= 3)).toBe(true)
      expect(generateFragments({ ...parameters, fragmentMode })).toEqual(fragments)
      expect(generateFragments({ ...parameters, fragmentMode, seed: parameters.seed + 1 })).not.toEqual(fragments)
    }
  })

  it('keeps modern fragment sizes within the configured inclusive maximum', () => {
    for (const fragmentMode of ['directionalShards', 'energySparks'] as const) {
      for (const fragmentSize of [1, 2, 3]) {
        const fragments = generateFragments({
          ...DEFAULT_SLASH_PARAMETERS,
          fragmentMode,
          fragmentAmount: 1,
          fragmentSize,
        })
        expect(fragments.every((fragment) => fragment.size >= 1 && fragment.size <= fragmentSize)).toBe(true)
        expect(Math.max(...fragments.map((fragment) => fragment.size))).toBe(fragmentSize)
      }
    }
  })
})
