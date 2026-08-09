import { describe, expect, it } from 'vitest'
import { payloadsEqual, resolveAppliedPresetBaseline } from '../../../components/PresetBar'
import { en, presetDisplayKeys, translate } from '../../../i18n/messages'
import type { JsonValue } from '../../../shared/project/types'
import { DEFAULT_EXPLOSION_PARAMETERS, MODERN_EXPLOSION_PARAMETERS, type ExplosionParameters } from '../model'
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
  it('exposes seven unique valid V7 payloads', () => {
    expect(EXPLOSION_BUILTIN_PRESETS.map(({ id }) => id)).toEqual(['rollingFireball', 'moltenCoreFireball', 'smokeBurst', 'particleSmokeBurst', 'pressureBurst', 'turbulentFireball', 'retroBurst'])
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const payload = preset.payload as Record<string, unknown>
      expect(payload.schemaVersion).toBe(EXPLOSION_PRESET_SCHEMA_VERSION)
      expect(payload.family).toBe(EXPLOSION_PRESET_FAMILY)
      expect(validateExplosionPreset(preset.payload).ok).toBe(true)
      expect(() => renderExplosionFrames(applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, preset.payload))).not.toThrow()
    }
    expect((EXPLOSION_BUILTIN_PRESETS[0].payload as Record<string, unknown>).body).toMatchObject({ shape: 'gameFireball' })
    expect((EXPLOSION_BUILTIN_PRESETS[2].payload as Record<string, unknown>).body).toMatchObject({ shape: 'smokeBurst', smokeMotion: 'billowing' })
    expect((EXPLOSION_BUILTIN_PRESETS[3].payload as Record<string, unknown>).body).toMatchObject({ shape: 'smokeBurst', smokeMotion: 'particulate' })
    expect((EXPLOSION_BUILTIN_PRESETS[4].payload as Record<string, unknown>).body).toMatchObject({ shape: 'shockBlast', pressureWidth: 24, pressureCount: 5 })
    expect((EXPLOSION_BUILTIN_PRESETS.at(-1)!.payload as Record<string, unknown>).body).toMatchObject({ shape: 'legacyRadial' })
  })

  it('defaults missing V6 pressure count and writes it on the next V7 capture', () => {
    const payload = captureExplosionPreset(MODERN_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const { pressureCount: _pressureCount, ...legacyBody } = payload.body as Record<string, unknown>
    const parsed = parseExplosionPresetPayload({ ...payload, schemaVersion: 6, body: legacyBody })
    expect(parsed.body.pressureCount).toBe(5)
    expect((captureExplosionPreset({
      ...parsed,
      canvasWidth: 128,
      canvasHeight: 128,
      frameCount: 10,
    }) as Record<string, unknown>).body).toMatchObject({ pressureCount: 5 })
  })

  it('defaults missing V5 smoke fields and writes them on the next V7 capture', () => {
    const payload = captureExplosionPreset(MODERN_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const { smokeCount: _smokeCount, smokeMotion: _smokeMotion, ...legacyBody } = payload.body as Record<string, unknown>
    const parsed = parseExplosionPresetPayload({ ...payload, schemaVersion: 5, body: legacyBody })
    expect(parsed.body.smokeCount).toBe(5)
    expect(parsed.body.smokeMotion).toBe('billowing')
    expect((captureExplosionPreset({
      ...parsed,
      canvasWidth: 128,
      canvasHeight: 128,
      frameCount: 10,
    }) as Record<string, unknown>).body).toMatchObject({ smokeCount: 5, smokeMotion: 'billowing' })
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
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, radius: 200, pressureWidth: 60, pressureCount: 20 },
      core: { ...DEFAULT_EXPLOSION_PARAMETERS.core, radius: 100 },
      shockwave: { ...DEFAULT_EXPLOSION_PARAMETERS.shockwave, thickness: 60 },
      tongues: { ...DEFAULT_EXPLOSION_PARAMETERS.tongues, length: 200, width: 60 },
      fragments: { ...DEFAULT_EXPLOSION_PARAMETERS.fragments, travelDistance: 99, tangentialDrift: 99 },
    }
    const clamped = clampExplosionPresetParameters(parameters)
    expect(clamped.body.radius).toBe(16)
    expect(clamped.body.pressureWidth).toBe(48)
    expect(clamped.body.pressureCount).toBe(12)
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

  it('capture/apply round-trips V7 to pixel-identical frames', () => {
    const source: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      frameCount: 12,
      seed: 424242,
      body: { ...DEFAULT_EXPLOSION_PARAMETERS.body, shape: 'shockBlast', radius: 60, rotation: 35, pressureWidth: 8, pressureSharpness: 0.7 },
      volume: { enabled: true, profile: 'hardShell' },
      surface: { style: 'rollingSoot', coverage: 0.9, sootAmount: 0.4, sootScale: 14 },
      tongues: { ...DEFAULT_EXPLOSION_PARAMETERS.tongues, length: 44, width: 6 },
    }
    const restored = applyExplosionPreset(source, captureExplosionPreset(source))
    expect(renderExplosionFrames(restored).map(({ pixels }) => Array.from(pixels))).toEqual(renderExplosionFrames(source).map(({ pixels }) => Array.from(pixels)))
  })

  it('restores V5 experiment shapes, normalizes their volume, and rejects directional presets', () => {
    const payload = captureExplosionPreset(MODERN_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const turbulent = parseExplosionPresetPayload({
      ...payload,
      schemaVersion: 5,
      body: { ...(payload.body as object), shape: 'turbulentFireball' },
      volume: { enabled: true, profile: 'hardShell' },
    })
    expect(turbulent.body.shape).toBe('turbulentFireball')
    expect(turbulent.volume).toEqual({ enabled: true, profile: 'hardShell' })

    const shock = parseExplosionPresetPayload({
      ...payload,
      schemaVersion: 5,
      body: { ...(payload.body as object), shape: 'shockBlast' },
      volume: { enabled: true, profile: 'smokeFire' },
    })
    expect(shock.body.shape).toBe('shockBlast')
    expect(shock.volume).toEqual({ enabled: true, profile: 'hardShell' })
    expect(() => parseExplosionPresetPayload({
      ...payload,
      schemaVersion: 5,
      body: { ...(payload.body as object), shape: 'directionalBlast' },
    })).toThrow(/Projectile Blast Bolt/)
  })

  it('defaults missing palette alpha and round-trips custom alpha', () => {
    const captured = captureExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const legacy = {
      ...captured,
      palette: (captured.palette as { readonly r: number; readonly g: number; readonly b: number }[]).map(({ r, g, b }) => ({ r, g, b })),
    }
    expect(applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, legacy as JsonValue).palette.every((color) => color.a === 255)).toBe(true)

    const custom = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      palette: DEFAULT_EXPLOSION_PARAMETERS.palette.map((color, index) => ({ ...color, a: 220 - index * 30 })),
    }
    expect(applyExplosionPreset(custom, captureExplosionPreset(custom)).palette).toEqual(custom.palette)
  })

  it('round-trips shockwave fields through capture and apply', () => {
    const source: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      shockwave: {
        mode: 'multiRing',
        colorMode: 'gradient',
        thickness: 2,
        startRadiusScale: 0.78,
        endRadiusScale: 1.32,
        startTime: 0.12,
        duration: 0.46,
        ringCount: 4,
        ringSpacing: 0.8,
        squash: 0.35,
        squashAngle: 120,
      },
    }
    const captured = captureExplosionPreset(source) as Record<string, unknown>
    expect(captured.shockwave).toMatchObject({
      mode: 'multiRing',
      colorMode: 'gradient',
      ringCount: 4,
      ringSpacing: 0.8,
      squash: 0.35,
      squashAngle: 120,
    })
    expect(applyExplosionPreset(source, captured as JsonValue).shockwave).toEqual(source.shockwave)
  })

  it('normalizes legacy lobe-arc V4 payloads and falls back missing fields', () => {
    const payload = captureExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const result = validateExplosionPreset({
      ...payload,
      shockwave: {
        mode: 'lobeArcs',
        thickness: 3,
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

  it('falls back to pixel-noise dissolve for legacy retro-pixel surfaces', () => {
    const payload = captureExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    const result = validateExplosionPreset({ ...payload, surface: { style: 'retroPixel', coverage: 0.9 } })
    expect(result.ok).toBe(true)
    if (result.ok) {
      expect(((result.payload as Record<string, unknown>).surface as Record<string, unknown>).dissolveStyle).toBe('pixelNoise')
      expect(((result.payload as Record<string, unknown>).surface as Record<string, unknown>).dissolveSize).toBe(6)
    }
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
