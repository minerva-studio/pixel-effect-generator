import { describe, expect, it } from 'vitest'
import '../../registry'
import { bloomModule } from '../module'
import { DEFAULT_BLOOM_PARAMETERS, type BloomParameters } from '../model'
import { BLOOM_BUILTIN_PRESETS, applyBloomPreset } from '../presets'
import { bloomShareCodec } from '../share'

describe('energy bloom share codec', () => {
  it.each(BLOOM_BUILTIN_PRESETS.map((preset) => [preset.id, preset] as const))('round-trips the %s preset with canvas fields', (_id, preset) => {
    const parameters: BloomParameters = applyBloomPreset({ ...DEFAULT_BLOOM_PARAMETERS, canvasWidth: 96, canvasHeight: 112, frameCount: 14 }, preset.payload)
    const parsed = bloomShareCodec.parse(JSON.parse(JSON.stringify(bloomShareCodec.serialize(parameters))))
    expect(parsed).toEqual(parameters)
  })

  it('rejects out-of-range canvas and parameters instead of clamping', () => {
    const value = bloomShareCodec.serialize(DEFAULT_BLOOM_PARAMETERS) as Record<string, unknown>
    expect(() => bloomShareCodec.parse({ ...value, canvasWidth: 100000 })).toThrow()
    expect(() => bloomShareCodec.parse({ ...value, frameCount: 1.5 })).toThrow()
    expect(() => bloomShareCodec.parse({ ...value, canvasHeight: undefined })).toThrow()
    expect(() => bloomShareCodec.parse({ ...value, body: { ...(value.body as object), radius: 256 }, canvasWidth: 32, canvasHeight: 32 })).toThrow()
    expect(() => bloomShareCodec.parse('nope')).toThrow()
  })

  it('is share-only and does not enable project files', () => {
    expect(bloomModule.shareCodec).toBe(bloomShareCodec)
    expect(bloomModule.projectCodec).toBeUndefined()
  })
})
