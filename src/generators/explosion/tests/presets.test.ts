import { describe, expect, it } from 'vitest'
import { payloadsEqual, resolveAppliedPresetBaseline } from '../../../components/PresetBar'
import { en, presetDisplayKeys, translate } from '../../../i18n/messages'
import { DEFAULT_EXPLOSION_PARAMETERS, type ExplosionParameters } from '../model'
import { renderExplosionFrames } from '../renderer'
import {
  EXPLOSION_BUILTIN_PRESETS,
  applyExplosionPreset,
  captureExplosionPreset,
  clampExplosionPresetParameters,
  explosionPresetCapability,
  parseExplosionPresetPayload,
  validateExplosionPreset,
} from '../presets'

function frameHash(frames: readonly { readonly pixels: Uint8ClampedArray }[]): string {
  let hash = 2166136261
  for (const frame of frames) {
    for (let index = 0; index < frame.pixels.length; index += 7) {
      hash = Math.imul(hash ^ frame.pixels[index], 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

describe('Explosion built-in presets', () => {
  it('exposes three unique preset ids', () => {
    const ids = EXPLOSION_BUILTIN_PRESETS.map((preset) => preset.id)
    expect(ids).toEqual(['modernBurst', 'modernImplosion', 'retroBurst'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('validates every built-in payload and applies it legally', () => {
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const validated = validateExplosionPreset(preset.payload)
      expect(validated.ok, `${preset.id} validation`).toBe(true)
      const applied = applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, preset.payload)
      expect(applied.canvasWidth).toBe(DEFAULT_EXPLOSION_PARAMETERS.canvasWidth)
      expect(applied.canvasHeight).toBe(DEFAULT_EXPLOSION_PARAMETERS.canvasHeight)
      expect(applied.frameCount).toBe(DEFAULT_EXPLOSION_PARAMETERS.frameCount)
      expect(() => renderExplosionFrames(applied)).not.toThrow()
    }
  })

  it('produces distinguishable frame hashes for the three presets', () => {
    const hashes = EXPLOSION_BUILTIN_PRESETS.map((preset) => {
      const applied = applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, preset.payload)
      return frameHash(renderExplosionFrames(applied))
    })
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('preserves canvas size and frame count when applied to other canvases', () => {
    const applied = applyExplosionPreset(
      { ...DEFAULT_EXPLOSION_PARAMETERS, canvasWidth: 256, canvasHeight: 128, frameCount: 16 },
      EXPLOSION_BUILTIN_PRESETS[1].payload,
    )
    expect(applied.canvasWidth).toBe(256)
    expect(applied.canvasHeight).toBe(128)
    expect(applied.frameCount).toBe(16)
  })

  it('clamps effect fields to the current canvas on small non-square canvases', () => {
    const params: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      canvasWidth: 64,
      canvasHeight: 32,
      radius: 200,
      coreRadius: 100,
      shockwaveWidth: 60,
      fragmentRadialSpeed: 99,
      fragmentTangentialJitter: 99,
      trailLength: 200,
      trailWidth: 60,
    }
    const clamped = clampExplosionPresetParameters(params)
    expect(clamped.radius).toBe(16)
    expect(clamped.coreRadius).toBe(16)
    expect(clamped.shockwaveWidth).toBe(16)
    expect(clamped.trailLength).toBe(24)
    expect(clamped.trailWidth).toBe(3)
    expect(() => renderExplosionFrames(clamped)).not.toThrow()
  })

  it('rejects invalid payloads', () => {
    const payload = captureExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS) as Record<string, unknown>
    expect(validateExplosionPreset({ ...payload, bodyStyle: 'chunky' }).ok).toBe(false)
    expect(validateExplosionPreset({ ...payload, shockwaveStyle: 'wave' }).ok).toBe(false)
    expect(validateExplosionPreset({ ...payload, trailMode: 'sparks' }).ok).toBe(false)
    const { palette: _palette, ...missingPalette } = payload
    expect(validateExplosionPreset(missingPalette).ok).toBe(false)
    expect(() => parseExplosionPresetPayload(null)).toThrow(RangeError)
  })

  it('capture/apply round-trips to pixel-identical frames', () => {
    const source: ExplosionParameters = {
      ...DEFAULT_EXPLOSION_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      radius: 60,
      frameCount: 12,
      seed: 424242,
      bodyStyle: 'pixelNoise',
      shockwaveStyle: 'fullRing',
      trailMode: 'flameStrands',
      trailLength: 44,
      trailWidth: 6,
    }
    const payload = captureExplosionPreset(source)
    const restored = applyExplosionPreset(source, payload)
    const originalFrames = renderExplosionFrames(source)
    const restoredFrames = renderExplosionFrames(restored)
    expect(originalFrames.length).toBe(restoredFrames.length)
    for (let index = 0; index < originalFrames.length; index += 1) {
      expect(Array.from(restoredFrames[index].pixels)).toEqual(Array.from(originalFrames[index].pixels))
    }
  })

  it('exposes translated preset names and an unmodified state after applying', () => {
    for (const preset of EXPLOSION_BUILTIN_PRESETS) {
      const keys = presetDisplayKeys('explosion', preset.id)
      expect(keys, `${preset.id} display keys`).toBeDefined()
      expect(translate(en, keys!.name)).not.toBe('')
      expect(translate(en, keys!.description)).not.toBe('')
    }
    const modern = EXPLOSION_BUILTIN_PRESETS[0]
    const { parameters: applied, baseline } = resolveAppliedPresetBaseline(
      explosionPresetCapability,
      DEFAULT_EXPLOSION_PARAMETERS,
      modern.payload,
    )
    expect(payloadsEqual(captureExplosionPreset(applied), baseline)).toBe(true)
  })
})
