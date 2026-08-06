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
    expect(translate(messagesForLocale('zh-CN'), 'previewTools.canvas.presetSquare', { width: 64, height: 64 })).toBe('方形 64×64')
  })

  it('builds animated export file names with fps in both languages', () => {
    expect(translate(en, 'export.gifFileName', { name: 'Slash', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-Slash-128x128-8-frames-12fps.gif')
    expect(translate(en, 'export.apngFileName', { name: 'Slash', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-Slash-128x128-8-frames-12fps-animated.png')
    expect(translate(messagesForLocale('zh-CN'), 'export.gifFileName', { name: '斩击', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-斩击-128x128-8-帧-12fps.gif')
    expect(translate(messagesForLocale('zh-CN'), 'export.apngFileName', { name: '斩击', width: 128, height: 128, frameCount: 8, fps: 12 })).toBe('pixel-斩击-128x128-8-帧-12fps-animated.png')
  })

  it('interpolates project, ZIP, and Unity file names with generator ids', () => {
    const params = { name: 'slash', width: 128, height: 128, frameCount: 8 }
    expect(translate(en, 'project.fileName', params)).toBe('pixel-slash-128x128-8-frames.json')
    expect(translate(en, 'export.fileNames.compactPng', params)).toBe('pixel-slash-128x128-8-frames-compact.png')
    expect(translate(en, 'export.fileNames.frameZip', params)).toBe('pixel-slash-128x128-8-frames.zip')
    expect(translate(en, 'export.fileNames.unityZip', { ...params, layout: 'compact' })).toBe('pixel-slash-128x128-8-frames-compact-unity6.zip')
    expect(translate(messagesForLocale('zh-CN'), 'project.fileName', params)).toBe('pixel-slash-128x128-8-帧.json')
  })

  it('interpolates export category summaries in both languages', () => {
    expect(translate(en, 'export.frameZip.summary', { frameCount: 8, width: 256, height: 128, fps: 12 }))
      .toBe('8 frames · 256 × 128 px · 12 FPS')
    expect(translate(messagesForLocale('zh-CN'), 'export.frameZip.summary', { frameCount: 8, width: 256, height: 128, fps: 12 }))
      .toBe('8 帧 · 256 × 128 px · 12 FPS')
  })

  it('interpolates Project menu labels and errors in both languages', () => {
    expect(translate(en, 'project.menu')).toBe('Project')
    expect(translate(en, 'project.open')).toBe('Open project…')
    expect(translate(en, 'project.save')).toBe('Save project')
    expect(translate(messagesForLocale('zh-CN'), 'project.menu')).toBe('项目')
    expect(translate(messagesForLocale('zh-CN'), 'project.open')).toBe('打开项目…')
    expect(translate(messagesForLocale('zh-CN'), 'project.errors.invalidJson')).toBe('文件不是有效的 JSON。')
  })

  it('interpolates the Unity atlas size error in both languages', () => {
    const params = { width: 3072, height: 128 }
    expect(translate(en, 'export.errors.unityAtlasTooLarge', params))
      .toBe('The Unity atlas is 3072 × 128 px; Unity 6 supports up to 16384 px per side.')
    expect(translate(messagesForLocale('zh-CN'), 'export.errors.unityAtlasTooLarge', params))
      .toBe('Unity 图集为 3072 × 128 px；Unity 6 每边上限为 16384 px。')
  })

  it('interpolates zoom and atlas preview labels in both languages', () => {
    expect(translate(en, 'preview.zoomOption', { zoom: 2 })).toBe('2×')
    expect(translate(messagesForLocale('zh-CN'), 'preview.zoomOption', { zoom: 2 })).toBe('2×')
    expect(translate(en, 'export.atlasPreview.meta', { width: 3072, height: 128, layout: 'Horizontal' }))
      .toBe('3072 × 128 px · Horizontal')
    expect(translate(messagesForLocale('zh-CN'), 'export.atlasPreview.meta', { width: 384, height: 384, layout: '紧凑网格' }))
      .toBe('384 × 384 px · 紧凑网格')
  })

  it('keeps preset labels and slash preset names available', () => {
    expect(translate(en, 'presets.saveAs')).toBe('Save as…')
    expect(translate(en, 'slash.presets.fullCircle.name')).toBe('Full Circle')
    expect(translate(messagesForLocale('zh-CN'), 'slash.presets.fullCircle.description')).toBe('完整的 360° 环形扫击。')
    expect(translate(en, 'explosion.presets.retroBurst.name')).toBe('Retro Burst')
    expect(translate(en, 'energyBloom.presets.softPetals.name')).toBe('Soft Petals')
    expect(translate(messagesForLocale('zh-CN'), 'energyBloom.presets.softPetals.description')).toBe('赛璐璐色带的圆润卡通花瓣；默认关闭火舌。')
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
    expect(generatorDisplayKeys('explosion')?.name).toBe('explosion.name')
    expect(categoryDisplayKeys('explosion', 'body')?.label).toBe('explosion.categories.body.label')
    expect(categoryDisplayKeys('explosion', 'motion')?.label).toBe('explosion.categories.motion.label')
    expect(categoryDisplayKeys('explosion', 'material')?.label).toBe('explosion.categories.material.label')
    expect(categoryDisplayKeys('explosion', 'effects')?.label).toBe('explosion.categories.effects.label')
    expect(generatorDisplayKeys('energyBloom')?.name).toBe('energyBloom.name')
    expect(categoryDisplayKeys('energyBloom', 'palette')?.label).toBe('energyBloom.categories.palette.label')
    expect(categoryDisplayKeys('energyBloom', 'material')?.label).toBe('energyBloom.categories.material.label')
    expect(categoryDisplayKeys('missing', 'shape')).toBeUndefined()
  })
})
