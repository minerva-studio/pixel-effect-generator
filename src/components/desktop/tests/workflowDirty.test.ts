import { describe, expect, it } from 'vitest'
import { DEFAULT_SLASH_PARAMETERS } from '../../../generators/slash/model'
import { slashProjectCodec } from '../../../generators/slash/project'
import { isProjectDirty, serializeProjectSnapshot, type ProjectBaseline } from '../useProjectWorkflow'
import { DEFAULT_UNITY_EXPORT_SETTINGS } from '../../unitySettings'

function baseline(generatorId: string, text: string): ProjectBaseline {
  return { generatorId, text }
}

describe('serializeProjectSnapshot', () => {
  it('serializes persistent fields deterministically', () => {
    const first = serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)).toBe(first)
  })

  it('changes when parameters, FPS, or Unity export settings change', () => {
    const base = serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(serializeProjectSnapshot(slashProjectCodec, { ...DEFAULT_SLASH_PARAMETERS, radius: 60 }, 12, DEFAULT_UNITY_EXPORT_SETTINGS)).not.toBe(base)
    expect(serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 24, DEFAULT_UNITY_EXPORT_SETTINGS)).not.toBe(base)
    expect(serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, { pixelsPerUnit: 64, stableGuid: '' })).not.toBe(base)
  })
})

describe('isProjectDirty', () => {
  it('starts clean when the default snapshot equals the baseline', () => {
    const text = serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(isProjectDirty(baseline('slash', text), 'slash', text)).toBe(false)
  })

  it('becomes dirty on the first persistent parameter change', () => {
    const text = serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    const changed = serializeProjectSnapshot(slashProjectCodec, { ...DEFAULT_SLASH_PARAMETERS, radius: 60 }, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(isProjectDirty(baseline('slash', text), 'slash', changed)).toBe(true)
  })

  it('never compares a baseline from another generator', () => {
    const text = serializeProjectSnapshot(slashProjectCodec, DEFAULT_SLASH_PARAMETERS, 12, DEFAULT_UNITY_EXPORT_SETTINGS)
    expect(isProjectDirty(baseline('blip', text), 'slash', text)).toBe(false)
  })

  it('is never dirty without a baseline', () => {
    expect(isProjectDirty(null, 'slash', 'anything')).toBe(false)
  })
})
