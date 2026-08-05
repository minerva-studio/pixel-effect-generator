import { describe, expect, it, vi } from 'vitest'
import {
  categoryDisplayKeys,
  en,
  generatorDisplayKeys,
  messagesForLocale,
  translate,
  type MessageKey,
  type MessageTree,
} from '../messages'

/** Flattens a message tree into its dotted keys for structural comparison. */
function flattenKeys(tree: unknown, prefix = ''): string[] {
  if (typeof tree !== 'object' || tree === null) {
    return []
  }
  return Object.entries(tree).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key
    return typeof value === 'string' ? [path] : flattenKeys(value, path)
  }).sort()
}

describe('translation resources', () => {
  it('keeps every locale on the exact key structure of English', () => {
    expect(flattenKeys(messagesForLocale('zh-CN'))).toEqual(flattenKeys(en))
  })

  it('interpolates named parameters into dynamic templates', () => {
    expect(translate(en, 'app.status', { width: 256, height: 128 })).toBe('256 × 128 RGBA')
    expect(translate(en, 'slash.palette.band', { index: 3 })).toBe('Palette band 3')
    expect(translate(en, 'slash.palette.removeBand', { index: 2 })).toBe('Remove palette band 2')
    expect(translate(en, 'export.fileName', { name: 'Slash', width: 128, height: 128, frameCount: 8 })).toBe('pixel-Slash-128x128-8-frames.png')
    expect(translate(messagesForLocale('zh-CN'), 'export.fileName', { name: '斩击', width: 128, height: 128, frameCount: 8 })).toBe('pixel-斩击-128x128-8-帧.png')
    expect(translate(messagesForLocale('zh-CN'), 'slash.canvas.presetSquare', { width: 64, height: 64 })).toBe('方形 64×64')
  })

  it('builds animated export file names with fps in both languages', () => {
    expect(translate(en, 'export.gifFileName', { name: 'Slash', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-Slash-128x128-8-frames-12fps.gif')
    expect(translate(en, 'export.apngFileName', { name: 'Slash', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-Slash-128x128-8-frames-12fps-animated.png')
    expect(translate(messagesForLocale('zh-CN'), 'export.gifFileName', { name: '斩击', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-斩击-128x128-8-帧-12fps.gif')
    expect(translate(messagesForLocale('zh-CN'), 'export.apngFileName', { name: '斩击', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-斩击-128x128-8-帧-12fps-animated.png')
  })

  it('falls back to English for keys missing from the current locale', () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined)
    const incomplete = { app: { title: '自定义标题' } } as unknown as MessageTree
    expect(translate(incomplete, 'app.title')).toBe('自定义标题')
    expect(translate(incomplete, 'app.subtitle')).toBe(en.app.subtitle)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('app.subtitle'))
    warn.mockRestore()
  })

  it('throws a clear error for keys missing from every locale', () => {
    expect(() => translate({} as MessageTree, 'app.missing' as MessageKey)).toThrow(/Missing translation key/)
  })

  it('throws a clear error for missing interpolation parameters', () => {
    expect(() => translate(en, 'app.status')).toThrow(/Missing interpolation parameter/)
  })

  it('maps stable generator and category ids to translation keys', () => {
    expect(generatorDisplayKeys('slash')?.name).toBe('slash.name')
    expect(generatorDisplayKeys('slash')?.previewTitle).toBe('slash.previewTitle')
    expect(generatorDisplayKeys('missing')).toBeUndefined()
    expect(categoryDisplayKeys('slash', 'breakup')?.label).toBe('slash.categories.breakup.label')
    expect(categoryDisplayKeys('slash', 'missing')).toBeUndefined()
    expect(categoryDisplayKeys('missing', 'shape')).toBeUndefined()
  })
})
