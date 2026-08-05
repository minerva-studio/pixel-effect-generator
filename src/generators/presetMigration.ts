import type { JsonValue } from '../shared/project/types'
import {
  createStoredPreset,
  presetStorageKey,
  upsertPreset,
  writeCustomPresets,
  type PresetStorage,
  type StoredPreset,
} from '../shared/preset/storage'
import { parseLegacyExplosionPayload, type LegacyExplosionFields } from './explosion/legacy'
import { captureExplosionPreset, clampExplosionPresetParameters } from './explosion/presets'
import type { ExplosionParameters } from './explosion/model'
import { captureBloomPreset, clampBloomPresetParameters } from './energy-bloom/presets'
import type { BloomParameters } from './energy-bloom/model'
import type { SharedShockwaveParameters } from './shared-effects/types'

export type PresetMigrationResult =
  | { readonly migrated: true; readonly explosion: number; readonly energyBloom: number }
  | { readonly migrated: false; readonly reason: 'unavailable' | 'empty' | 'invalid-library' | 'failed'; readonly error?: string }

/**
 * One-time classification of pre-split Explosion presets: `legacyRadial`
 * stays in the combustion explosion family while `lobedFireball` moves to the
 * energy bloom family as `softPetals`, preserving every effect field.
 */
export function migrateLegacyPreset(value: unknown): { readonly target: 'explosion' | 'energyBloom'; readonly payload: JsonValue } {
  const legacy = parseLegacyExplosionPayload(value)
  if (legacy.body.shapeMode === 'legacyRadial') {
    return { target: 'explosion', payload: captureExplosionPreset(toExplosionParameters(legacy)) }
  }
  return { target: 'energyBloom', payload: captureBloomPreset(toBloomParameters(legacy)) }
}

/** Converts legacy semantic groups into the combustion explosion family. */
function toExplosionParameters(legacy: LegacyExplosionFields): ExplosionParameters {
  const motion = motionFromLegacy(legacy)
  const surfaceStyle = legacySurfaceToExplosion(legacy.surface.style)
  const surface = surfaceStyle === 'burningLayers'
    ? { style: 'burningLayers' as const, coverage: legacy.surface.coverage, bandWarp: 0.18, edgeBreakup: 0.32 }
    : surfaceStyle === 'rollingSoot'
      ? { style: 'rollingSoot' as const, coverage: legacy.surface.coverage, sootAmount: 0.3, sootScale: 11 }
      : { style: 'retroPixel' as const, coverage: legacy.surface.coverage }
  return clampExplosionPresetParameters({
    palette: legacy.palette,
    canvasWidth: 128,
    canvasHeight: 128,
    frameCount: 10,
    seed: legacy.seed,
    body: {
      shape: 'legacyRadial',
      radius: legacy.body.radius,
      rotation: legacy.body.rotation,
      shapeIrregularity: legacy.body.shapeIrregularity,
      churnAmount: 0.5,
      pressureWidth: 6,
      pressureSharpness: 0.8,
    },
    surface,
    motion,
    core: legacy.core,
    shockwave: shockwaveFromLegacy(legacy.shockwave),
    tongues: legacy.tongues,
    fragments: legacy.fragments,
  })
}

/** Converts legacy semantic groups into the energy bloom family. */
function toBloomParameters(legacy: LegacyExplosionFields): BloomParameters {
  const motion = motionFromLegacy(legacy)
  const legacySurface = legacy.surface
  const surface = legacySurface.style === 'celBands'
    ? { style: 'celBands' as const, coverage: legacySurface.coverage, bandWarp: legacySurface.bandWarp, edgeBreakup: legacySurface.edgeBreakup }
    : legacySurface.style === 'moltenCavities'
      ? { style: 'moltenCavities' as const, coverage: legacySurface.coverage, cavityAmount: legacySurface.cavityAmount, cavityScale: legacySurface.cavityScale }
      : legacySurface.style === 'fracturedChunks'
        ? { style: 'crystalShards' as const, coverage: legacySurface.coverage, chunkSize: legacySurface.chunkSize, crackWidth: legacySurface.crackWidth }
        : legacySurface.style === 'gridNoise'
          ? { style: 'gridNoise' as const, coverage: legacySurface.coverage }
          : { style: 'pixelNoise' as const, coverage: legacySurface.coverage }
  return clampBloomPresetParameters({
    palette: legacy.palette,
    canvasWidth: 128,
    canvasHeight: 128,
    frameCount: 10,
    seed: legacy.seed,
    body: {
      shape: 'softPetals',
      radius: legacy.body.radius,
      rotation: legacy.body.rotation,
      shapeIrregularity: legacy.body.shapeIrregularity,
      petalCount: legacy.body.lobeCount,
      petalStretch: legacy.body.lobeStretch,
      rayCount: 10,
      rayTaper: 0.6,
      corollaLayers: 2,
      layerDelay: 0.18,
    },
    surface,
    motion,
    core: legacy.core,
    shockwave: shockwaveFromLegacy(legacy.shockwave),
    tongues: legacy.tongues,
    fragments: legacy.fragments,
  })
}

/** Maps the frozen legacy shockwave onto the current ring model. */
function shockwaveFromLegacy(shockwave: LegacyExplosionFields['shockwave']): SharedShockwaveParameters {
  return {
    mode: shockwave.mode === 'lobeArcs' ? 'multiRing' : shockwave.mode,
    colorMode: 'flat',
    thickness: shockwave.thickness,
    startRadiusScale: shockwave.startRadiusScale,
    endRadiusScale: shockwave.endRadiusScale,
    startTime: shockwave.startTime,
    duration: shockwave.duration,
    ringCount: 3,
    ringSpacing: 0.55,
    squash: 0,
    squashAngle: 0,
  }
}

/** Derives the shared motion group while keeping dissolve timing intact. */
function motionFromLegacy(legacy: LegacyExplosionFields): ExplosionParameters['motion'] {
  const dissolveStart = Math.max(0.1, Math.min(0.9, legacy.surface.dissolveStart))
  const formationDuration = Math.min(0.8, Math.max(0.1, Math.min(legacy.body.formationDuration, dissolveStart)))
  const holdDuration = Math.min(0.5, Math.max(0, dissolveStart - formationDuration))
  return { mode: legacy.mode, formationDuration, holdDuration, motionCurve: 'balanced', dissolveStart }
}

/** Maps legacy surfaces onto the combustion explosion family. */
function legacySurfaceToExplosion(style: LegacyExplosionFields['surface']['style']): 'burningLayers' | 'rollingSoot' | 'retroPixel' {
  switch (style) {
    case 'celBands': return 'burningLayers'
    case 'fracturedChunks':
    case 'moltenCavities': return 'rollingSoot'
    case 'gridNoise':
    case 'pixelNoise': return 'retroPixel'
  }
}

/** Migrates the pre-split explosion library into the two new family libraries. */
export function migrateExplosionFamilyPresets(storage: PresetStorage | null): PresetMigrationResult {
  if (storage === null) return { migrated: false, reason: 'unavailable' }
  const raw = storage.getItem(presetStorageKey('explosion'))
  if (raw === null) return { migrated: false, reason: 'empty' }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { migrated: false, reason: 'invalid-library' }
  }
  const entries = readLegacyLibraryEntries(value)
  if (entries === null) return { migrated: false, reason: 'invalid-library' }
  if (entries.length === 0) return { migrated: false, reason: 'empty' }

  const explosionPresets: StoredPreset[] = []
  const bloomPresets: StoredPreset[] = []
  for (const entry of entries) {
    let migrated: { readonly target: 'explosion' | 'energyBloom'; readonly payload: JsonValue }
    try {
      migrated = migrateLegacyPreset(entry.payload)
    } catch (error) {
      return {
        migrated: false,
        reason: 'failed',
        error: `preset "${entry.name}" could not be migrated: ${error instanceof Error ? error.message : String(error)}`,
      }
    }
    const stored = createStoredPreset(entry.name, migrated.target, migrated.payload, entry.id)
    ;(migrated.target === 'explosion' ? explosionPresets : bloomPresets).push(stored)
  }

  const existingBloom = readRawLibraryEntries(storage, 'energyBloom')
  if (existingBloom === null) return { migrated: false, reason: 'invalid-library' }
  const targetBloom = mergeById(existingBloom, bloomPresets)
  if (!writeCustomPresets('energyBloom', targetBloom, storage)) {
    return { migrated: false, reason: 'failed', error: 'energyBloom preset library could not be written.' }
  }
  // The converted explosion library replaces the old one; every lobed preset
  // has already moved to energyBloom above.
  if (!writeCustomPresets('explosion', explosionPresets, storage)) {
    return { migrated: false, reason: 'failed', error: 'explosion preset library could not be written.' }
  }
  return { migrated: true, explosion: explosionPresets.length, energyBloom: bloomPresets.length }
}

/** Reads stored preset entries structurally without payload validation. */
function readRawLibraryEntries(storage: PresetStorage, generatorId: string): readonly StoredPreset[] | null {
  const raw = storage.getItem(presetStorageKey(generatorId))
  if (raw === null) return []
  try {
    return readLegacyLibraryEntries(JSON.parse(raw))
  } catch {
    return null
  }
}

/** Parses one versioned preset-library envelope into plain entries. */
function readLegacyLibraryEntries(value: unknown): readonly StoredPreset[] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return null
  const record = value as Record<string, unknown>
  if (record.schema !== 1 || typeof record.generatorId !== 'string' || !Array.isArray(record.presets)) return null
  const presets: StoredPreset[] = []
  const ids = new Set<string>()
  for (const entry of record.presets) {
    if (typeof entry !== 'object' || entry === null || Array.isArray(entry)) return null
    const preset = entry as Record<string, unknown>
    if (preset.schema !== 1 || typeof preset.id !== 'string' || typeof preset.name !== 'string' || typeof preset.payload !== 'object' || preset.payload === null) {
      return null
    }
    if (preset.id === '' || ids.has(preset.id)) return null
    ids.add(preset.id)
    presets.push({
      schema: 1,
      id: preset.id,
      name: preset.name,
      generatorId: record.generatorId,
      payload: preset.payload as JsonValue,
    })
  }
  return presets
}

/** Merges entries by stable id so re-running a partial migration never duplicates. */
function mergeById(existing: readonly StoredPreset[], additions: readonly StoredPreset[]): readonly StoredPreset[] {
  let merged: readonly StoredPreset[] = existing
  for (const preset of additions) {
    const next = upsertPreset(merged, preset)
    merged = next.presets
  }
  return merged
}

/** Registered one-time migrations keyed by the owning generator id. */
const PRESET_MIGRATIONS: Readonly<Record<string, (storage: PresetStorage | null) => PresetMigrationResult>> = {
  explosion: migrateExplosionFamilyPresets,
}

/** Runs the registered migration for one generator before its presets load. */
export function runPresetMigration(generatorId: string, storage: PresetStorage | null): PresetMigrationResult {
  const migration = PRESET_MIGRATIONS[generatorId]
  return migration ? migration(storage) : { migrated: false, reason: 'empty' }
}
