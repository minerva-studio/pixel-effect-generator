import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../../shared/project/types'
import { DEFAULT_PROJECTILE_PARAMETERS } from '../model'
import {
  parseProjectileParameters,
  projectileProjectCodec,
  serializeProjectileParameters,
} from '../project'
import { renderProjectileFrames } from '../renderer'

describe('projectile project codec', () => {
  it('serializes plain JSON data without shared palette references', () => {
    const json = serializeProjectileParameters(DEFAULT_PROJECTILE_PARAMETERS) as { bodyPalette: JsonValue[] }
    expect(json).toEqual(JSON.parse(JSON.stringify(json)))
    expect(json.bodyPalette).not.toBe(DEFAULT_PROJECTILE_PARAMETERS.bodyPalette)
  })

  it('round-trips defaults and custom palettes through JSON', () => {
    const custom = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      kind: 'arrow' as const,
      arrowMaterial: 'energy' as const,
      trailMode: 'energy' as const,
      bodyPalette: [
        { r: 10, g: 20, b: 30, a: 40 },
        { r: 50, g: 60, b: 70, a: 80 },
      ],
      energyPalette: [
        { r: 90, g: 100, b: 110, a: 120 },
        { r: 130, g: 140, b: 150, a: 160 },
        { r: 170, g: 180, b: 190, a: 200 },
      ],
    }
    expect(parseProjectileParameters(serializeProjectileParameters(custom))).toEqual(custom)
    expect(parseProjectileParameters(serializeProjectileParameters(DEFAULT_PROJECTILE_PARAMETERS))).toEqual(DEFAULT_PROJECTILE_PARAMETERS)
  })

  it('defaults missing palette alpha to 255', () => {
    const json = JSON.parse(JSON.stringify(serializeProjectileParameters(DEFAULT_PROJECTILE_PARAMETERS))) as {
      bodyPalette: { readonly r: number; readonly g: number; readonly b: number }[]
    } & Record<string, unknown>
    const legacy = { ...json, bodyPalette: json.bodyPalette.map(({ r, g, b }) => ({ r, g, b })) }
    const parsed = parseProjectileParameters(legacy)
    expect(parsed.bodyPalette.every((color) => color.a === 255)).toBe(true)
  })

  it('fails when every required field is missing or invalid', () => {
    const json = serializeProjectileParameters(DEFAULT_PROJECTILE_PARAMETERS) as Record<string, unknown>
    for (const key of Object.keys(json)) {
      const { [key]: _removed, ...rest } = json
      expect(() => parseProjectileParameters(rest), `missing ${key}`).toThrow(RangeError)
    }
    expect(() => parseProjectileParameters({ ...json, kind: 'comet' })).toThrow(RangeError)
    expect(() => parseProjectileParameters({ ...json, radius: 65 })).toThrow(RangeError)
    expect(() => parseProjectileParameters({ ...json, bodyLength: 125 })).toThrow(RangeError)
    expect(() => parseProjectileParameters({ ...json, trailMode: 'glow' })).toThrow(RangeError)
    expect(() => parseProjectileParameters(null)).toThrow(RangeError)
  })

  it('exposes the stable projectile v1 codec identity', () => {
    expect(projectileProjectCodec.generatorId).toBe('projectile')
    expect(projectileProjectCodec.version).toBe(1)
    expect(projectileProjectCodec.parse(projectileProjectCodec.serialize(DEFAULT_PROJECTILE_PARAMETERS))).toEqual(DEFAULT_PROJECTILE_PARAMETERS)
  })

  it('round-trips through JSON with pixel-identical rendered frames', () => {
    const original = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      canvasWidth: 96,
      canvasHeight: 64,
      frameCount: 8,
      seed: 424242,
      trailMode: 'energy' as const,
    }
    const parsed = parseProjectileParameters(serializeProjectileParameters(original))
    expect(renderProjectileFrames(parsed).map(({ pixels }) => Array.from(pixels))).toEqual(
      renderProjectileFrames(original).map(({ pixels }) => Array.from(pixels)),
    )
  })
})
