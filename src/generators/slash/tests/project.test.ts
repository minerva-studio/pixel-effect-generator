import { describe, expect, it } from 'vitest'
import { DEFAULT_SLASH_PARAMETERS, MAX_FRAGMENT_SIZE, MAX_SWEEP_DEGREES } from '../model'
import { parseSlashParameters, serializeSlashParameters, slashProjectCodec } from '../project'
import { renderSlashFrames } from '../renderer'
import type { JsonValue } from '../../../shared/project/types'

const sampleParameters = () => ({
  ...DEFAULT_SLASH_PARAMETERS,
  canvasWidth: 256,
  canvasHeight: 128,
  radius: 128,
  fragmentMinSize: 4,
  fragmentMaxSize: 16,
})

describe('serializeSlashParameters', () => {
  it('returns plain JSON data without shared palette references', () => {
    const parameters = sampleParameters()
    const json = serializeSlashParameters(parameters) as { palette: JsonValue[] }
    expect(json).toEqual(JSON.parse(JSON.stringify(json)))
    expect(json.palette).not.toBe(parameters.palette)
    expect(json).toEqual(JSON.parse(JSON.stringify(serializeSlashParameters(parameters))))
  })

  it('serializes every v1 field in stable order', () => {
    const json = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as Record<string, unknown>
    expect(Object.keys(json)).toEqual([
      'palette',
      'canvasWidth',
      'canvasHeight',
      'radius',
      'thickness',
      'tipLength',
      'startAngleDegrees',
      'sweepDegrees',
      'rotationDegrees',
      'tiltDegrees',
      'frameCount',
      'direction',
      'sweepSpeed',
      'trailLength',
      'dissolveLength',
      'edgeBreakup',
      'dissolveMode',
      'edgeBreakupMode',
      'fragmentMode',
      'fragmentAmount',
      'seed',
      'edgeDepth',
      'fragmentMinSize',
      'fragmentMaxSize',
      'fragmentTangentSpeed',
      'fragmentOutwardSpeed',
      'fragmentLifetime',
    ])
  })
})

describe('parseSlashParameters', () => {
  it('round-trips default and extreme parameters', () => {
    const defaultJson = serializeSlashParameters(DEFAULT_SLASH_PARAMETERS)
    expect(parseSlashParameters(defaultJson)).toEqual(DEFAULT_SLASH_PARAMETERS)

    const extreme = {
      ...DEFAULT_SLASH_PARAMETERS,
      canvasWidth: 512,
      canvasHeight: 512,
      radius: 256,
      thickness: 256,
      sweepDegrees: MAX_SWEEP_DEGREES,
      frameCount: 24,
      seed: 0xffffffff,
      fragmentMinSize: MAX_FRAGMENT_SIZE,
      fragmentMaxSize: MAX_FRAGMENT_SIZE,
    }
    expect(parseSlashParameters(serializeSlashParameters(extreme))).toEqual(extreme)
  })

  it('defaults missing palette alpha to 255 and round-trips custom alpha', () => {
    const json = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as { palette: { readonly r: number; readonly g: number; readonly b: number }[] } & Record<string, unknown>
    const legacy = { ...json, palette: json.palette.map(({ r, g, b }) => ({ r, g, b })) }
    expect(parseSlashParameters(legacy as JsonValue).palette.every((color) => color.a === 255)).toBe(true)

    const custom = {
      ...DEFAULT_SLASH_PARAMETERS,
      palette: [
        { r: 10, g: 20, b: 30, a: 40 },
        { r: 50, g: 60, b: 70, a: 80 },
        { r: 90, g: 100, b: 110, a: 120 },
      ],
    }
    expect(parseSlashParameters(serializeSlashParameters(custom))).toEqual(custom)
  })

  it('builds a fresh palette array that does not alias the input', () => {
    const json = serializeSlashParameters(sampleParameters()) as { palette: unknown }
    const parsed = parseSlashParameters(json)
    expect(parsed.palette).not.toBe((json as { palette: unknown }).palette)
    expect(parsed.palette).toEqual(DEFAULT_SLASH_PARAMETERS.palette)
  })

  it('fails when every required field is missing while defaulting a legacy missing tip length', () => {
    const json = serializeSlashParameters(sampleParameters()) as Record<string, unknown>
    for (const key of Object.keys(json)) {
      const { [key]: _removed, ...rest } = json
      if (key === 'tipLength') {
        expect(parseSlashParameters(rest).tipLength).toBe(0)
        continue
      }
      expect(() => parseSlashParameters(rest), `missing ${key}`).toThrow(RangeError)
    }
  })

  it('rejects NaN, Infinity, and float values for integer fields', () => {
    const base = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as Record<string, unknown>
    expect(() => parseSlashParameters({ ...base, frameCount: NaN })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, canvasWidth: Infinity })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, radius: 44.5 })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, seed: 1.5 })).toThrow(RangeError)
  })

  it('rejects invalid enums and out-of-range dynamic values', () => {
    const base = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as Record<string, unknown>
    expect(() => parseSlashParameters({ ...base, direction: 'sideways' })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, dissolveMode: 'glitter' })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, edgeBreakupMode: 'none' })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, fragmentMode: 'plasma' })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, tipLength: -0.01 })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, tipLength: 1.01 })).toThrow(RangeError)
  })

  it('enforces the long-edge radius cap and thickness bounds', () => {
    const base = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as Record<string, unknown>
    expect(() => parseSlashParameters({ ...base, radius: 129 })).toThrow(RangeError)
    expect(parseSlashParameters({ ...base, radius: 128 }).radius).toBe(128)
    expect(() => parseSlashParameters({ ...base, thickness: 129 })).toThrow(RangeError)
    expect(parseSlashParameters({ ...base, radius: 64, thickness: 64 }).thickness).toBe(64)
  })

  it('enforces fragment size ordering, speed limits, and color ranges', () => {
    const base = JSON.parse(JSON.stringify(serializeSlashParameters(sampleParameters()))) as Record<string, unknown>
    expect(() => parseSlashParameters({ ...base, fragmentMinSize: 8, fragmentMaxSize: 4 })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, fragmentTangentSpeed: 65 })).toThrow(RangeError)
    expect(() => parseSlashParameters({ ...base, fragmentOutwardSpeed: 49 })).toThrow(RangeError)
    const badPalette = JSON.parse(JSON.stringify(base)) as Record<string, unknown>
    badPalette.palette = [{ r: 300, g: 0, b: 0 }]
    expect(() => parseSlashParameters(badPalette)).toThrow(RangeError)
  })

  it('ignores unknown extra fields', () => {
    const json = serializeSlashParameters(sampleParameters()) as Record<string, unknown>
    expect(() => parseSlashParameters({ ...json, futureSetting: true })).not.toThrow()
  })

  it('exposes the stable slash v1 codec identity', () => {
    expect(slashProjectCodec.generatorId).toBe('slash')
    expect(slashProjectCodec.version).toBe(1)
    expect(slashProjectCodec.parse(slashProjectCodec.serialize(DEFAULT_SLASH_PARAMETERS))).toEqual(DEFAULT_SLASH_PARAMETERS)
  })

  it('round-trips through JSON with pixel-identical rendered frames', () => {
    const original = {
      ...DEFAULT_SLASH_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      radius: 128,
      frameCount: 12,
      seed: 424242,
      tipLength: 0.75,
      fragmentMinSize: 3,
      fragmentMaxSize: 16,
    }
    const restored = parseSlashParameters(serializeSlashParameters(original))
    const originalFrames = renderSlashFrames(original)
    const restoredFrames = renderSlashFrames(restored)
    expect(restoredFrames.length).toBe(originalFrames.length)
    for (let index = 0; index < originalFrames.length; index += 1) {
      expect(Array.from(restoredFrames[index].pixels)).toEqual(Array.from(originalFrames[index].pixels))
    }
  })
})
