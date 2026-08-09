import { describe, expect, it } from 'vitest'
import {
  DEFAULT_SLASH_PARAMETERS,
  frameLimits,
  type SlashParameters,
} from '../model'
import { renderSlashFrames } from '../renderer'
import {
  SLASH_BUILTIN_PRESETS,
  applySlashPreset,
  captureSlashPreset,
  clampSlashPresetParameters,
  parseSlashPresetPayload,
  validateSlashPreset,
} from '../presets'
import type { JsonValue } from '../../../shared/project/types'

function frameHash(frames: readonly { readonly pixels: Uint8ClampedArray }[]): string {
  let hash = 2166136261
  for (const frame of frames) {
    for (let index = 0; index < frame.pixels.length; index += 7) {
      hash = Math.imul(hash ^ frame.pixels[index], 16777619)
    }
  }
  return (hash >>> 0).toString(16)
}

describe('Slash built-in presets', () => {
  it('exposes six unique preset ids with Pointed Strike after Clean Arc', () => {
    const ids = SLASH_BUILTIN_PRESETS.map((preset) => preset.id)
    expect(ids).toEqual(['cleanArc', 'pointedStrike', 'heavyCleave', 'energySweep', 'shatteredEdge', 'fullCircle'])
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('validates every built-in payload and applies it legally', () => {
    for (const preset of SLASH_BUILTIN_PRESETS) {
      const validated = validateSlashPreset(preset.payload)
      expect(validated.ok, `${preset.id} validation`).toBe(true)
      const applied = applySlashPreset(DEFAULT_SLASH_PARAMETERS, preset.payload)
      expect(applied.canvasWidth).toBe(DEFAULT_SLASH_PARAMETERS.canvasWidth)
      expect(applied.canvasHeight).toBe(DEFAULT_SLASH_PARAMETERS.canvasHeight)
      expect(applied.frameCount).toBe(DEFAULT_SLASH_PARAMETERS.frameCount)
      expect(() => renderSlashFrames(applied)).not.toThrow()
    }
  })

  it('produces distinguishable frame hashes for the six presets', () => {
    const hashes = SLASH_BUILTIN_PRESETS.map((preset) => {
      const applied = applySlashPreset(DEFAULT_SLASH_PARAMETERS, preset.payload)
      return frameHash(renderSlashFrames(applied))
    })
    expect(new Set(hashes).size).toBe(hashes.length)
  })

  it('preserves canvas size and frame count when applied to other canvases', () => {
    const applied = applySlashPreset(
      { ...DEFAULT_SLASH_PARAMETERS, canvasWidth: 256, canvasHeight: 128, frameCount: 16 },
      SLASH_BUILTIN_PRESETS[1].payload,
    )
    expect(applied.canvasWidth).toBe(256)
    expect(applied.canvasHeight).toBe(128)
    expect(applied.frameCount).toBe(16)
  })

  it('clamps radius, thickness, and speeds to the current canvas on non-square canvases', () => {
    const params: SlashParameters = {
      ...DEFAULT_SLASH_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      radius: 200,
      thickness: 190,
      fragmentTangentSpeed: 99,
      fragmentOutwardSpeed: 99,
    }
    const clamped = clampSlashPresetParameters(params)
    const limits = frameLimits({ width: 256, height: 128 })
    expect(clamped.radius).toBe(limits.maxRadius)
    expect(clamped.thickness).toBe(clamped.radius)
    expect(clamped.fragmentTangentSpeed).toBe(limits.maxFragmentTangentSpeed)
    expect(clamped.fragmentOutwardSpeed).toBe(limits.maxFragmentOutwardSpeed)
  })

  it('rejects invalid payloads', () => {
    const payload = captureSlashPreset(DEFAULT_SLASH_PARAMETERS) as Record<string, unknown>
    expect(validateSlashPreset({ ...payload, direction: 'sideways' }).ok).toBe(false)
    const { palette: _palette, ...missingPalette } = payload
    expect(validateSlashPreset(missingPalette).ok).toBe(false)
    expect(() => parseSlashPresetPayload(null)).toThrow(RangeError)
  })

  it('defaults legacy custom presets without tip length to a blunt leading edge', () => {
    const payload = captureSlashPreset(DEFAULT_SLASH_PARAMETERS) as Record<string, unknown>
    const { tipLength: _tipLength, ...legacy } = payload

    expect(parseSlashPresetPayload(legacy).tipLength).toBe(0)
    expect(applySlashPreset({ ...DEFAULT_SLASH_PARAMETERS, tipLength: 0.8 }, legacy as JsonValue).tipLength).toBe(0)
  })

  it('capture/apply round-trips to pixel-identical frames', () => {
    const source = {
      ...DEFAULT_SLASH_PARAMETERS,
      canvasWidth: 256,
      canvasHeight: 128,
      radius: 128,
      frameCount: 12,
      seed: 424242,
      fragmentMinSize: 3,
      fragmentMaxSize: 16,
    }
    const payload = captureSlashPreset(source)
    const restored = applySlashPreset(source, payload)
    const originalFrames = renderSlashFrames(source)
    const restoredFrames = renderSlashFrames(restored)
    expect(originalFrames.length).toBe(restoredFrames.length)
    for (let index = 0; index < originalFrames.length; index += 1) {
      expect(Array.from(restoredFrames[index].pixels)).toEqual(Array.from(originalFrames[index].pixels))
    }
  })
})
