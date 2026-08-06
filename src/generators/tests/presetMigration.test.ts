import { describe, expect, it } from 'vitest'
import { presetStorageKey, type PresetStorage } from '../../shared/preset/storage'
import { DEFAULT_BLOOM_PARAMETERS } from '../energy-bloom/model'
import { applyBloomPreset } from '../energy-bloom/presets'
import { renderBloomFrames } from '../energy-bloom/renderer'
import { DEFAULT_EXPLOSION_PARAMETERS } from '../explosion/model'
import { applyExplosionPreset } from '../explosion/presets'
import { renderExplosionFrames } from '../explosion/renderer'
import { migrateExplosionFamilyPresets, migrateLegacyPreset } from '../presetMigration'

describe('explosion preset family migration', () => {
  it('keeps legacyRadial in the explosion family and converts lobedFireball to softPetals', () => {
    const explosion = migrateLegacyPreset(v3Payload('legacyRadial'))
    expect(explosion.target).toBe('explosion')
    const explosionPayload = explosion.payload as Record<string, unknown>
    expect(explosionPayload.body).toMatchObject({ shape: 'legacyRadial', radius: 42 })
    expect(explosionPayload.surface).toMatchObject({ style: 'retroPixel', coverage: 0.9 })
    expect(explosionPayload.motion).toMatchObject({ mode: 'explosion', dissolveStart: 0.58 })
    expect(explosionPayload.tongues).toMatchObject({ enabled: true, count: 4 })

    const bloom = migrateLegacyPreset(v3Payload('lobedFireball'))
    expect(bloom.target).toBe('energyBloom')
    const bloomPayload = bloom.payload as Record<string, unknown>
    expect(bloomPayload.body).toMatchObject({ shape: 'softPetals', petalCount: 7, petalStretch: 0.58, rotation: 0 })
    expect(bloomPayload.surface).toMatchObject({ style: 'celBands' })
    expect(bloomPayload.tongues).toMatchObject({ enabled: true, count: 4, length: 22, width: 3, curvature: 0.3 })
    expect(bloomPayload.shockwave).toMatchObject({
      mode: 'multiRing',
      colorMode: 'flat',
      thickness: 3,
      ringCount: 3,
      ringSpacing: 0.55,
      squash: 0,
      squashAngle: 0,
    })
    expect(bloomPayload.fragments).toMatchObject({ enabled: true, count: 30, travelDistance: 30, tangentialDrift: 9 })
    expect(bloomPayload.seed).toBe(20260805)
    expect(bloomPayload.palette).toHaveLength(4)

    expect(explosionPayload.shockwave).toMatchObject({
      mode: 'ring',
      colorMode: 'flat',
      ringCount: 3,
      ringSpacing: 0.55,
      squash: 0,
      squashAngle: 0,
    })
    expect(explosionPayload.surface).toMatchObject({ style: 'retroPixel', dissolveStyle: 'pixelNoise', dissolveSize: 6, dissolveSpeed: 1 })
  })

  it('migrates flat V2 lobed payloads into the bloom family', () => {
    const bloom = migrateLegacyPreset(flatV2Payload())
    expect(bloom.target).toBe('energyBloom')
    const payload = bloom.payload as Record<string, unknown>
    expect(payload.body).toMatchObject({ shape: 'softPetals', petalCount: 7, petalStretch: 0.58 })
    expect(payload.tongues).toMatchObject({ enabled: true, count: 4 })
  })

  it('writes both family libraries and replaces the old library after success', () => {
    const storage = new FakeStorage()
    storage.setItem(presetStorageKey('explosion'), JSON.stringify(library('explosion', [
      storedPreset('retro-id', 'Retro custom', v3Payload('legacyRadial')),
      storedPreset('lobed-id', 'Lobed custom', v3Payload('lobedFireball')),
    ])))
    const result = migrateExplosionFamilyPresets(storage)
    expect(result).toEqual({ migrated: true, explosion: 1, energyBloom: 1 })

    const explosionLibrary = JSON.parse(storage.getItem(presetStorageKey('explosion'))!)
    expect(explosionLibrary.presets).toHaveLength(1)
    expect(explosionLibrary.presets[0].id).toBe('retro-id')
    expect(explosionLibrary.presets[0].payload.body.shape).toBe('legacyRadial')

    const bloomLibrary = JSON.parse(storage.getItem(presetStorageKey('energyBloom'))!)
    expect(bloomLibrary.presets).toHaveLength(1)
    expect(bloomLibrary.presets[0].id).toBe('lobed-id')
    expect(bloomLibrary.presets[0].payload.body.shape).toBe('softPetals')

    expect(() => renderExplosionFrames(applyExplosionPreset(DEFAULT_EXPLOSION_PARAMETERS, explosionLibrary.presets[0].payload))).not.toThrow()
    expect(() => renderBloomFrames(applyBloomPreset(DEFAULT_BLOOM_PARAMETERS, bloomLibrary.presets[0].payload))).not.toThrow()
  })

  it('is idempotent: a second run finds no old library', () => {
    const storage = new FakeStorage()
    storage.setItem(presetStorageKey('explosion'), JSON.stringify(library('explosion', [
      storedPreset('lobed-id', 'Lobed custom', v3Payload('lobedFireball')),
    ])))
    expect(migrateExplosionFamilyPresets(storage).migrated).toBe(true)
    expect(migrateExplosionFamilyPresets(storage)).toEqual({ migrated: false, reason: 'empty' })
  })

  it('fails without touching old data when one preset cannot be migrated', () => {
    const storage = new FakeStorage()
    const invalid = { ...v3Payload('lobedFireball'), palette: [{ r: 1 }] }
    storage.setItem(presetStorageKey('explosion'), JSON.stringify(library('explosion', [
      storedPreset('bad-id', 'Broken custom', invalid),
    ])))
    const result = migrateExplosionFamilyPresets(storage)
    expect(result).toMatchObject({ migrated: false, reason: 'failed' })
    expect(storage.getItem(presetStorageKey('energyBloom'))).toBeNull()
    const raw = storage.getItem(presetStorageKey('explosion'))!
    expect(JSON.parse(raw).presets).toHaveLength(1)
  })

  it('reports unavailable storage and returns empty without a library', () => {
    expect(migrateExplosionFamilyPresets(null)).toEqual({ migrated: false, reason: 'unavailable' })
    expect(migrateExplosionFamilyPresets(new FakeStorage())).toEqual({ migrated: false, reason: 'empty' })
  })

  it('preserves active canvas dimensions and frame count when applying migrated payloads', () => {
    const migrated = migrateLegacyPreset(v3Payload('lobedFireball')).payload
    const applied = applyBloomPreset(
      { ...DEFAULT_BLOOM_PARAMETERS, canvasWidth: 256, canvasHeight: 128, frameCount: 16 },
      migrated,
    )
    expect(applied).toMatchObject({ canvasWidth: 256, canvasHeight: 128, frameCount: 16 })
  })
})

/** Builds a V3 legacy payload for either shape family. */
function v3Payload(shapeMode: 'lobedFireball' | 'legacyRadial'): Record<string, unknown> {
  return {
    schemaVersion: 3,
    palette: [
      { r: 255, g: 250, b: 224 }, { r: 255, g: 201, b: 72 },
      { r: 242, g: 95, b: 44 }, { r: 105, g: 42, b: 52 },
    ],
    mode: 'explosion',
    seed: 20260805,
    body: { shapeMode, radius: 42, lobeCount: 7, lobeStretch: 0.58, rotation: 0, shapeIrregularity: 0.28, formationDuration: 0.46 },
    surface: shapeMode === 'legacyRadial'
      ? { style: 'pixelNoise', coverage: 0.9, dissolveStart: 0.58 }
      : { style: 'celBands', coverage: 0.9, dissolveStart: 0.58, bandWarp: 0.15, edgeBreakup: 0.3 },
    core: { enabled: true, radius: 16, duration: 0.42 },
    shockwave: shapeMode === 'legacyRadial'
      ? { mode: 'ring', thickness: 3, startRadiusScale: 0, endRadiusScale: 1.18, startTime: 0, duration: 1, arcCount: 3, arcSpan: 30 }
      : { mode: 'lobeArcs', thickness: 3, startRadiusScale: 0.72, endRadiusScale: 1.38, startTime: 0.12, duration: 0.5, arcCount: 3, arcSpan: 30 },
    tongues: { enabled: true, count: 4, length: 22, width: 3, curvature: 0.3, variation: 0.24 },
    fragments: { enabled: true, count: 30, minSize: 1, maxSize: 3, travelDistance: 30, tangentialDrift: 9, lifetime: 0.68 },
  }
}

/** Builds a flat V2 lobed payload used by the pre-V3 schema. */
function flatV2Payload(): Record<string, unknown> {
  return {
    palette: v3Payload('lobedFireball').palette,
    mode: 'explosion',
    radius: 42,
    bodyStrength: 0.9,
    irregularity: 0.26,
    coreRadius: 16,
    shockwaveWidth: 3,
    expansionSpeed: 0.72,
    coreDuration: 0.26,
    shockwaveSpeed: 0.82,
    dissolveStart: 0.5,
    fragmentAmount: 0.42,
    fragmentMinSize: 1,
    fragmentMaxSize: 3,
    fragmentRadialSpeed: 30,
    fragmentTangentialJitter: 9,
    fragmentLifetime: 0.74,
    seed: 20260805,
    shapeMode: 'lobedFireball',
    surfaceStyle: 'celBands',
    lobeCount: 7,
    lobeStretch: 0.58,
    tongueAmount: 0.58,
    tongueLength: 24,
    tongueWidth: 3,
    tongueLengthRandomness: 0.35,
  }
}

/** Builds one stored-preset envelope entry. */
function storedPreset(id: string, name: string, payload: Record<string, unknown>): Record<string, unknown> {
  return { schema: 1, id, name, generatorId: 'explosion', payload }
}

/** Builds a versioned preset-library envelope. */
function library(generatorId: string, presets: readonly Record<string, unknown>[]): Record<string, unknown> {
  return { schema: 1, generatorId, presets }
}

/** In-memory preset storage for migration tests. */
class FakeStorage implements PresetStorage {
  readonly data = new Map<string, string>()
  getItem(key: string): string | null {
    return this.data.get(key) ?? null
  }

  setItem(key: string, value: string): void {
    this.data.set(key, value)
  }
}
