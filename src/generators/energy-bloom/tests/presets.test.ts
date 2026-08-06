import { describe, expect, it } from 'vitest'
import { payloadsEqual, resolveAppliedPresetBaseline } from '../../../components/PresetBar'
import { en, presetDisplayKeys, translate } from '../../../i18n/messages'
import { DEFAULT_BLOOM_PARAMETERS, type BloomParameters } from '../model'
import { renderBloomFrames } from '../renderer'
import {
  BLOOM_BUILTIN_PRESETS,
  BLOOM_PRESET_FAMILY,
  BLOOM_PRESET_SCHEMA_VERSION,
  applyBloomPreset,
  bloomPresetCapability,
  captureBloomPreset,
  clampBloomPresetParameters,
  parseBloomPresetPayload,
  validateBloomPreset,
} from '../presets'

describe('energy bloom built-in presets', () => {
  it('exposes six unique valid V4 payloads with implosion variants', () => {
    expect(BLOOM_BUILTIN_PRESETS.map(({ id }) => id)).toEqual([
      'softPetals',
      'sharpStarburst',
      'layeredCorolla',
      'softPetalsImplosion',
      'starburstImplosion',
      'corollaImplosion',
    ])
    for (const preset of BLOOM_BUILTIN_PRESETS) {
      const payload = preset.payload as Record<string, unknown>
      expect(payload.schemaVersion).toBe(BLOOM_PRESET_SCHEMA_VERSION)
      expect(payload.family).toBe(BLOOM_PRESET_FAMILY)
      expect(validateBloomPreset(preset.payload).ok).toBe(true)
      expect(() => renderBloomFrames(applyBloomPreset(DEFAULT_BLOOM_PARAMETERS, preset.payload))).not.toThrow()
    }
  }, 20000)

  it('keeps the built-in soft-petals preset tongues disabled', () => {
    const applied = applyBloomPreset(DEFAULT_BLOOM_PARAMETERS, BLOOM_BUILTIN_PRESETS[0].payload)
    expect(applied.body.shape).toBe('softPetals')
    expect(applied.tongues.enabled).toBe(false)
  })

  it('preserves canvas size and frame count when applying presets', () => {
    const applied = applyBloomPreset(
      { ...DEFAULT_BLOOM_PARAMETERS, canvasWidth: 256, canvasHeight: 128, frameCount: 16 },
      BLOOM_BUILTIN_PRESETS[1].payload,
    )
    expect(applied).toMatchObject({ canvasWidth: 256, canvasHeight: 128, frameCount: 16 })
  })

  it('clamps nested pixel fields to a small non-square canvas', () => {
    const parameters: BloomParameters = {
      ...DEFAULT_BLOOM_PARAMETERS,
      canvasWidth: 64,
      canvasHeight: 32,
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, radius: 200 },
      core: { ...DEFAULT_BLOOM_PARAMETERS.core, radius: 100 },
      shockwave: { ...DEFAULT_BLOOM_PARAMETERS.shockwave, thickness: 60 },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, length: 200, width: 60 },
      fragments: { ...DEFAULT_BLOOM_PARAMETERS.fragments, travelDistance: 99, tangentialDrift: 99 },
    }
    const clamped = clampBloomPresetParameters(parameters)
    expect(clamped.body.radius).toBe(16)
    expect(clamped.core.radius).toBe(16)
    expect(clamped.shockwave.thickness).toBe(6)
    expect(clamped.tongues.length).toBe(24)
    expect(clamped.tongues.width).toBe(2)
    expect(() => renderBloomFrames(clamped)).not.toThrow()
  })

  it('rejects invalid or incomplete V4 payloads', () => {
    const payload = captureBloomPreset(DEFAULT_BLOOM_PARAMETERS) as Record<string, unknown>
    expect(validateBloomPreset({ ...payload, body: { ...(payload.body as object), shape: 'daisy' } }).ok).toBe(false)
    expect(validateBloomPreset({ ...payload, family: 'explosion' }).ok).toBe(false)
    const { palette: _palette, ...missingPalette } = payload
    expect(validateBloomPreset(missingPalette).ok).toBe(false)
    expect(() => parseBloomPresetPayload(null)).toThrow(RangeError)
  })

  it('capture/apply round-trips V4 to pixel-identical frames', () => {
    const source: BloomParameters = {
      ...DEFAULT_BLOOM_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      frameCount: 12,
      seed: 424242,
      body: { ...DEFAULT_BLOOM_PARAMETERS.body, shape: 'layeredCorolla', radius: 60, rotation: 35, corollaLayers: 3 },
      surface: { style: 'crystalShards', coverage: 0.9, chunkSize: 12, crackWidth: 2 },
      tongues: { ...DEFAULT_BLOOM_PARAMETERS.tongues, enabled: true, length: 44, width: 6 },
    }
    const restored = applyBloomPreset(source, captureBloomPreset(source))
    expect(renderBloomFrames(restored).map(({ pixels }) => Array.from(pixels))).toEqual(renderBloomFrames(source).map(({ pixels }) => Array.from(pixels)))
  }, 20000)

  it('normalizes legacy lobe-arc V4 payloads and falls back missing fields', () => {
    const payload = captureBloomPreset(DEFAULT_BLOOM_PARAMETERS) as Record<string, unknown>
    const result = validateBloomPreset({
      ...payload,
      shockwave: {
        mode: 'lobeArcs',
        thickness: 2,
        startRadiusScale: 0.72,
        endRadiusScale: 1.38,
        startTime: 0.12,
        duration: 0.5,
      },
    })
    expect(result.ok).toBe(true)
    if (result.ok) {
      const shockwave = (result.payload as Record<string, unknown>).shockwave as Record<string, unknown>
      expect(shockwave.mode).toBe('multiRing')
      expect(shockwave.colorMode).toBe('flat')
      expect(shockwave.ringCount).toBe(3)
      expect(shockwave.ringSpacing).toBe(0.55)
      expect(shockwave.squash).toBe(0)
      expect(shockwave.squashAngle).toBe(0)
    }
  })

  it('exposes translated names and an unmodified applied baseline', () => {
    for (const preset of BLOOM_BUILTIN_PRESETS) {
      const keys = presetDisplayKeys('energyBloom', preset.id)!
      expect(translate(en, keys.name)).not.toBe('')
      expect(translate(en, keys.description)).not.toBe('')
    }
    const soft = BLOOM_BUILTIN_PRESETS[0]
    const { parameters: applied, baseline } = resolveAppliedPresetBaseline(bloomPresetCapability, DEFAULT_BLOOM_PARAMETERS, soft.payload)
    expect(payloadsEqual(captureBloomPreset(applied), baseline)).toBe(true)
  })
})
