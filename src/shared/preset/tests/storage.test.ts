import { describe, expect, it } from 'vitest'
import type { JsonValue } from '../../project/types'
import {
  MAX_CUSTOM_PRESETS,
  createStoredPreset,
  deletePreset,
  normalizePresetName,
  readCustomPresets,
  renamePreset,
  upsertPreset,
  writeCustomPresets,
  type PresetPayloadValidator,
  type PresetStorage,
} from '../storage'

function memoryStorage(initial: Record<string, string> = {}): PresetStorage & { readonly data: Record<string, string> } {
  const data = { ...initial }
  return {
    data,
    getItem: (key) => (key in data ? data[key] : null),
    setItem: (key, value) => {
      data[key] = value
    },
  }
}

const payload: JsonValue = { radius: 44, direction: 'clockwise' }

const validator: PresetPayloadValidator = (value) => {
  if (typeof value === 'object' && value !== null && !Array.isArray(value) && 'radius' in value) {
    const radius = Number((value as Record<string, unknown>).radius)
    return Number.isFinite(radius) ? { ok: true, payload: { radius, normalized: true } } : { ok: false, error: 'bad radius' }
  }
  return { ok: false, error: 'invalid payload' }
}

describe('normalizePresetName', () => {
  it('trims whitespace and enforces the 1-40 character range', () => {
    expect(normalizePresetName('  My Slash  ')).toBe('My Slash')
    expect(normalizePresetName('   ')).toBeNull()
    expect(normalizePresetName('')).toBeNull()
    expect(normalizePresetName('x'.repeat(40))).toBe('x'.repeat(40))
    expect(normalizePresetName('x'.repeat(41))).toBeNull()
  })
})

describe('createStoredPreset', () => {
  it('stores a normalized name with schema version and generator id', () => {
    const preset = createStoredPreset('  Arc  ', 'slash', payload, 'id-1')
    expect(preset).toEqual({
      schema: 1,
      id: 'id-1',
      name: 'Arc',
      generatorId: 'slash',
      payload,
    })
  })

  it('rejects invalid names', () => {
    expect(() => createStoredPreset('   ', 'slash', payload, 'id-1')).toThrow(RangeError)
  })
})

describe('readCustomPresets', () => {
  it('returns an empty library without warning when storage has nothing', () => {
    expect(readCustomPresets('slash', memoryStorage(), validator)).toEqual({ presets: [], warning: false })
    expect(readCustomPresets('slash', null, validator)).toEqual({ presets: [], warning: false })
  })

  it('round-trips a stored library', () => {
    const storage = memoryStorage()
    const preset = createStoredPreset('Arc', 'slash', payload, 'id-1')
    expect(writeCustomPresets('slash', [preset], storage)).toBe(true)
    const loaded = readCustomPresets('slash', storage, validator)
    expect(loaded.warning).toBe(false)
    expect(loaded.presets).toEqual([{ ...preset, payload: { radius: 44, normalized: true } }])
  })

  it('warns and ignores corrupted JSON', () => {
    const storage = memoryStorage({ 'pixel-effect-generator:presets:v1:slash': '{not json' })
    expect(readCustomPresets('slash', storage, validator)).toEqual({ presets: [], warning: true })
  })

  it('warns and ignores wrong schema versions and wrong generator ids', () => {
    const wrongSchema = memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 2, generatorId: 'slash', presets: [] }),
    })
    expect(readCustomPresets('slash', wrongSchema, validator)).toEqual({ presets: [], warning: true })

    const wrongGenerator = memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'blip', presets: [] }),
    })
    expect(readCustomPresets('slash', wrongGenerator, validator)).toEqual({ presets: [], warning: true })
  })

  it('fails to write when storage is unavailable', () => {
    expect(writeCustomPresets('slash', [], null)).toBe(false)
  })

  it('rejects a library when a single preset has the wrong generator id', () => {
    const storage = memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({
        schema: 1,
        generatorId: 'slash',
        presets: [{ schema: 1, id: 'a', name: 'Arc', generatorId: 'blip', payload }],
      }),
    })
    expect(readCustomPresets('slash', storage, validator)).toEqual({ presets: [], warning: true })
  })

  it('rejects a library when the payload validator fails', () => {
    const storage = memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({
        schema: 1,
        generatorId: 'slash',
        presets: [{ schema: 1, id: 'a', name: 'Arc', generatorId: 'slash', payload: { color: 'blue' } }],
      }),
    })
    expect(readCustomPresets('slash', storage, validator)).toEqual({ presets: [], warning: true })
  })

  it('rejects libraries over the count limit or with duplicate or empty ids', () => {
    const many = Array.from({ length: 33 }, (_, index) => ({ schema: 1, id: `id-${index}`, name: `p${index}`, generatorId: 'slash', payload }))
    expect(readCustomPresets('slash', memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'slash', presets: many }),
    }), validator)).toEqual({ presets: [], warning: true })

    const duplicates = [
      { schema: 1, id: 'same', name: 'A', generatorId: 'slash', payload },
      { schema: 1, id: 'same', name: 'B', generatorId: 'slash', payload },
    ]
    expect(readCustomPresets('slash', memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'slash', presets: duplicates }),
    }), validator)).toEqual({ presets: [], warning: true })

    const emptyId = [{ schema: 1, id: '', name: 'A', generatorId: 'slash', payload }]
    expect(readCustomPresets('slash', memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'slash', presets: emptyId }),
    }), validator)).toEqual({ presets: [], warning: true })
  })

  it('rejects non-normalized names and wrong entry schemas', () => {
    const nonNormalized = [{ schema: 1, id: 'a', name: '  Arc  ', generatorId: 'slash', payload }]
    expect(readCustomPresets('slash', memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'slash', presets: nonNormalized }),
    }), validator)).toEqual({ presets: [], warning: true })

    const wrongEntrySchema = [{ schema: 2, id: 'a', name: 'Arc', generatorId: 'slash', payload }]
    expect(readCustomPresets('slash', memoryStorage({
      'pixel-effect-generator:presets:v1:slash': JSON.stringify({ schema: 1, generatorId: 'slash', presets: wrongEntrySchema }),
    }), validator)).toEqual({ presets: [], warning: true })
  })

  it('uses the validator-normalized payload in the loaded library', () => {
    const storage = memoryStorage()
    const raw = { radius: 44, direction: 'clockwise', extra: 1 }
    expect(writeCustomPresets('slash', [createStoredPreset('Arc', 'slash', raw, 'a')], storage)).toBe(true)
    const loaded = readCustomPresets('slash', storage, validator)
    expect(loaded.warning).toBe(false)
    expect(loaded.presets[0].payload).toEqual({ radius: 44, normalized: true })
  })

  it('clears the warning after a clean library is rewritten', () => {
    const storage = memoryStorage({ 'pixel-effect-generator:presets:v1:slash': '{corrupt' })
    expect(readCustomPresets('slash', storage, validator).warning).toBe(true)
    expect(writeCustomPresets('slash', [createStoredPreset('Arc', 'slash', payload, 'a')], storage)).toBe(true)
    expect(readCustomPresets('slash', storage, validator)).toEqual({
      presets: [{ schema: 1, id: 'a', name: 'Arc', generatorId: 'slash', payload: { radius: 44, normalized: true } }],
      warning: false,
    })
  })

  it('defensively rejects invalid libraries on write', () => {
    const storage = memoryStorage()
    const overLimit = Array.from({ length: 33 }, (_, index) => createStoredPreset(`p${index}`, 'slash', payload, `id-${index}`))
    expect(writeCustomPresets('slash', overLimit, storage)).toBe(false)
    expect(writeCustomPresets('slash', [createStoredPreset('A', 'blip', payload, 'a')], storage)).toBe(false)
    const duplicates = [
      createStoredPreset('A', 'slash', payload, 'same'),
      createStoredPreset('B', 'slash', payload, 'same'),
    ]
    expect(writeCustomPresets('slash', duplicates, storage)).toBe(false)
    expect(storage.getItem('pixel-effect-generator:presets:v1:slash')).toBeNull()
  })
})

describe('preset library operations', () => {
  it('upserts by stable id and respects the count limit', () => {
    const presets = Array.from({ length: MAX_CUSTOM_PRESETS }, (_, index) => createStoredPreset(`p${index}`, 'slash', payload, `id-${index}`))
    expect(upsertPreset([], createStoredPreset('new', 'slash', payload, 'n')).ok).toBe(true)
    expect(upsertPreset(presets, createStoredPreset('full', 'slash', payload, 'x')).ok).toBe(false)

    const updated = upsertPreset(presets, createStoredPreset('renamed', 'slash', payload, 'id-0'))
    expect(updated.ok).toBe(true)
    expect(updated.presets[0].name).toBe('renamed')
    expect(updated.presets).toHaveLength(MAX_CUSTOM_PRESETS)
  })

  it('renames and deletes by stable id', () => {
    const presets = [createStoredPreset('A', 'slash', payload, 'a'), createStoredPreset('B', 'slash', payload, 'b')]
    expect(renamePreset(presets, 'a', '  Alpha  ')[0].name).toBe('Alpha')
    expect(() => renamePreset(presets, 'a', '   ')).toThrow(RangeError)
    expect(deletePreset(presets, 'a').map((preset) => preset.id)).toEqual(['b'])
  })
})
