import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../shared/project/types'
import { builtinPalette } from '../../../shared/palette/library'
import { LEGACY_EXPLOSION_PARAMETERS, MODERN_EXPLOSION_PARAMETERS } from '../model'
import { explosionProjectCodec, parseExplosionParameters, serializeExplosionParameters } from '../project'
import { renderExplosionFrames } from '../renderer'

describe('explosion project codec', () => {
  it('restores colors embedded in an older project instead of substituting the new default', () => {
    const oldProject = serializeExplosionParameters({ ...LEGACY_EXPLOSION_PARAMETERS, palette: builtinPalette('retroBurst') })
    const restored = parseExplosionParameters(oldProject)
    expect(restored.palette).toEqual(builtinPalette('retroBurst'))
    expect(restored.body).toEqual(LEGACY_EXPLOSION_PARAMETERS.body)
  })

  it('serializes detached plain JSON and round-trips each surface shape', () => {
    const json = serializeExplosionParameters(LEGACY_EXPLOSION_PARAMETERS) as { palette: JsonValue[] }
    expect(json).toEqual(JSON.parse(JSON.stringify(json)))
    expect(json.palette).not.toBe(LEGACY_EXPLOSION_PARAMETERS.palette)
    expect(parseExplosionParameters(json)).toEqual(LEGACY_EXPLOSION_PARAMETERS)
    expect(parseExplosionParameters(serializeExplosionParameters(MODERN_EXPLOSION_PARAMETERS))).toEqual(MODERN_EXPLOSION_PARAMETERS)
  })

  it('rejects missing nested fields and invalid values', () => {
    const json = serializeExplosionParameters(LEGACY_EXPLOSION_PARAMETERS) as Record<string, unknown>
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
    expect(explosionProjectCodec.parse(explosionProjectCodec.serialize(LEGACY_EXPLOSION_PARAMETERS))).toEqual(LEGACY_EXPLOSION_PARAMETERS)
  })

  it('round-trips with pixel-identical rendered frames', () => {
    const original = { ...MODERN_EXPLOSION_PARAMETERS, seed: 424242, frameCount: 8 }
    const parsed = parseExplosionParameters(serializeExplosionParameters(original))
    expect(renderExplosionFrames(parsed).map(({ pixels }) => Array.from(pixels))).toEqual(
      renderExplosionFrames(original).map(({ pixels }) => Array.from(pixels)),
    )
  })
})
