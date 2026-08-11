import { describe, expect, it } from 'vitest'
import { DEFAULT_PROJECTILE_PARAMETERS } from '../model'
import { renderProjectileFrame, renderProjectileFrames } from '../renderer'
import {
  PROJECTILE_BUILTIN_PRESETS,
  applyProjectilePreset,
  captureProjectilePreset,
  clampProjectilePresetParameters,
  parseProjectilePresetPayload,
  projectilePresetCapability,
  validateProjectilePreset,
} from '../presets'

describe('projectile built-in presets', () => {
  it('exposes six unique valid presets', () => {
    expect(PROJECTILE_BUILTIN_PRESETS.map(({ id }) => id)).toEqual(['fireball', 'blastBolt', 'enchantedArrow', 'energyArrow', 'crystalSpear', 'crystalCore'])
    for (const preset of PROJECTILE_BUILTIN_PRESETS) {
      expect(validateProjectilePreset(preset.payload).ok).toBe(true)
      expect(() => renderProjectileFrames(applyProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS, preset.payload))).not.toThrow()
    }
    expect((PROJECTILE_BUILTIN_PRESETS[0].payload as Record<string, unknown>).kind).toBe('fireball')
    expect((PROJECTILE_BUILTIN_PRESETS[1].payload as Record<string, unknown>)).toMatchObject({ kind: 'fireball', trailMode: 'fire', sparkCount: 22 })
    expect((PROJECTILE_BUILTIN_PRESETS[2].payload as Record<string, unknown>).arrowMaterial).toBe('solid')
    expect((PROJECTILE_BUILTIN_PRESETS[3].payload as Record<string, unknown>).arrowMaterial).toBe('energy')
    expect((PROJECTILE_BUILTIN_PRESETS[3].payload as Record<string, unknown>)).toMatchObject({ energyCoreLength: 0.64, energyShellWidth: 0.32 })
  })

  it('preserves canvas size and frame count when applying presets', () => {
    const applied = applyProjectilePreset(
      { ...DEFAULT_PROJECTILE_PARAMETERS, canvasWidth: 128, canvasHeight: 64, frameCount: 16 },
      PROJECTILE_BUILTIN_PRESETS[2].payload,
    )
    expect(applied).toMatchObject({ canvasWidth: 128, canvasHeight: 64, frameCount: 16 })
  })

  it('keeps Blast Bolt a seamless fireball preset without extending the public model', () => {
    const blastBolt = applyProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS, PROJECTILE_BUILTIN_PRESETS[1].payload)
    expect(blastBolt).toMatchObject({ kind: 'fireball', trailMode: 'fire', sparkCount: 22, afterimageCount: 1 })
    expect(Array.from(renderProjectileFrame(blastBolt, 1).pixels)).toEqual(Array.from(renderProjectileFrame(blastBolt, 0).pixels))
  })

  it('clamps radius and trail width to a small canvas', () => {
    const clamped = clampProjectilePresetParameters({
      ...DEFAULT_PROJECTILE_PARAMETERS,
      canvasWidth: 16,
      canvasHeight: 16,
      radius: 40,
      trailWidth: 20,
    })
    expect(clamped.radius).toBe(8)
    expect(clamped.trailWidth).toBeLessThanOrEqual(clamped.radius)
    expect(() => renderProjectileFrames(clamped)).not.toThrow()
  })

  it('rejects invalid or incomplete payloads', () => {
    const payload = captureProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS) as Record<string, unknown>
    expect(validateProjectilePreset({ ...payload, kind: 'comet' }).ok).toBe(false)
    expect(validateProjectilePreset({ ...payload, trailMode: 'glow' }).ok).toBe(false)
    const { kind: _kind, ...missingKind } = payload
    expect(validateProjectilePreset(missingKind).ok).toBe(false)
    expect(() => parseProjectilePresetPayload(null)).toThrow(RangeError)
  })

  it('defaults missing palette alpha and round-trips custom alpha', () => {
    const payload = captureProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS) as Record<string, unknown>
    const legacy = {
      ...payload,
      bodyPalette: (payload.bodyPalette as { readonly r: number; readonly g: number; readonly b: number }[]).map(({ r, g, b }) => ({ r, g, b })),
    }
    expect(parseProjectilePresetPayload(legacy).bodyPalette.every((color) => color.a === 255)).toBe(true)

    const custom = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      bodyPalette: DEFAULT_PROJECTILE_PARAMETERS.bodyPalette.map((color, index) => ({ ...color, a: 220 - index * 30 })),
    }
    expect(applyProjectilePreset(custom, captureProjectilePreset(custom)).bodyPalette).toEqual(custom.bodyPalette)
  })

  it('loads legacy custom presets with default body-specific fields', () => {
    const payload = captureProjectilePreset(DEFAULT_PROJECTILE_PARAMETERS) as Record<string, unknown>
    const { crystalForm: _form, crystalOrbitSpeed: _orbitSpeed, ...legacy } = payload
    expect(parseProjectilePresetPayload(legacy)).toMatchObject({ crystalForm: 'spear', crystalOrbitSpeed: 1 })
  })

  it('capture/apply round-trips to pixel-identical frames', () => {
    const source = {
      ...DEFAULT_PROJECTILE_PARAMETERS,
      canvasWidth: 96,
      canvasHeight: 96,
      frameCount: 8,
      seed: 777,
      kind: 'arrow' as const,
      arrowMaterial: 'energy' as const,
      trailMode: 'energy' as const,
    }
    const restored = applyProjectilePreset(source, captureProjectilePreset(source))
    expect(renderProjectileFrames(restored).map(({ pixels }) => Array.from(pixels))).toEqual(
      renderProjectileFrames(source).map(({ pixels }) => Array.from(pixels)),
    )
  })

  it('registers the projectile preset capability', () => {
    expect(projectilePresetCapability.builtIns).toBe(PROJECTILE_BUILTIN_PRESETS)
    expect(typeof projectilePresetCapability.capture).toBe('function')
    expect(typeof projectilePresetCapability.apply).toBe('function')
  })
})
