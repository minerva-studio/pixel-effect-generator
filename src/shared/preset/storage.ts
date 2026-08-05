import type { JsonValue } from '../project/types'

export const PRESET_STORAGE_SCHEMA = 1
export const MAX_CUSTOM_PRESETS = 32
export const MAX_PRESET_NAME_LENGTH = 40
export const PRESET_STORAGE_PREFIX = 'pixel-effect-generator:presets:v1:'

/** One custom preset persisted in browser storage. */
export interface StoredPreset {
  readonly schema: typeof PRESET_STORAGE_SCHEMA
  readonly id: string
  readonly name: string
  readonly generatorId: string
  readonly payload: JsonValue
}

/** Versioned custom-preset library for one generator. */
export interface StoredPresetLibrary {
  readonly schema: typeof PRESET_STORAGE_SCHEMA
  readonly generatorId: string
  readonly presets: readonly StoredPreset[]
}

/** Minimal storage abstraction so tests never touch browser globals. */
export interface PresetStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

/** Payload validator provided by the generator's preset capability. */
export type PresetPayloadValidator = (
  payload: unknown,
) => { readonly ok: true; readonly payload: JsonValue } | { readonly ok: false; readonly error: string }

/** Reads localStorage safely; returns null when the browser blocks it. */
export function browserPresetStorage(): PresetStorage | null {
  try {
    if (typeof window === 'undefined' || window.localStorage === undefined) {
      return null
    }
    const storage = window.localStorage
    storage.getItem(PRESET_STORAGE_PREFIX)
    return storage
  } catch {
    return null
  }
}

export function presetStorageKey(generatorId: string): string {
  return `${PRESET_STORAGE_PREFIX}${generatorId}`
}

/** Trims a preset name; null when empty or longer than the limit. */
export function normalizePresetName(name: string): string | null {
  const trimmed = name.trim()
  if (trimmed.length === 0 || trimmed.length > MAX_PRESET_NAME_LENGTH) {
    return null
  }
  return trimmed
}

/** Creates one stored preset; the caller owns id uniqueness. */
export function createStoredPreset(
  name: string,
  generatorId: string,
  payload: JsonValue,
  id: string,
): StoredPreset {
  const normalized = normalizePresetName(name)
  if (normalized === null) {
    throw new RangeError(`Preset name must be 1-${MAX_PRESET_NAME_LENGTH} characters.`)
  }
  return { schema: PRESET_STORAGE_SCHEMA, id, name: normalized, generatorId, payload }
}

/**
 * Reads a custom preset library. Corrupted JSON, wrong schema versions, and
 * mismatched generator ids are treated as empty with a non-blocking warning.
 */
export function readCustomPresets(
  generatorId: string,
  storage: PresetStorage | null,
  validatePayload: PresetPayloadValidator,
): { readonly presets: readonly StoredPreset[]; readonly warning: boolean } {
  if (storage === null) {
    return { presets: [], warning: false }
  }
  const raw = storage.getItem(presetStorageKey(generatorId))
  if (raw === null) {
    return { presets: [], warning: false }
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return { presets: [], warning: true }
  }
  const presets = parsePresetLibrary(value, generatorId, validatePayload)
  if (presets === null) {
    return { presets: [], warning: true }
  }
  return { presets, warning: false }
}

/**
 * Writes a custom preset library. Returns false when storage is unavailable
 * or the library violates the count, generator, id-uniqueness, or name rules,
 * so callers bypassing the UI cannot persist an invalid library.
 */
export function writeCustomPresets(
  generatorId: string,
  presets: readonly StoredPreset[],
  storage: PresetStorage | null,
): boolean {
  if (storage === null) {
    return false
  }
  if (presets.length > MAX_CUSTOM_PRESETS) {
    return false
  }
  const ids = new Set<string>()
  for (const preset of presets) {
    if (preset.schema !== PRESET_STORAGE_SCHEMA) {
      return false
    }
    if (preset.generatorId !== generatorId) {
      return false
    }
    if (preset.id === '' || ids.has(preset.id)) {
      return false
    }
    ids.add(preset.id)
    if (normalizePresetName(preset.name) !== preset.name) {
      return false
    }
    if (typeof preset.payload !== 'object' || preset.payload === null || Array.isArray(preset.payload)) {
      return false
    }
  }
  const library: StoredPresetLibrary = {
    schema: PRESET_STORAGE_SCHEMA,
    generatorId,
    presets: presets.map((preset) => ({ ...preset })),
  }
  try {
    storage.setItem(presetStorageKey(generatorId), JSON.stringify(library))
    return true
  } catch {
    return false
  }
}

/** Adds or updates a preset by stable id, enforcing the count limit. */
export function upsertPreset(
  presets: readonly StoredPreset[],
  preset: StoredPreset,
): { readonly presets: readonly StoredPreset[]; readonly ok: boolean } {
  const index = presets.findIndex((entry) => entry.id === preset.id)
  if (index >= 0) {
    const next = [...presets]
    next[index] = preset
    return { presets: next, ok: true }
  }
  if (presets.length >= MAX_CUSTOM_PRESETS) {
    return { presets, ok: false }
  }
  return { presets: [...presets, preset], ok: true }
}

/** Renames one preset by stable id. */
export function renamePreset(
  presets: readonly StoredPreset[],
  id: string,
  name: string,
): readonly StoredPreset[] {
  const normalized = normalizePresetName(name)
  if (normalized === null) {
    throw new RangeError(`Preset name must be 1-${MAX_PRESET_NAME_LENGTH} characters.`)
  }
  return presets.map((preset) => (preset.id === id ? { ...preset, name: normalized } : preset))
}

/** Removes one preset by stable id. */
export function deletePreset(
  presets: readonly StoredPreset[],
  id: string,
): readonly StoredPreset[] {
  return presets.filter((preset) => preset.id !== id)
}

/**
 * Validates one raw library value against the generator payload validator.
 * Any invalid entry rejects the whole library; the validator's normalized
 * payload replaces the stored one.
 */
function parsePresetLibrary(
  value: unknown,
  generatorId: string,
  validatePayload: PresetPayloadValidator,
): readonly StoredPreset[] | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  if (record.schema !== PRESET_STORAGE_SCHEMA || record.generatorId !== generatorId) {
    return null
  }
  if (!Array.isArray(record.presets) || record.presets.length > MAX_CUSTOM_PRESETS) {
    return null
  }
  const presets: StoredPreset[] = []
  const ids = new Set<string>()
  for (const entry of record.presets) {
    const preset = parseStoredPreset(entry)
    if (preset === null) {
      return null
    }
    if (preset.generatorId !== generatorId || preset.id === '' || ids.has(preset.id)) {
      return null
    }
    ids.add(preset.id)
    const validated = validatePayload(preset.payload)
    if (!validated.ok) {
      return null
    }
    presets.push({ ...preset, payload: validated.payload })
  }
  return presets
}

function parseStoredPreset(value: unknown): StoredPreset | null {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    return null
  }
  const record = value as Record<string, unknown>
  if (
    record.schema !== PRESET_STORAGE_SCHEMA
    || typeof record.id !== 'string'
    || typeof record.name !== 'string'
    || typeof record.generatorId !== 'string'
    || record.name !== record.name.trim()
    || normalizePresetName(record.name) === null
    || typeof record.payload !== 'object'
    || record.payload === null
  ) {
    return null
  }
  return {
    schema: PRESET_STORAGE_SCHEMA,
    id: record.id,
    name: record.name,
    generatorId: record.generatorId,
    payload: record.payload as JsonValue,
  }
}
