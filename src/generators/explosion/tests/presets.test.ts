import { describe, expect, it } from 'vitest'
import { payloadsEqual, resolveAppliedPresetBaseline } from '../../../components/PresetBar'
import { en, presetDisplayKeys, translate } from '../../../i18n/messages'
import { DEFAULT_EXPLOSION_PARAMETERS, type ExplosionParameters } from '../model'
import { renderExplosionFrames } from '../renderer'
import {
  EXPLOSION_BUILTIN_PRESETS,
  EXPLOSION_PRESET_FAMILY,
  EXPLOSION_PRESET_SCHEMA_VERSION,
  applyExplosionPreset,
  captureExplosionPreset,
  clampExplosionPresetParameters,
  explosionPresetCapability,
  parseExplosionPresetPayload,
  validateExplosionPreset,
} from '../presets'

describe('combustion explosion built-in presets', () => {
  it('exposes three unique valid V4 payloads', () => {
    expect(EXPLOSION_BUILTIN_PRESETS.map(({ id }) => id)).toEqual(['rollingFireball', 'pressureBurst', 'retroBurst'])
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const payload = preset.payload as Record<string, unknown>
      expect(payload.schemaVersion).toBe(EXPLOSION_PRESET_SCHEMA_VERSION)
      expect(payload.family).toBe(EXPLOSION_PRESET_FAMILY)
      expect(validateExplosionPreset(preset.payload).ok).toBe(true)
      expect(() => renderExplosionFrames(applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, preset.payload))).not.toThrow()
    }
    expect((EXPLOSION_BUILTIN_PRESETS[0].payload as Record<string, unknown>).body).toMatchObject({ shape: 'billowingFireball' })
    expect((EXPLOSION_BUILTIN_PRESETS[2].payload as Record<string, unknown>).body).toMatchObject({ shape: 'legacyRadial' })
  })

  it('preserves canvas size and frame count when applying presets', () => {
    const applied = applyExplosionPreset(
      { ...DEFAULT_EXPLOSION_PARAMETERS, canvasWidth: 256, canvasHeight: 128, frameCount: 16 },
      EXPLOSION_BUILTIN_PRESETS[1].payload,
    )
    expect(applied).toMatchObject({ canvasWidth: 256, canvasHeight: 128, frameCount: 16 })
  })

  it('clamps nested pixel fields to a small non-square canvas', () => {
    const parameters: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      canvasWidth: 64,
      canvasHeight: 32,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, radius: 200, pressureWidth: 30 },
      core: { ...DEFAULT_EXPLOSION_PARAMETERS.core, radius: 100 },
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, thickness: 60 },
      tongues: { ...DEFAULT_EXPLOSION_PARAMETERS.tongues, length: 200, width: 60 },
      fragments: { ...DEFAULT_EXPLOSION_PARAMETERS.fragments, travelDistance: 99, tangentialDrift: 99 },
    }
    const clamped = clampExplosionPresetParameters(parameters)
    expect(clamped.body.radius).toBe(16)
    expect(clamped.body.pressureWidth).toBe(24)
    expect(clamped.core.radius).toBe(16)
    expect(clamped.shockwave.thickness).toBe(6)
    expect(clamped.tongues.length).toBe(24)
    expect(clamped.tongues.width).toBe(2)
    expect(() => renderExplosionFrames(clamped)).not.toThrow()
  })

  it('rejects invalid or incomplete V4 payloads', () => {
    const payload = captureExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    expect(validateExplosionPreset({ ...payload, body: { ...(payload.body as object), shape: 'cloud' } }).ok).toBe(false)
    expect(validateExplosionPreset({ ...payload, surface: { ...(payload.surface as object), style: 'smooth' } }).ok).toBe(false)
    expect(validateExplosionPreset({ ...payload, family: 'energyBloom' }).ok).toBe(false)
    const { palette: _palette, ...missingPalette } = payload
    expect(validateExplosionPreset(missingPalette).ok).toBe(false)
    expect(() => parseExplosionPresetPayload(null)).toThrow(RangeError)
  })

  it('capture/apply round-trips V4 to pixel-identical frames', () => {
    const source: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      frameCount: 12,
      seed: 424242,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape: 'pressureBurst', radius: 60, rotation: 35, pressureWidth: 9 },
      surface: { style: 'rollingSoot', coverage: 0.9, sootAmount: 0.4, sootScale: 14 },
      tongues: { ...DEFAULT_EXPLOSION_PARAMETERS.tongues, length: 44, width: 6 },
    }
    const restored = applyExplosionPreset(source, captureExplosionPreset(source))
    expect(renderExplosionFrames(restored).map(({ pixels }) => Array.from(pixels))).toEqual(renderExplosionFrames(source).map(({ pixels }) => Array.from(pixels)))
  })

  it('exposes translated names and an unmodified applied baseline', () => {
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const keys = presetDisplayKeys('explosion', preset.id)!
      expect(translate(en, keys.name)).not.toBe('')
      expect(translate(en, keys.description)).not.toBe('')
    }
    const rolling = EXPLOSION_BUILTIN_PRESETS[0]
    const { parameters: applied, baseline } = resolveAppliedPresetBaseline(explosionPresetCapability, DEFAULT_EXPLOSION_PARAMETERS, rolling.payload)
    expect(payloadsEqual(captureExplosionPreset(applied), baseline)).toBe(true)
  })
})
