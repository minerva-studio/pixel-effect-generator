import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../shared/project/types'
import { DEFAULT_EXPLOSION_PARAMETERS, MODERN_EXPLOSION_PARAMETERS } from '../model'
import { explosionProjectCodec, parseExplosionParameters, serializeExplosionParameters } from '../project'
import { renderExplosionFrames } from '../renderer'

describe('explosion project codec', () => {
  it('serializes detached plain JSON and round-trips each surface shape', () => {
    const json = serializeExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS) as { palette: JsonValue[] }
    expect(json).toEqual(JSON.parse(JSON.stringify(json)))
    expect(json.palette).not.toBe(DEFAULT_EXPLOSION_PARAMETERS.palette)
    expect(parseExplosionParameters(json)).toEqual(DEFAULT_EXPLOSION_PARAMETERS)
    expect(parseExplosionParameters(serializeExplosionParameters(MODERN_EXPLOSION_PARAMETERS))).toEqual(MODERN_EXPLOSION_PARAMETERS)
  })

  it('rejects missing nested fields and invalid values', () => {
    const json = serializeExplosionParameters(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const body = json.body as Record<string, unknown>
    const { smokeCount: _removed, ...bodyWithoutSmokeCount } = body
    expect(() => parseExplosionParameters({ ...json, body: bodyWithoutSmokeCount })).toThrow(RangeError)
    expect(() => parseExplosionParameters({ ...json, frameCount: 1 })).toThrow(RangeError)
    expect(() => parseExplosionParameters({ ...json, core: { ...(json.core as object), enabled: 'yes' } })).toThrow(RangeError)
    expect(() => parseExplosionParameters(null)).toThrow(RangeError)
  })

  it('exposes the stable explosion v1 codec identity', () => {
    expect(explosionProjectCodec.generatorId).toBe('explosion')
    expect(explosionProjectCodec.version).toBe(1)
    expect(explosionProjectCodec.parse(explosionProjectCodec.serialize(DEFAULT_EXPLOSION_PARAMETERS))).toEqual(DEFAULT_EXPLOSION_PARAMETERS)
  })

  it('round-trips with pixel-identical rendered frames', () => {
    const original = { ...MODERN_EXPLOSION_PARAMETERS, seed: 424242, frameCount: 8 }
    const parsed = parseExplosionParameters(serializeExplosionParameters(original))
    expect(renderExplosionFrames(parsed).map(({ pixels }) => Array.from(pixels))).toEqual(
      renderExplosionFrames(original).map(({ pixels }) => Array.from(pixels)),
    )
  })
})
